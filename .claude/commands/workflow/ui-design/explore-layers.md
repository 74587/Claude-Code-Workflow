---
name: explore-layers
description: Interactive deep UI capture with depth-controlled layer exploration
usage: /workflow:ui-design:explore-layers --url <url> --depth <1-5> [--session <id>] [--base-path <path>]
argument-hint: --url <url> --depth <1-5> [--session id] [--base-path path]
examples:
  - /workflow:ui-design:explore-layers --url "https://app.linear.app" --depth 3
  - /workflow:ui-design:explore-layers --url "https://notion.so" --depth 2 --session WFS-notion-ui
  - /workflow:ui-design:explore-layers --url "https://app.com/dashboard" --depth 4
allowed-tools: TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), mcp__chrome-devtools__*
---

# Interactive Layer Exploration (/workflow:ui-design:explore-layers)

## Overview
Single-URL depth-controlled interactive capture. Progressively explores UI layers from pages to Shadow DOM.

**Depth Levels**:
- `1` = Page (full-page screenshot)
- `2` = Elements (key components)
- `3` = Interactions (modals, dropdowns)
- `4` = Embedded (iframes, widgets)
- `5` = Shadow DOM (web components)

**Requirements**: Chrome DevTools MCP

## Phase 1: Setup & Validation

### Step 1: Parse Parameters
```javascript
url = params["--url"]
depth = int(params["--depth"])

// Validate URL
IF NOT url.startswith("http"):
  url = f"https://{url}"

// Validate depth
IF depth NOT IN [1, 2, 3, 4, 5]:
  ERROR: "Invalid depth: {depth}. Use 1-5"
  EXIT 1
```

### Step 2: Determine Base Path
```bash
bash(if [ -n "$BASE_PATH" ]; then
  echo "$BASE_PATH"
elif [ -n "$SESSION_ID" ]; then
  find .workflow/WFS-$SESSION_ID/design-* -type d | head -1 || \
  echo ".workflow/WFS-$SESSION_ID/design-layers-$(date +%Y%m%d-%H%M%S)"
else
  echo ".workflow/.design/layers-$(date +%Y%m%d-%H%M%S)"
fi)

# Create depth directories
bash(for i in $(seq 1 $depth); do mkdir -p $BASE_PATH/screenshots/depth-$i; done)
```

**Output**: `url`, `depth`, `base_path`

### Step 3: Validate MCP Availability
```javascript
all_resources = ListMcpResourcesTool()
chrome_devtools = "chrome-devtools" IN [r.server for r in all_resources]

IF NOT chrome_devtools:
  ERROR: "explore-layers requires Chrome DevTools MCP"
  ERROR: "Install: npm i -g @modelcontextprotocol/server-chrome-devtools"
  EXIT 1
```

### Step 4: Initialize Todos
```javascript
todos = [
  {content: "Setup and validation", status: "completed", activeForm: "Setting up"}
]

FOR level IN range(1, depth + 1):
  todos.append({
    content: f"Depth {level}: {DEPTH_NAMES[level]}",
    status: "pending",
    activeForm: f"Capturing depth {level}"
  })

todos.append({content: "Generate layer map", status: "pending", activeForm: "Mapping"})

TodoWrite({todos})
```

## Phase 2: Navigate & Load Page

### Step 1: Get or Create Browser Page
```javascript
pages = mcp__chrome-devtools__list_pages()

IF pages.length == 0:
  mcp__chrome-devtools__new_page({url: url, timeout: 30000})
  page_idx = 0
ELSE:
  page_idx = 0
  mcp__chrome-devtools__select_page({pageIdx: page_idx})
  mcp__chrome-devtools__navigate_page({url: url, timeout: 30000})

bash(sleep 3)  // Wait for page load
```

**Output**: `page_idx`

## Phase 3: Depth 1 - Page Level

### Step 1: Capture Full Page
```javascript
TodoWrite(mark_in_progress: "Depth 1: Page")

output_file = f"{base_path}/screenshots/depth-1/full-page.png"

mcp__chrome-devtools__take_screenshot({
  fullPage: true,
  format: "png",
  quality: 90,
  filePath: output_file
})

layer_map = {
  "url": url,
  "depth": depth,
  "layers": {
    "depth-1": {
      "type": "page",
      "captures": [{
        "name": "full-page",
        "path": output_file,
        "size_kb": file_size_kb(output_file)
      }]
    }
  }
}

TodoWrite(mark_completed: "Depth 1: Page")
```

