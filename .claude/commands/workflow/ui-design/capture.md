---
name: capture
description: Batch screenshot capture for UI design workflows using MCP or local fallback
usage: /workflow:ui-design:capture --url-map "<map>" [--base-path <path>] [--session <id>]
examples:
  - /workflow:ui-design:capture --url-map "home:https://linear.app, pricing:https://linear.app/pricing"
  - /workflow:ui-design:capture --session WFS-auth --url-map "dashboard:https://app.com/dash"
  - /workflow:ui-design:capture --base-path ".workflow/.design/run-20250110" --url-map "hero:https://example.com#hero"
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), mcp__browser__screenshot(*)
---

# Batch Screenshot Capture Command

## Overview
独立的批量截图命令，支持MCP优先策略和多级降级机制。可被其他工作流复用。

## Core Philosophy
- **MCP优先**：优先使用mcp__browser__screenshot（如果可用）
- **智能降级**：MCP失败 → Playwright → Chrome → 手动上传
- **批量处理**：一次处理多个URL，并行截图
- **结构化输出**：按target_name组织截图文件
- **错误容忍**：部分失败不阻塞整体流程

## Execution Protocol

### Phase 0: 初始化和路径解析

```bash
# 确定base path
IF --base-path:
    base_path = {provided_base_path}
ELSE IF --session:
    # 查找session最新design run
    session_design_dirs = Glob(".workflow/WFS-{session}/design-*")
    IF session_design_dirs:
        base_path = most_recent(session_design_dirs)
    ELSE:
        # 创建新的design run
        run_id = "run-$(date +%Y%m%d-%H%M%S)"
        base_path = ".workflow/WFS-{session}/design-{run_id}"
ELSE:
    # Standalone模式
    run_id = "run-$(date +%Y%m%d-%H%M%S)"
    base_path = ".workflow/.design/{run_id}"

# 创建截图目录
screenshot_dir = "{base_path}/screenshots"
Bash(mkdir -p "{screenshot_dir}")

REPORT: "📸 Batch Screenshot Capture"
REPORT: "   Output: {screenshot_dir}/"

# 解析url-map
url_map_string = {--url-map}  # "home:https://a.com, pricing:https://a.com/pricing"

# 解析逻辑
url_entries = []
FOR pair IN split(url_map_string, ","):
    pair = pair.strip()
    IF ":" NOT IN pair:
        ERROR: "Invalid url-map format: '{pair}'"
        ERROR: "Expected format: 'target:url'"
        ERROR: "Example: 'home:https://example.com, pricing:https://example.com/pricing'"
        EXIT 1

    target, url = pair.split(":", 1)
    target = target.strip().lower().replace(" ", "-")
    url = url.strip()

    # 验证target名称
    IF NOT regex_match(target, r"^[a-z0-9][a-z0-9_-]*$"):
        ERROR: "Invalid target name: '{target}'"
        ERROR: "Target names must start with alphanumeric and contain only [a-z0-9_-]"
        EXIT 1

    # 验证URL格式
    IF NOT (url.startswith("http://") OR url.startswith("https://")):
        WARN: "URL '{url}' does not start with http:// or https://"
        WARN: "Prepending https:// automatically"
        url = f"https://{url}"

    url_entries.append({"target": target, "url": url})

VALIDATE: len(url_entries) > 0, "url-map must contain at least one target:url pair"

total_targets = len(url_entries)
REPORT: "   Targets: {total_targets}"
FOR entry IN url_entries:
    REPORT: "     • {entry.target}: {entry.url}"

TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: "MCP batch screenshot capture", status: "pending", activeForm: "Capturing via MCP"},
  {content: "Local tool fallback (if needed)", status: "pending", activeForm: "Local fallback"},
  {content: "Verify and summarize results", status: "pending", activeForm: "Verifying"}
]})
```

### Phase 1: MCP批量截图（优先策略）

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 1: MCP Batch Screenshot"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检测MCP工具可用性
mcp_available = check_tool_availability("mcp__browser__screenshot")

success_captures = []
failed_captures = []

