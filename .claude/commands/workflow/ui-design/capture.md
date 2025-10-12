---
name: capture
description: Batch screenshot capture for UI design workflows using MCP or local fallback
argument-hint: --url-map "target:url,..." [--base-path path] [--session id]
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), ListMcpResourcesTool(*), mcp__chrome-devtools__*, mcp__playwright__*
---

# Batch Screenshot Capture (/workflow:ui-design:capture)

## Overview
Batch screenshot tool with MCP-first strategy and multi-tier fallback. Processes multiple URLs in parallel.

**Strategy**: MCP → Playwright → Chrome → Manual
**Output**: Flat structure `screenshots/{target}.png`

## Phase 1: Initialize & Parse

### Step 1: Determine Base Path
```bash
# Priority: --base-path > session > standalone
bash(if [ -n "$BASE_PATH" ]; then
  echo "$BASE_PATH"
elif [ -n "$SESSION_ID" ]; then
  find .workflow/WFS-$SESSION_ID/design-* -type d | head -1 || \
  echo ".workflow/WFS-$SESSION_ID/design-run-$(date +%Y%m%d-%H%M%S)"
else
  echo ".workflow/.design/run-$(date +%Y%m%d-%H%M%S)"
fi)

bash(mkdir -p $BASE_PATH/screenshots)
```

### Step 2: Parse URL Map
```javascript
// Input: "home:https://linear.app, pricing:https://linear.app/pricing"
url_entries = []

FOR pair IN split(params["--url-map"], ","):
  parts = pair.split(":", 1)

  IF len(parts) != 2:
    ERROR: "Invalid format: {pair}. Expected: 'target:url'"
    EXIT 1

  target = parts[0].strip().lower().replace(" ", "-")
  url = parts[1].strip()

  // Validate target name
  IF NOT regex_match(target, r"^[a-z0-9][a-z0-9_-]*$"):
    ERROR: "Invalid target: {target}"
    EXIT 1

  // Add https:// if missing
  IF NOT url.startswith("http"):
    url = f"https://{url}"

  url_entries.append({target, url})
```

**Output**: `base_path`, `url_entries[]`

### Step 3: Initialize Todos
```javascript
TodoWrite({todos: [
  {content: "Parse url-map", status: "completed", activeForm: "Parsing"},
  {content: "Detect MCP tools", status: "in_progress", activeForm: "Detecting"},
  {content: "Capture screenshots", status: "pending", activeForm: "Capturing"},
  {content: "Verify results", status: "pending", activeForm: "Verifying"}
]})
```

## Phase 2: Detect Screenshot Tools

### Step 1: Check MCP Availability
```javascript
// List available MCP servers
all_resources = ListMcpResourcesTool()
available_servers = unique([r.server for r in all_resources])

// Check Chrome DevTools MCP
chrome_devtools = "chrome-devtools" IN available_servers
chrome_screenshot = check_tool_exists("mcp__chrome-devtools__take_screenshot")

// Check Playwright MCP
playwright_mcp = "playwright" IN available_servers
playwright_screenshot = check_tool_exists("mcp__playwright__screenshot")

// Determine primary tool
IF chrome_devtools AND chrome_screenshot:
  tool = "chrome-devtools"
ELSE IF playwright_mcp AND playwright_screenshot:
  tool = "playwright"
ELSE:
  tool = null
```

**Output**: `tool` (chrome-devtools | playwright | null)

### Step 2: Check Local Fallback
```bash
# Only if MCP unavailable
bash(which playwright 2>/dev/null || echo "")
bash(which google-chrome || which chrome || which chromium 2>/dev/null || echo "")
```

**Output**: `local_tools[]`

## Phase 3: Capture Screenshots

### Screenshot Format Options

**PNG Format** (default, lossless):
- **Pros**: Lossless quality, best for detailed UI screenshots
- **Cons**: Larger file sizes (typically 200-500 KB per screenshot)
- **Parameters**: `format: "png"` (no quality parameter)
- **Use case**: High-fidelity UI replication, design system extraction

**WebP Format** (optional, lossy/lossless):
- **Pros**: Smaller file sizes with good quality (50-70% smaller than PNG)
- **Cons**: Requires quality parameter, slight quality loss at high compression
- **Parameters**: `format: "webp", quality: 90` (80-100 recommended)
- **Use case**: Batch captures, network-constrained environments

**JPEG Format** (optional, lossy):
- **Pros**: Smallest file sizes
- **Cons**: Lossy compression, not recommended for UI screenshots
- **Parameters**: `format: "jpeg", quality: 90`
- **Use case**: Photo-heavy pages, not recommended for UI design

### Step 1: MCP Capture (If Available)
```javascript
IF tool == "chrome-devtools":
  // Get or create page
  pages = mcp__chrome-devtools__list_pages()

  IF pages.length == 0:
    mcp__chrome-devtools__new_page({url: url_entries[0].url})
    page_idx = 0
  ELSE:
    page_idx = 0

  mcp__chrome-devtools__select_page({pageIdx: page_idx})

  // Capture each URL
  FOR entry IN url_entries:
    mcp__chrome-devtools__navigate_page({url: entry.url, timeout: 30000})
    bash(sleep 2)

    // PNG format doesn't support quality parameter
    // Use PNG for lossless quality (larger files)
    mcp__chrome-devtools__take_screenshot({
      fullPage: true,
      format: "png",
      filePath: f"{base_path}/screenshots/{entry.target}.png"
    })

    // Alternative: Use WebP with quality for smaller files
    // mcp__chrome-devtools__take_screenshot({
    //   fullPage: true,
    //   format: "webp",
    //   quality: 90,
    //   filePath: f"{base_path}/screenshots/{entry.target}.webp"
    // })

ELSE IF tool == "playwright":
  FOR entry IN url_entries:
    mcp__playwright__screenshot({
      url: entry.url,
      output_path: f"{base_path}/screenshots/{entry.target}.png",
      full_page: true,
      timeout: 30000
    })
```