**Output**: `depth-1/full-page.png`

## Phase 4: Depth 2 - Element Level (If depth >= 2)

### Step 1: Analyze Page Structure
```javascript
IF depth < 2: SKIP

TodoWrite(mark_in_progress: "Depth 2: Elements")

snapshot = mcp__chrome-devtools__take_snapshot()

// Filter key elements
key_types = ["nav", "header", "footer", "aside", "button", "form", "article"]
key_elements = [
  el for el in snapshot.interactiveElements
  if el.type IN key_types OR el.role IN ["navigation", "banner", "main"]
][:10]  // Limit to top 10
```

### Step 2: Capture Element Screenshots
```javascript
depth_2_captures = []

FOR idx, element IN enumerate(key_elements):
  element_name = sanitize(element.text[:20] or element.type) or f"element-{idx}"
  output_file = f"{base_path}/screenshots/depth-2/{element_name}.png"

  TRY:
    mcp__chrome-devtools__take_screenshot({
      uid: element.uid,
      format: "png",
      quality: 85,
      filePath: output_file
    })

    depth_2_captures.append({
      "name": element_name,
      "type": element.type,
      "path": output_file,
      "size_kb": file_size_kb(output_file)
    })
  CATCH error:
    REPORT: f"Skip {element_name}: {error}"

layer_map.layers["depth-2"] = {
  "type": "elements",
  "captures": depth_2_captures
}

TodoWrite(mark_completed: "Depth 2: Elements")
```

**Output**: `depth-2/{element}.png` × N

## Phase 5: Depth 3 - Interaction Level (If depth >= 3)

### Step 1: Analyze Interactive Triggers
```javascript
IF depth < 3: SKIP

TodoWrite(mark_in_progress: "Depth 3: Interactions")

// Detect structure
structure = mcp__chrome-devtools__evaluate_script({
  function: `() => ({
    modals: document.querySelectorAll('[role="dialog"], .modal').length,
    dropdowns: document.querySelectorAll('[role="menu"], .dropdown').length,
    tooltips: document.querySelectorAll('[role="tooltip"], [title]').length
  })`
})

// Identify triggers
triggers = []
FOR element IN snapshot.interactiveElements:
  IF element.attributes CONTAINS ("data-toggle", "aria-haspopup"):
    triggers.append({
      uid: element.uid,
      type: "modal" IF "modal" IN element.classes ELSE "dropdown",
      trigger: "click",
      text: element.text
    })
  ELSE IF element.attributes CONTAINS ("title", "data-tooltip"):
    triggers.append({
      uid: element.uid,
      type: "tooltip",
      trigger: "hover",
      text: element.text
    })

triggers = triggers[:10]  // Limit
```

### Step 2: Trigger Interactions & Capture
```javascript
depth_3_captures = []

FOR idx, trigger IN enumerate(triggers):
  layer_name = f"{trigger.type}-{sanitize(trigger.text[:15]) or idx}"
  output_file = f"{base_path}/screenshots/depth-3/{layer_name}.png"

  TRY:
    // Trigger interaction
    IF trigger.trigger == "click":
      mcp__chrome-devtools__click({uid: trigger.uid})
    ELSE:
      mcp__chrome-devtools__hover({uid: trigger.uid})

    bash(sleep 1)

    // Capture
    mcp__chrome-devtools__take_screenshot({
      fullPage: false,  // Viewport only
      format: "png",
      quality: 90,
      filePath: output_file
    })

    depth_3_captures.append({
      "name": layer_name,
      "type": trigger.type,
      "trigger_method": trigger.trigger,
      "path": output_file,
      "size_kb": file_size_kb(output_file)
    })

    // Dismiss (ESC key)
    mcp__chrome-devtools__evaluate_script({
      function: `() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      }`
    })
    bash(sleep 0.5)

  CATCH error:
    REPORT: f"Skip {layer_name}: {error}"

layer_map.layers["depth-3"] = {
  "type": "interactions",
  "triggers": structure,
  "captures": depth_3_captures
}

TodoWrite(mark_completed: "Depth 3: Interactions")
```

