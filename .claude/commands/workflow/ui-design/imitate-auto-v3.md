---
name: imitate-auto-v3
description: High-speed multi-page UI replication with batch screenshot and optional token refinement
usage: /workflow:ui-design:imitate-auto-v3 --url-map "<map>" [--session <id>] [--refine-tokens] [--prompt "<desc>"]
examples:
  - /workflow:ui-design:imitate-auto-v3 --url-map "home:https://linear.app, features:https://linear.app/features"
  - /workflow:ui-design:imitate-auto-v3 --session WFS-payment --url-map "pricing:https://stripe.com/pricing"
  - /workflow:ui-design:imitate-auto-v3 --url-map "dashboard:https://app.com/dash" --refine-tokens
  - /workflow:ui-design:imitate-auto-v3 --url-map "home:https://example.com, about:https://example.com/about" --prompt "Focus on minimalist design"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Write(*), Bash(*)
---

# UI Design Imitate-Auto Workflow (V3)

## Overview & Philosophy

**批量多页面快速复现工作流**：通过编排器模式组合capture、extract、generate-v2命令，实现高效的批量页面复制。

## Parameter Requirements

### Required Parameters
- `--url-map "<map>"` (必需): 目标页面映射
  - 格式：`"target1:url1, target2:url2, ..."`
  - 示例：`"home:https://linear.app, pricing:https://linear.app/pricing"`
  - 第一个target作为主要样式来源

### Optional Parameters
- `--session <id>` (可选): 工作流会话ID
  - 集成到现有会话（`.workflow/WFS-{session}/`）
  - 启用自动设计系统集成（Phase 5）
  - 如不提供：standalone模式（`.workflow/.design/`）

- `--refine-tokens` (可选, 默认: false): 启用完整token refinement
  - `false` (默认): 快速路径，跳过consolidate（~30-60s faster）
  - `true`: 生产质量，执行完整consolidate（philosophy-driven refinement）

- `--prompt "<desc>"` (可选): 样式提取指导
  - 影响extract命令的分析重点
  - 示例：`"Focus on dark mode"`, `"Emphasize minimalist design"`

## 5-Phase Execution Protocol

### Phase 0: 初始化和目标解析

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 UI Design Imitate-Auto V3"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 生成run ID
run_id = "run-$(date +%Y%m%d-%H%M%S)"

# 确定base path和session mode
IF --session:
    session_id = {provided_session}
    base_path = ".workflow/WFS-{session_id}/design-{run_id}"
    session_mode = "integrated"
    REPORT: "Mode: Integrated (Session: {session_id})"
ELSE:
    session_id = null
    base_path = ".workflow/.design/{run_id}"
    session_mode = "standalone"
    REPORT: "Mode: Standalone"

# 创建base目录
Bash(mkdir -p "{base_path}")

# 解析url-map
url_map_string = {--url-map}
VALIDATE: url_map_string is not empty, "--url-map parameter is required"

# 解析target:url pairs
url_map = {}  # {target_name: url}
target_names = []

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

    url_map[target] = url
    target_names.append(target)

VALIDATE: len(target_names) > 0, "url-map must contain at least one target:url pair"

primary_target = target_names[0]  # 第一个作为主要样式来源
refine_tokens_mode = --refine-tokens OR false

# 写入元数据
metadata = {
    "workflow": "imitate-auto-v3",
    "run_id": run_id,
    "session_id": session_id,
    "timestamp": current_timestamp(),
    "parameters": {
        "url_map": url_map,
        "refine_tokens": refine_tokens_mode,
        "prompt": --prompt OR null
    },
    "targets": target_names,
    "status": "in_progress"
}

Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

REPORT: ""
REPORT: "Configuration:"
REPORT: "  Targets: {len(target_names)} pages"
REPORT: "  Primary source: '{primary_target}' ({url_map[primary_target]})"
REPORT: "  All targets: {', '.join(target_names)}"
REPORT: "  Token refinement: {refine_tokens_mode ? 'Enabled (production quality)' : 'Disabled (fast-track)'}"
IF --prompt:
    REPORT: "  Prompt guidance: \"{--prompt}\""
REPORT: ""

# 初始化TodoWrite
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: f"Batch screenshot capture ({len(target_names)} targets)", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract unified design system", status: "pending", activeForm: "Extracting style"},
  {content: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation (skip consolidate)", status: "pending", activeForm: "Processing tokens"},
  {content: f"Generate UI for {len(target_names)} targets", status: "pending", activeForm: "Generating UI"},
  {content: session_id ? "Integrate design system" : "Standalone completion", status: "pending", activeForm: "Completing"}
]})
```

### Phase 1: 批量截图捕获

```bash
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 1: Batch Screenshot Capture"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 构建url-map字符串（传递给capture命令）
url_map_command_string = ",".join([f"{name}:{url}" for name, url in url_map.items()])