IF mcp_available:
    REPORT: "✓ MCP browser screenshot tool detected"

    # 构建MCP调用参数
    urls = [entry.url for entry in url_entries]
    file_prefixes = [entry.target for entry in url_entries]

    TRY:
        # MCP批量截图调用
        REPORT: "   Calling MCP for {len(urls)} URLs..."

        result = mcp__browser__screenshot({
            urls: urls,
            output_dir: screenshot_dir,
            file_prefix: file_prefixes,
            full_page: true,
            viewport: "1920,1080",
            timeout: 30000
        })

        # 处理MCP返回结果
        success_count = len(result.success)
        failed_count = len(result.failed)

        REPORT: "   MCP capture complete: {success_count} succeeded, {failed_count} failed"

        FOR item IN result.success:
            success_captures.append(item.target)
            REPORT: "     ✓ {item.target}.png"

        FOR item IN result.failed:
            failed_captures.append({"target": item.target, "url": item.url, "error": item.error})
            REPORT: "     ✗ {item.target}: {item.error}"

        # 如果有部分失败，标记需要fallback
        IF failed_count > 0:
            failed_targets = [item.target for item in result.failed]
            REPORT: "   → {failed_count} failed, proceeding to local fallback..."
            TodoWrite(mark_completed: "MCP batch screenshot capture", mark_in_progress: "Local tool fallback")
            GOTO Phase 2 (fallback_targets = failed_targets)
        ELSE:
            REPORT: "✅ All screenshots captured via MCP"
            TodoWrite(mark_completed: "MCP batch screenshot capture", mark_completed: "Local tool fallback", mark_in_progress: "Verify results")
            GOTO Phase 3 (verification)

    CATCH error:
        REPORT: "⚠️ MCP call failed: {error}"
        REPORT: "   Falling back to local tools for all targets"
        failed_targets = [entry.target for entry in url_entries]
        TodoWrite(mark_completed: "MCP batch screenshot capture", mark_in_progress: "Local tool fallback")
        GOTO Phase 2 (fallback_targets = failed_targets)

ELSE:
    REPORT: "ℹ️ MCP browser screenshot tool not available"
    REPORT: "   Using local tool fallback strategy"
    failed_targets = [entry.target for entry in url_entries]
    TodoWrite(mark_completed: "MCP batch screenshot capture", mark_in_progress: "Local tool fallback")
    GOTO Phase 2 (fallback_targets = failed_targets)
```

### Phase 2: Local工具降级（Playwright → Chrome）

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🔧 Phase 2: Local Tool Fallback"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 仅处理Phase 1失败的targets
targets_to_capture = [entry for entry in url_entries if entry.target IN fallback_targets]

REPORT: "Processing {len(targets_to_capture)} target(s) with local tools..."

# 检测本地工具（检查可执行文件，不触发安装）
playwright_path = Bash(which playwright 2>/dev/null || echo "")
chrome_path = Bash(which google-chrome 2>/dev/null || which chrome 2>/dev/null || which chromium 2>/dev/null || echo "")

playwright_available = playwright_path != ""
chrome_available = chrome_path != ""

REPORT: "   Tool availability:"
REPORT: "     Playwright: {playwright_available ? '✓ Available' : '✗ Not found'}"
REPORT: "     Chrome: {chrome_available ? '✓ Available' : '✗ Not found'}"

local_success = []
local_failed = []

FOR entry IN targets_to_capture:
    target = entry.target
    url = entry.url
    output_file = "{screenshot_dir}/{target}.png"
    captured = false
    method_used = null

    # 尝试Playwright
    IF playwright_available AND NOT captured:
        TRY:
            REPORT: "   Trying Playwright for '{target}'..."
            Bash({playwright_path} screenshot "{url}" "{output_file}" --full-page --timeout 30000)

            IF exists(output_file) AND file_size(output_file) > 1000:  # >1KB验证有效
                captured = true
                method_used = "Playwright"
                local_success.append(target)
                success_captures.append(target)
                REPORT: "     ✓ {target}.png (Playwright, {file_size(output_file)/1024:.1f} KB)"
        CATCH error:
            REPORT: "     ⚠️ Playwright failed: {error}"

    # 尝试Chrome
    IF chrome_available AND NOT captured:
        TRY:
            REPORT: "   Trying Chrome for '{target}'..."
            Bash({chrome_path} --headless --disable-gpu --screenshot="{output_file}" --window-size=1920,1080 "{url}")

            IF exists(output_file) AND file_size(output_file) > 1000:
                captured = true
                method_used = "Chrome"
                local_success.append(target)
                success_captures.append(target)
                REPORT: "     ✓ {target}.png (Chrome, {file_size(output_file)/1024:.1f} KB)"
        CATCH error:
            REPORT: "     ⚠️ Chrome failed: {error}"

    # 标记彻底失败
    IF NOT captured:
        local_failed.append(entry)
        failed_captures.append({"target": target, "url": url, "error": "All local tools failed"})
        REPORT: "     ✗ {target}: All tools failed"

REPORT: ""
REPORT: "Local fallback summary:"
REPORT: "   Succeeded: {len(local_success)}/{len(targets_to_capture)}"
REPORT: "   Failed: {len(local_failed)}/{len(targets_to_capture)}"

# 如果仍有失败，进入手动模式
IF len(local_failed) > 0:
    TodoWrite(mark_completed: "Local tool fallback", mark_in_progress: "Manual upload mode")
    GOTO Phase 2.5 (manual_upload)
ELSE:
    TodoWrite(mark_completed: "Local tool fallback", mark_in_progress: "Verify results")
    GOTO Phase 3 (verification)
```