**Output**: `depth-3/{interaction}.png` × N

## Phase 6: Depth 4 - Embedded Level (If depth >= 4)

### Step 1: Detect Iframes
```javascript
IF depth < 4: SKIP

TodoWrite(mark_in_progress: "Depth 4: Embedded")

iframes = mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return Array.from(document.querySelectorAll('iframe')).map(iframe => ({
      src: iframe.src,
      id: iframe.id || 'iframe',
      title: iframe.title || 'untitled'
    })).filter(i => i.src && i.src.startsWith('http'));
  }`
})
```

### Step 2: Capture Iframe Content
```javascript
depth_4_captures = []

FOR idx, iframe IN enumerate(iframes):
  iframe_name = f"iframe-{sanitize(iframe.title or iframe.id)}-{idx}"
  output_file = f"{base_path}/screenshots/depth-4/{iframe_name}.png"

  TRY:
    // Navigate to iframe URL in new tab
    mcp__chrome-devtools__new_page({url: iframe.src, timeout: 30000})
    bash(sleep 2)

    mcp__chrome-devtools__take_screenshot({
      fullPage: true,
      format: "png",
      quality: 90,
      filePath: output_file
    })

    depth_4_captures.append({
      "name": iframe_name,
      "url": iframe.src,
      "path": output_file,
      "size_kb": file_size_kb(output_file)
    })

    // Close iframe tab
    current_pages = mcp__chrome-devtools__list_pages()
    mcp__chrome-devtools__close_page({pageIdx: current_pages.length - 1})

  CATCH error:
    REPORT: f"Skip {iframe_name}: {error}"

layer_map.layers["depth-4"] = {
  "type": "embedded",
  "captures": depth_4_captures
}

TodoWrite(mark_completed: "Depth 4: Embedded")
```

**Output**: `depth-4/iframe-*.png` × N

## Phase 7: Depth 5 - Shadow DOM (If depth = 5)

### Step 1: Detect Shadow Roots
```javascript
IF depth < 5: SKIP

TodoWrite(mark_in_progress: "Depth 5: Shadow DOM")

shadow_elements = mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .filter(el => el.shadowRoot)
      .map((el, idx) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || \`shadow-\${idx}\`,
        innerHTML: el.shadowRoot.innerHTML.substring(0, 100)
      }));
  }`
})
```

### Step 2: Capture Shadow DOM Components
```javascript
depth_5_captures = []

FOR idx, shadow IN enumerate(shadow_elements):
  shadow_name = f"shadow-{sanitize(shadow.id)}"
  output_file = f"{base_path}/screenshots/depth-5/{shadow_name}.png"

  TRY:
    // Inject highlight script
    mcp__chrome-devtools__evaluate_script({
      function: `() => {
        const el = document.querySelector('${shadow.tag}${shadow.id ? "#" + shadow.id : ""}');
        if (el) {
          el.scrollIntoView({behavior: 'smooth', block: 'center'});
          el.style.outline = '3px solid red';
        }
      }`
    })

    bash(sleep 0.5)

    // Full-page screenshot (component highlighted)
    mcp__chrome-devtools__take_screenshot({
      fullPage: false,
      format: "png",
      quality: 90,
      filePath: output_file
    })

    depth_5_captures.append({
      "name": shadow_name,
      "tag": shadow.tag,
      "path": output_file,
      "size_kb": file_size_kb(output_file)
    })

  CATCH error:
    REPORT: f"Skip {shadow_name}: {error}"

layer_map.layers["depth-5"] = {
  "type": "shadow-dom",
  "captures": depth_5_captures
}

TodoWrite(mark_completed: "Depth 5: Shadow DOM")
```

**Output**: `depth-5/shadow-*.png` × N

## Phase 8: Generate Layer Map

### Step 1: Compile Metadata
```javascript
TodoWrite(mark_in_progress: "Generate layer map")

// Calculate totals
total_captures = sum(len(layer.captures) for layer in layer_map.layers.values())
total_size_kb = sum(
  sum(c.size_kb for c in layer.captures)
  for layer in layer_map.layers.values()
)