# 调用capture命令
capture_command = f"/workflow:ui-design:capture --base-path \"{base_path}\" --url-map \"{url_map_command_string}\""

REPORT: "Calling capture command..."
REPORT: f"  Command: {capture_command}"

TRY:
    SlashCommand(capture_command)
CATCH error:
    ERROR: "Screenshot capture failed: {error}"
    ERROR: "Cannot proceed without screenshots"
    EXIT 1

# capture命令输出到: {base_path}/screenshots/{target}.png + capture-metadata.json

# 验证截图结果
screenshot_metadata_path = "{base_path}/screenshots/capture-metadata.json"

IF NOT exists(screenshot_metadata_path):
    ERROR: "capture command did not generate metadata file"
    ERROR: "Expected: {screenshot_metadata_path}"
    EXIT 1

screenshot_metadata = Read(screenshot_metadata_path)
captured_count = screenshot_metadata.total_captured
total_requested = screenshot_metadata.total_requested
missing_count = total_requested - captured_count

REPORT: ""
REPORT: "✅ Phase 1 complete:"
REPORT: "   Captured: {captured_count}/{total_requested} screenshots ({(captured_count/total_requested*100):.1f}%)"

IF missing_count > 0:
    missing_targets = [s.target for s in screenshot_metadata.screenshots if not s.captured]
    WARN: "   ⚠️ Missing {missing_count} screenshots: {', '.join(missing_targets)}"
    WARN: "   Proceeding with available screenshots for extract phase"

# 如果所有截图都失败，终止
IF captured_count == 0:
    ERROR: "No screenshots captured - cannot proceed"
    ERROR: "Please check URLs and tool availability"
    EXIT 1

TodoWrite(mark_completed: f"Batch screenshot capture ({len(target_names)} targets)",
          mark_in_progress: "Extract unified design system")
```

### Phase 2: 统一设计系统提取

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 2: Extract Unified Design System"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 使用所有截图作为输入，提取单一设计系统
images_glob = f"{base_path}/screenshots/*.{{png,jpg,jpeg,webp}}"

# 构建extraction prompt
IF --prompt:
    user_guidance = {--prompt}
    extraction_prompt = f"Extract a single, high-fidelity design system that accurately imitates the visual style from the '{primary_target}' page. Use other screenshots for component consistency. User guidance: {user_guidance}"
ELSE:
    extraction_prompt = f"Extract a single, high-fidelity design system that accurately imitates the visual style from the '{primary_target}' page. Use other screenshots to ensure component and pattern consistency across all pages."

# 调用extract命令（imitate模式，单变体）
extract_command = f"/workflow:ui-design:extract --base-path \"{base_path}\" --images \"{images_glob}\" --prompt \"{extraction_prompt}\" --mode imitate --variants 1"

REPORT: "Calling extract command..."
REPORT: f"  Mode: imitate (high-fidelity single style)"
REPORT: f"  Primary source: '{primary_target}'"
REPORT: f"  Images: {images_glob}"

TRY:
    SlashCommand(extract_command)
CATCH error:
    ERROR: "Style extraction failed: {error}"
    ERROR: "Cannot proceed without design system"
    EXIT 1

# extract输出到: {base_path}/style-extraction/style-cards.json

# 验证提取结果
style_cards_path = "{base_path}/style-extraction/style-cards.json"

IF NOT exists(style_cards_path):
    ERROR: "extract command did not generate style-cards.json"
    ERROR: "Expected: {style_cards_path}"
    EXIT 1

style_cards = Read(style_cards_path)

IF len(style_cards.style_cards) != 1:
    ERROR: "Expected single variant in imitate mode, got {len(style_cards.style_cards)}"
    EXIT 1

extracted_style = style_cards.style_cards[0]

REPORT: ""
REPORT: "✅ Phase 2 complete:"
REPORT: "   Style: '{extracted_style.name}'"
REPORT: "   Philosophy: {extracted_style.design_philosophy}"
REPORT: "   Tokens: {count_tokens(extracted_style.proposed_tokens)} proposed tokens"

TodoWrite(mark_completed: "Extract unified design system",
          mark_in_progress: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation")
```