### Phase 2.5: 手动上传降级

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "⚠️ Phase 2.5: Manual Screenshot Required"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REPORT: "Failed to auto-capture {len(local_failed)} target(s):"
REPORT: ""

FOR entry IN local_failed:
    REPORT: "  {entry.target}:"
    REPORT: "    URL: {entry.url}"
    REPORT: "    Save to: {screenshot_dir}/{entry.target}.png"
    REPORT: ""

REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "📋 Manual Steps:"
REPORT: "  1. Visit each URL above in your browser"
REPORT: "  2. Take full-page screenshot (Browser DevTools or extensions)"
REPORT: "  3. Save screenshot to specified path"
REPORT: "  4. Return here and choose an option"
REPORT: ""
REPORT: "Options:"
REPORT: "  • Type 'ready' : I've uploaded screenshot(s), continue workflow"
REPORT: "  • Type 'skip'  : Skip failed screenshots, continue with available"
REPORT: "  • Type 'abort' : Cancel entire capture workflow"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

user_response = WAIT_FOR_USER_INPUT()

MATCH user_response.lower():
    "ready" | "done" | "ok" | "continue":
        # 验证手动上传的文件
        manual_uploaded = []
        REPORT: "🔍 Checking for manual screenshots..."

        FOR entry IN local_failed:
            expected_path = f"{screenshot_dir}/{entry.target}.png"

            IF exists(expected_path) AND file_size(expected_path) > 1000:
                manual_uploaded.append(entry.target)
                success_captures.append(entry.target)
                REPORT: "  ✓ {entry.target}.png (manual, {file_size(expected_path)/1024:.1f} KB)"
            ELSE:
                REPORT: "  ✗ {entry.target}.png not found or invalid"

        IF len(manual_uploaded) > 0:
            REPORT: "✅ Detected {len(manual_uploaded)} manual screenshot(s)"

            # 移除已上传的targets from failed list
            failed_captures = [f for f in failed_captures if f.target NOT IN manual_uploaded]
        ELSE:
            REPORT: "⚠️ No valid manual screenshots detected"
            REPORT: "   Proceeding with available screenshots only"

        TodoWrite(mark_completed: "Manual upload mode", mark_in_progress: "Verify results")
        GOTO Phase 3

    "skip" | "s":
        REPORT: "⏭️ Skipping {len(local_failed)} failed screenshot(s)"
        REPORT: "   Proceeding with {len(success_captures)} available screenshot(s)"
        TodoWrite(mark_completed: "Manual upload mode", mark_in_progress: "Verify results")
        GOTO Phase 3

    "abort" | "cancel" | "exit":
        ERROR: "Workflow aborted by user"
        TodoWrite(mark_failed: "Manual upload mode")
        EXIT 1

    _:
        REPORT: "⚠️ Invalid input '{user_response}', interpreting as 'skip'"
        REPORT: "   Proceeding with available screenshots"
        TodoWrite(mark_completed: "Manual upload mode", mark_in_progress: "Verify results")
        GOTO Phase 3
```

### Phase 3: 验证和总结

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "✅ Phase 3: Verification & Summary"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 扫描实际截图文件
captured_files = Glob("{screenshot_dir}/*.{png,jpg,jpeg,webp}")
captured_targets_actual = [extract_basename_without_ext(f) for f in captured_files]

# 与请求对比
total_requested = len(url_entries)
total_captured = len(captured_targets_actual)
missing_targets = [entry.target for entry in url_entries if entry.target NOT IN captured_targets_actual]

REPORT: "📊 Capture Summary:"
REPORT: "   Total requested: {total_requested}"
REPORT: "   Successfully captured: {total_captured}"
REPORT: "   Success rate: {(total_captured / total_requested * 100):.1f}%"

IF missing_targets:
    REPORT: ""
    REPORT: "⚠️ Missing screenshots ({len(missing_targets)}):"
    FOR target IN missing_targets:
        REPORT: "     • {target}"
ELSE:
    REPORT: ""
    REPORT: "✅ All requested screenshots captured!"

# 生成capture元数据
metadata = {
    "timestamp": current_timestamp(),
    "total_requested": total_requested,
    "total_captured": total_captured,
    "success_rate": round(total_captured / total_requested * 100, 2),
    "screenshots": []
}

FOR entry IN url_entries:
    target = entry.target
    url = entry.url
    is_captured = target IN captured_targets_actual

    screenshot_info = {
        "target": target,
        "url": url,
        "captured": is_captured
    }

    IF is_captured:
        file_path = f"{screenshot_dir}/{target}.png"
        screenshot_info["path"] = file_path
        screenshot_info["size_kb"] = round(file_size(file_path) / 1024, 2)

        # 查找捕获方法
        IF target IN [s.target for s in result.success if mcp_available]:
            screenshot_info["method"] = "MCP"
        ELSE IF target IN local_success:
            screenshot_info["method"] = "Local (Playwright/Chrome)"
        ELSE:
            screenshot_info["method"] = "Manual"
    ELSE:
        screenshot_info["path"] = null
        screenshot_info["error"] = next((f.error for f in failed_captures if f.target == target), "Unknown error")

    metadata.screenshots.append(screenshot_info)

# 写入元数据文件
metadata_path = "{screenshot_dir}/capture-metadata.json"
Write(metadata_path, JSON.stringify(metadata, null, 2))

REPORT: ""
REPORT: "📁 Output:"
REPORT: "   Directory: {screenshot_dir}/"
REPORT: "   Metadata: capture-metadata.json"

TodoWrite(mark_completed: "Verify and summarize results")
```