layer_map["summary"] = {
  "timestamp": current_timestamp(),
  "total_depth": depth,
  "total_captures": total_captures,
  "total_size_kb": total_size_kb
}

Write(f"{base_path}/screenshots/layer-map.json", JSON.stringify(layer_map, indent=2))

TodoWrite(mark_completed: "Generate layer map")
```

**Output**: `layer-map.json`

## Completion

### Todo Update
```javascript
all_todos_completed = true
TodoWrite({todos: all_completed_todos})
```

### Output Message
```
✅ Interactive layer exploration complete!

Configuration:
- URL: {url}
- Max depth: {depth}
- Layers explored: {len(layer_map.layers)}

Capture Summary:
  Depth 1 (Page):        {depth_1_count} screenshot(s)
  Depth 2 (Elements):    {depth_2_count} screenshot(s)
  Depth 3 (Interactions): {depth_3_count} screenshot(s)
  Depth 4 (Embedded):    {depth_4_count} screenshot(s)
  Depth 5 (Shadow DOM):  {depth_5_count} screenshot(s)

Total: {total_captures} captures ({total_size_kb:.1f} KB)

Output Structure:
{base_path}/screenshots/
├── depth-1/
│   └── full-page.png
├── depth-2/
│   ├── navbar.png
│   └── footer.png
├── depth-3/
│   ├── modal-login.png
│   └── dropdown-menu.png
├── depth-4/
│   └── iframe-analytics.png
├── depth-5/
│   └── shadow-button.png
└── layer-map.json

Next: /workflow:ui-design:extract --images "screenshots/**/*.png"
```

## Simple Bash Commands

### Directory Setup
```bash
# Create depth directories
bash(for i in $(seq 1 $depth); do mkdir -p $BASE_PATH/screenshots/depth-$i; done)
```

### Validation
```bash
# Check MCP
all_resources = ListMcpResourcesTool()

# Count captures per depth
bash(ls $base_path/screenshots/depth-{1..5}/*.png 2>/dev/null | wc -l)
```

### File Operations
```bash
# List all captures
bash(find $base_path/screenshots -name "*.png" -type f)

# Total size
bash(du -sh $base_path/screenshots)
```

## Output Structure

```
{base_path}/screenshots/
├── depth-1/
│   └── full-page.png
├── depth-2/
│   ├── {element}.png
│   └── ...
├── depth-3/
│   ├── {interaction}.png
│   └── ...
├── depth-4/
│   ├── iframe-*.png
│   └── ...
├── depth-5/
│   ├── shadow-*.png
│   └── ...
└── layer-map.json
```

## Depth Level Details

| Depth | Name | Captures | Time | Use Case |
|-------|------|----------|------|----------|
| 1 | Page | Full page | 30s | Quick preview |
| 2 | Elements | Key components | 1-2min | Component library |
| 3 | Interactions | Modals, dropdowns | 2-4min | UI flows |
| 4 | Embedded | Iframes | 3-6min | Complete context |
| 5 | Shadow DOM | Web components | 4-8min | Full coverage |

## Error Handling

### Common Errors
```
ERROR: Chrome DevTools MCP required
→ Install: npm i -g @modelcontextprotocol/server-chrome-devtools

ERROR: Invalid depth
→ Use: 1-5

ERROR: Interaction trigger failed
→ Some modals may be skipped, check layer-map.json
```

### Recovery
- **Partial success**: Lower depth captures preserved
- **Trigger failures**: Interaction layer may be incomplete
- **Iframe restrictions**: Cross-origin iframes skipped

## Quality Checklist

- [ ] All depths up to specified level captured
- [ ] layer-map.json generated with metadata
- [ ] File sizes valid (> 500 bytes)
- [ ] Interaction triggers executed
- [ ] Shadow DOM elements highlighted

## Key Features

- **Depth-controlled**: Progressive capture 1-5 levels
- **Interactive triggers**: Click/hover for hidden layers
- **Iframe support**: Embedded content captured
- **Shadow DOM**: Web component internals
- **Structured output**: Organized by depth

## Integration

**Input**: Single URL + depth level (1-5)
**Output**: Hierarchical screenshots + layer-map.json
**Complements**: `/workflow:ui-design:capture` (multi-URL batch)
**Next**: `/workflow:ui-design:extract` for design analysis