### Phase 3: Token处理（条件性Consolidate）

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 3: Token Processing"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF refine_tokens_mode:
    # 路径A：完整consolidate（生产级质量）
    REPORT: "🔧 Using full consolidate for production-ready tokens"
    REPORT: "   Benefits:"
    REPORT: "   • Philosophy-driven token refinement"
    REPORT: "   • WCAG AA accessibility validation"
    REPORT: "   • Complete design system documentation"
    REPORT: "   • Token gap filling and consistency checks"
    REPORT: ""

    consolidate_command = f"/workflow:ui-design:consolidate --base-path \"{base_path}\" --variants 1"

    REPORT: f"Calling consolidate command..."

    TRY:
        SlashCommand(consolidate_command)
    CATCH error:
        ERROR: "Token consolidation failed: {error}"
        ERROR: "Cannot proceed without refined tokens"
        EXIT 1

    # consolidate输出到: {base_path}/style-consolidation/style-1/design-tokens.json
    tokens_path = "{base_path}/style-consolidation/style-1/design-tokens.json"

    IF NOT exists(tokens_path):
        ERROR: "consolidate command did not generate design-tokens.json"
        ERROR: "Expected: {tokens_path}"
        EXIT 1

    REPORT: ""
    REPORT: "✅ Full consolidate complete"
    REPORT: "   Output: style-consolidation/style-1/"
    REPORT: "   Quality: Production-ready"
    token_quality = "production-ready (consolidated)"
    time_spent_estimate = "~60s"

ELSE:
    # 路径B：Fast Token Adaptation（快速路径）
    REPORT: "⚡ Fast token adaptation (skipping consolidate for speed)"
    REPORT: "   Note: Using proposed tokens from extraction phase"
    REPORT: "   For production quality, re-run with --refine-tokens flag"
    REPORT: ""

    # 直接复制proposed_tokens到consolidation目录
    style_cards = Read("{base_path}/style-extraction/style-cards.json")
    proposed_tokens = style_cards.style_cards[0].proposed_tokens

    # 创建目录并写入tokens
    consolidation_dir = "{base_path}/style-consolidation/style-1"
    Bash(mkdir -p "{consolidation_dir}")

    tokens_path = f"{consolidation_dir}/design-tokens.json"
    Write(tokens_path, JSON.stringify(proposed_tokens, null, 2))

    # 创建简化style guide
    variant = style_cards.style_cards[0]
    simple_guide = f"""# Design System: {variant.name}

## Design Philosophy
{variant.design_philosophy}

## Description
{variant.description}

## Design Tokens
All tokens in `design-tokens.json` follow OKLCH color space.

**Note**: Generated in fast-track imitate mode using proposed tokens from extraction.
For production-ready quality with philosophy-driven refinement, re-run with `--refine-tokens` flag.

## Color Preview
- Primary: {variant.preview.primary if variant.preview else "N/A"}
- Background: {variant.preview.background if variant.preview else "N/A"}

## Typography Preview
- Heading Font: {variant.preview.font_heading if variant.preview else "N/A"}

## Token Categories
{list_token_categories(proposed_tokens)}
"""

    Write(f"{consolidation_dir}/style-guide.md", simple_guide)

    REPORT: "✅ Fast adaptation complete (~2s vs ~60s with consolidate)"
    REPORT: "   Output: style-consolidation/style-1/"
    REPORT: "   Quality: Proposed (not refined)"
    REPORT: "   Time saved: ~30-60s"
    token_quality = "proposed (fast-track)"
    time_spent_estimate = "~2s"

REPORT: ""
REPORT: "Token processing summary:"
REPORT: "   Path: {refine_tokens_mode ? 'Full consolidate' : 'Fast adaptation'}"
REPORT: "   Quality: {token_quality}"
REPORT: "   Time: {time_spent_estimate}"

TodoWrite(mark_completed: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation",
          mark_in_progress: f"Generate UI for {len(target_names)} targets")