### Step 2: Local Fallback (If MCP Failed)
```bash
# Try Playwright CLI
bash(playwright screenshot "$url" "$output_file" --full-page --timeout 30000)

# Try Chrome headless
bash($chrome --headless --screenshot="$output_file" --window-size=1920,1080 "$url")
```

### Step 3: Manual Mode (If All Failed)
```
⚠️ Manual Screenshot Required

Failed URLs:
  home: https://linear.app
  Save to: .workflow/.design/run-20250110/screenshots/home.png

Steps:
  1. Visit URL in browser
  2. Take full-page screenshot
  3. Save to path above
  4. Type 'ready' to continue

Options: ready | skip | abort
```

## Phase 4: Verification

### Step 1: Scan Captured Files
```bash
bash(ls -1 $base_path/screenshots/*.{png,jpg,jpeg,webp} 2>/dev/null)
bash(du -h $base_path/screenshots/*.png 2>/dev/null)
```

### Step 2: Generate Metadata
```javascript
captured_files = Glob(f"{base_path}/screenshots/*.{{png,jpg,jpeg,webp}}")
captured_targets = [basename_no_ext(f) for f in captured_files]

metadata = {
  "timestamp": current_timestamp(),
  "total_requested": len(url_entries),
  "total_captured": len(captured_targets),
  "screenshots": []
}

FOR entry IN url_entries:
  is_captured = entry.target IN captured_targets

  metadata.screenshots.append({
    "target": entry.target,
    "url": entry.url,
    "captured": is_captured,
    "path": f"{base_path}/screenshots/{entry.target}.png" IF is_captured ELSE null,
    "size_kb": file_size_kb IF is_captured ELSE null
  })

Write(f"{base_path}/screenshots/capture-metadata.json", JSON.stringify(metadata))
```

**Output**: `capture-metadata.json`

## Completion

### Todo Update
```javascript
TodoWrite({todos: [
  {content: "Parse url-map", status: "completed", activeForm: "Parsing"},
  {content: "Detect MCP tools", status: "completed", activeForm: "Detecting"},
  {content: "Capture screenshots", status: "completed", activeForm: "Capturing"},
  {content: "Verify results", status: "completed", activeForm: "Verifying"}
]})
```

### Output Message
```
✅ Batch screenshot capture complete!

Summary:
- Requested: {total_requested}
- Captured: {total_captured}
- Success rate: {success_rate}%
- Method: {tool || "Local fallback"}

Output:
{base_path}/screenshots/
├── home.png (245.3 KB)
├── pricing.png (198.7 KB)
└── capture-metadata.json

Next: /workflow:ui-design:extract --images "screenshots/*.png"
```

## Simple Bash Commands

### Path Operations
```bash
# Find design directory
bash(find .workflow -type d -name "design-*" | head -1)

# Create screenshot directory
bash(mkdir -p $BASE_PATH/screenshots)
```

### Tool Detection
```bash
# Check MCP
all_resources = ListMcpResourcesTool()

# Check local tools
bash(which playwright 2>/dev/null)
bash(which google-chrome 2>/dev/null)
```

### Verification
```bash
# List captures
bash(ls -1 $base_path/screenshots/*.png 2>/dev/null)

# File sizes
bash(du -h $base_path/screenshots/*.png)
```

## Output Structure

```
{base_path}/
└── screenshots/
    ├── home.png
    ├── pricing.png
    ├── about.png
    └── capture-metadata.json
```

## Error Handling

### Common Errors
```
ERROR: Invalid url-map format
→ Use: "target:url, target2:url2"

ERROR: png screenshots do not support 'quality'
→ PNG format is lossless, no quality parameter needed
→ Remove quality parameter OR switch to webp/jpeg format

ERROR: MCP unavailable
→ Using local fallback

ERROR: All tools failed
→ Manual mode activated
```

### Format-Specific Errors
```
❌ Wrong: format: "png", quality: 90
✅ Right: format: "png"

✅ Or use: format: "webp", quality: 90
✅ Or use: format: "jpeg", quality: 90
```

### Recovery
- **Partial success**: Keep successful captures
- **Retry**: Re-run with failed targets only
- **Manual**: Follow interactive guidance

## Quality Checklist

- [ ] All requested URLs processed
- [ ] File sizes > 1KB (valid images)
- [ ] Metadata JSON generated
- [ ] No missing targets (or documented)

## Key Features

- **MCP-first**: Prioritize managed tools
- **Multi-tier fallback**: 4 layers (MCP → Local → Manual)
- **Batch processing**: Parallel capture
- **Error tolerance**: Partial failures handled
- **Structured output**: Flat, predictable

## Integration

**Input**: `--url-map` (multiple target:url pairs)
**Output**: `screenshots/*.png` + `capture-metadata.json`
**Called by**: `/workflow:ui-design:imitate-auto`, `/workflow:ui-design:explore-auto`
**Next**: `/workflow:ui-design:extract` or `/workflow:ui-design:explore-layers`