### Phase 4: 完成

```javascript
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: "MCP batch screenshot capture", status: "completed", activeForm: "MCP capture"},
  {content: "Local tool fallback (if needed)", status: "completed", activeForm: "Local fallback"},
  {content: "Verify and summarize results", status: "completed", activeForm: "Verifying"}
]});
```

**Completion Message**:
```
✅ Batch Screenshot Capture Complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Capture Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Requested: {total_requested} screenshots
Captured: {total_captured} screenshots
Success Rate: {success_rate}%

Capture Methods:
{IF mcp_available AND mcp_success_count > 0:
  • MCP: {mcp_success_count} screenshot(s)
}
{IF local_success_count > 0:
  • Local tools: {local_success_count} screenshot(s)
}
{IF manual_count > 0:
  • Manual upload: {manual_count} screenshot(s)
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 Output Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{screenshot_dir}/
├── {target1}.png ({size1} KB)
├── {target2}.png ({size2} KB)
{FOR each captured screenshot}
└── capture-metadata.json

{IF missing_targets:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Missing Screenshots ({len(missing_targets)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{FOR target IN missing_targets:
  • {target} - {get_error_for_target(target)}
}

💡 Tip: Re-run capture command for failed targets:
   /workflow:ui-design:capture --base-path "{base_path}" --url-map "{build_failed_url_map()}"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Extract design style from captured screenshots:
   /workflow:ui-design:extract --base-path "{base_path}" --images "{screenshot_dir}/*.png" --mode imitate --variants 1

2. Or continue with full imitate workflow:
   (capture is automatically called by /workflow:ui-design:imitate-auto-v3)
```

## MCP API设计（假设实现）

```typescript
// 假设的MCP工具签名
mcp__browser__screenshot({
  urls: string[],              // 要截图的URL列表
  output_dir: string,          // 输出目录
  file_prefix: string[],       // 文件名前缀列表（对应urls）
  full_page?: boolean,         // 全页截图（默认true）
  viewport?: string,           // 视口大小（默认"1920,1080"）
  timeout?: number             // 每个URL的超时（默认30000ms）
}): {
  success: Array<{
    target: string,            // file_prefix对应的target名称
    url: string,              // 成功截图的URL
    path: string              // 生成的截图文件路径
  }>,
  failed: Array<{
    target: string,            // file_prefix对应的target名称
    url: string,              // 失败的URL
    error: string             // 错误信息
  }>
}
```

**注意事项**：
- 如果`mcp__browser__screenshot`工具不存在，命令会自动降级到本地工具
- MCP工具应该支持并行截图以提高性能
- 返回结果应该区分成功和失败，允许部分失败

## Error Handling

- **无效url-map格式**：清晰的错误信息+格式示例
- **MCP不可用**：静默降级到本地工具（Playwright/Chrome）
- **所有自动工具失败**：进入交互式手动上传模式
- **部分失败**：记录成功项，继续流程（非阻塞），提供重试建议

## Key Features

1. **MCP优先策略** - 使用托管工具提高可靠性和一致性
2. **多级降级机制** - MCP → Playwright → Chrome → 手动上传
3. **批量并行处理** - 一次处理多个URL（MCP支持并行）
4. **错误容忍设计** - 部分失败不阻塞整体流程
5. **高度可复用** - 可被imitate-auto-v3、explore-auto等工作流调用
6. **结构化输出** - capture-metadata.json记录完整捕获信息
7. **交互式降级** - 手动模式提供清晰的用户指导
8. **智能路径管理** - 支持session集成和standalone模式

## Integration Points

- **Input**: `--url-map` (target:url pairs) + `--base-path` or `--session`
- **Output**: `{base_path}/screenshots/*.png` + `capture-metadata.json`
- **Callers**: `/workflow:ui-design:imitate-auto-v3`, potentially `/workflow:ui-design:explore-auto-v2`
- **Next Command**: `/workflow:ui-design:extract --images "{screenshot_dir}/*.png"`