```

### Phase 4: 批量UI生成

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 4: Batch UI Generation"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 构建targets字符串
targets_string = ",".join(target_names)

# 调用generate-v2（智能token源检测会自动选择tokens）
generate_command = f"/workflow:ui-design:generate-v2 --base-path \"{base_path}\" --targets \"{targets_string}\" --target-type page --style-variants 1 --layout-variants 1"

REPORT: "Calling generate-v2 command..."
REPORT: f"  Targets: {targets_string}"
REPORT: f"  Configuration: 1 style × 1 layout × {len(target_names)} pages"
REPORT: f"  Token source: generate-v2 will auto-detect ({token_quality})"

TRY:
    SlashCommand(generate_command)
CATCH error:
    ERROR: "UI generation failed: {error}"
    ERROR: "Design tokens may be invalid"
    EXIT 1

# generate-v2输出到: {base_path}/prototypes/{target}-style-1-layout-1.html

# 验证生成结果
prototypes_dir = "{base_path}/prototypes"
generated_html_files = Glob(f"{prototypes_dir}/*-style-1-layout-1.html")
generated_count = len(generated_html_files)

REPORT: ""
REPORT: "✅ Phase 4 complete:"
REPORT: "   Generated: {generated_count} HTML prototypes"
REPORT: "   Targets: {', '.join(target_names)}"
REPORT: "   Output: {prototypes_dir}/"

IF generated_count < len(target_names):
    WARN: "   ⚠️ Expected {len(target_names)} prototypes, generated {generated_count}"
    WARN: "   Some targets may have failed - check generate-v2 output"

TodoWrite(mark_completed: f"Generate UI for {len(target_names)} targets",
          mark_in_progress: session_id ? "Integrate design system" : "Standalone completion")
```

### Phase 5: 设计系统集成

```bash
REPORT: ""
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "🚀 Phase 5: Design System Integration"
REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IF session_id:
    REPORT: "Integrating design system into session {session_id}..."

    update_command = f"/workflow:ui-design:update --session {session_id}"

    TRY:
        SlashCommand(update_command)
    CATCH error:
        WARN: "Design system integration failed: {error}"
        WARN: "Prototypes are still available at {base_path}/prototypes/"
        # 不终止，因为prototypes已经生成

    REPORT: "✅ Design system integrated into session {session_id}"
ELSE:
    REPORT: "ℹ️ Standalone mode: Skipping integration"
    REPORT: "   Prototypes available at: {base_path}/prototypes/"
    REPORT: "   To integrate later:"
    REPORT: "   1. Create a workflow session"
    REPORT: "   2. Copy design-tokens.json to session artifacts"

# 更新元数据
metadata = Read("{base_path}/.run-metadata.json")
metadata.status = "completed"
metadata.completion_time = current_timestamp()
metadata.outputs = {
    "screenshots": f"{base_path}/screenshots/",
    "style_system": f"{base_path}/style-consolidation/style-1/",
    "prototypes": f"{base_path}/prototypes/",
    "token_quality": token_quality,
    "captured_count": captured_count,
    "generated_count": generated_count
}
Write("{base_path}/.run-metadata.json", JSON.stringify(metadata, null, 2))

TodoWrite(mark_completed: session_id ? "Integrate design system" : "Standalone completion")
```

### Phase 6: 完成报告

```javascript
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "completed", activeForm: "Initializing"},
  {content: f"Batch screenshot capture ({len(target_names)} targets)", status: "completed", activeForm: "Capturing"},
  {content: "Extract unified design system", status: "completed", activeForm: "Extracting"},
  {content: refine_tokens_mode ? "Refine design tokens via consolidate" : "Fast token adaptation", status: "completed", activeForm: "Processing"},
  {content: f"Generate UI for {len(target_names)} targets", status: "completed", activeForm: "Generating"},
  {content: session_id ? "Integrate design system" : "Standalone completion", status: "completed", activeForm: "Completing"}
]});
```

**Completion Message**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ UI Design Imitate-Auto V3 Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ 📊 Workflow Summary ━━━

Mode: Batch Multi-Page Replication
Session: {session_id or "standalone"}
Run ID: {run_id}

Phase 1 - Screenshot Capture: ✅ {captured_count}/{total_requested} screenshots
  {IF captured_count < total_requested: f"⚠️ {total_requested - captured_count} missing" ELSE: "All targets captured"}

Phase 2 - Style Extraction: ✅ Single unified design system
  Style: {extracted_style.name}
  Philosophy: {extracted_style.design_philosophy[:80]}...

Phase 3 - Token Processing: ✅ {token_quality}
  {IF refine_tokens_mode:
    "Full consolidate (~60s)"
    "Quality: Production-ready with philosophy-driven refinement"
  ELSE:
    "Fast adaptation (~2s, saved ~30-60s)"
    "Quality: Proposed tokens (for production, use --refine-tokens)"
  }

Phase 4 - UI Generation: ✅ {generated_count} pages generated
  Targets: {', '.join(target_names)}
  Configuration: 1 style × 1 layout × {generated_count} pages

Phase 5 - Integration: {IF session_id: "✅ Integrated into session" ELSE: "⏭️ Standalone mode"}

━━━ 📂 Output Structure ━━━

{base_path}/
├── screenshots/                    # {captured_count} screenshots
│   ├── {target1}.png
│   ├── {target2}.png
│   └── capture-metadata.json
├── style-extraction/               # Design analysis
│   └── style-cards.json
├── style-consolidation/            # {token_quality}
│   └── style-1/
│       ├── design-tokens.json
│       └── style-guide.md
└── prototypes/                     # {generated_count} HTML/CSS files
    ├── {target1}-style-1-layout-1.html + .css
    ├── {target2}-style-1-layout-1.html + .css
    ├── compare.html                # Interactive preview
    └── index.html                  # Quick navigation

━━━ ⚡ Performance ━━━

Total workflow time: ~{estimate_total_time()} minutes
  Screenshot capture: ~{capture_time}
  Style extraction: ~{extract_time}
  Token processing: ~{token_processing_time}
  UI generation: ~{generate_time}

vs imitate-auto v1: ✅ Batch support ({len(target_names)} pages vs 1 page limit)
vs explore-auto: ✅ ~2-3× faster (single style focus{" + skipped consolidate" if not refine_tokens_mode else ""})

━━━ 🌐 Next Steps ━━━

1. Preview prototypes:
   • Interactive matrix: Open {base_path}/prototypes/compare.html
   • Quick navigation: Open {base_path}/prototypes/index.html

{IF session_id:
2. Create implementation tasks:
   /workflow:plan --session {session_id}

3. Generate tests (if needed):
   /workflow:test-gen {session_id}
ELSE:
2. To integrate into a workflow session:
   • Create session: /workflow:session:start
   • Copy design-tokens.json to session artifacts

3. Explore prototypes in {base_path}/prototypes/ directory
}

{IF NOT refine_tokens_mode:
💡 Production Quality Tip:
   Fast-track mode used proposed tokens for speed.
   For production-ready quality with full token refinement:
   /workflow:ui-design:imitate-auto-v3 --url-map "{url_map_command_string}" --refine-tokens {f"--session {session_id}" if session_id else ""}
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## TodoWrite Pattern

```javascript
// Initialize (Phase 0)
TodoWrite({todos: [
  {content: "Initialize and parse url-map", status: "in_progress", activeForm: "Initializing"},
  {content: "Batch screenshot capture", status: "pending", activeForm: "Capturing screenshots"},
  {content: "Extract unified design system", status: "pending", activeForm: "Extracting style"},
  {content: refine_tokens ? "Refine tokens via consolidate" : "Fast token adaptation", status: "pending", activeForm: "Processing tokens"},
  {content: "Generate UI for all targets", status: "pending", activeForm: "Generating UI"},
  {content: "Integrate design system", status: "pending", activeForm: "Integrating"}
]})

// Update after each phase: Mark current completed, next in_progress
```

## Error Handling

### Pre-execution Checks
- **url-map format validation**: Clear error message with format example
- **Empty url-map**: Error and exit
- **Invalid target names**: Regex validation with suggestions

### Phase-Specific Errors
- **Screenshot capture failure (Phase 1)**:
  - If total_captured == 0: Terminate workflow
  - If partial failure: Warn but continue with available screenshots

- **Style extraction failure (Phase 2)**:
  - If extract fails: Terminate with clear error
  - If style-cards.json missing: Terminate with debugging info

- **Token processing failure (Phase 3)**:
  - Consolidate mode: Terminate if consolidate fails
  - Fast mode: Validate proposed_tokens exist before copying

- **UI generation failure (Phase 4)**:
  - If generate-v2 fails: Terminate with error
  - If generated_count < target_count: Warn but proceed

- **Integration failure (Phase 5)**:
  - Non-blocking: Warn but don't terminate
  - Prototypes already available

### Recovery Strategies
- **Partial screenshot failure**: Continue with available screenshots, list missing in warning
- **Generate failure**: Report specific target failures, user can re-generate individually
- **Integration failure**: Prototypes still usable, can integrate manually


## Integration Points

- **Input**: `--url-map` (multiple target:url pairs) + optional `--session`, `--refine-tokens`, `--prompt`
- **Output**: Complete design system in `{base_path}/` (screenshots, style-extraction, style-consolidation, prototypes)
- **Sub-commands Called**:
  1. `/workflow:ui-design:capture` (Phase 1)
  2. `/workflow:ui-design:extract` (Phase 2)
  3. `/workflow:ui-design:consolidate` (Phase 3, conditional)
  4. `/workflow:ui-design:generate-v2` (Phase 4)
  5. `/workflow:ui-design:update` (Phase 5, if --session)
- **Deprecates**: `imitate-auto.md` (v1, single URL only)

