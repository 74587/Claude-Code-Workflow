# Phase 4: Screenshot Capture

Capture screenshots using Chrome MCP for all identified UI elements.

## Objective

- Check Chrome MCP availability
- Start development server
- Capture all required screenshots
- Convert to Base64 for embedding

## Prerequisites

- Chrome MCP configured and available
- Development server can be started
- All screenshot URLs accessible

## Execution Steps

### Step 1: Load Screenshot List

```javascript
const consolidation = Read(`${workDir}/consolidation-summary.md`);
const config = JSON.parse(Read(`${workDir}/manual-config.json`));

// Parse screenshot table from consolidation
const screenshots = parseScreenshotTable(consolidation);
```

### Step 2: Check Chrome MCP Availability

```javascript
async function checkChromeMCP() {
  try {
    // Attempt to call Chrome MCP
    const version = await mcp__chrome__getVersion();
    return {
      available: true,
      version: version.version,
      browser: version.browser
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

const chromeMCP = await checkChromeMCP();

if (!chromeMCP.available) {
  // Fallback: generate manual screenshot instructions
  generateManualScreenshotGuide(screenshots);
  return {
    status: 'skipped',
    reason: 'Chrome MCP not available',
    manual_guide: `${workDir}/screenshots/MANUAL_CAPTURE.md`
  };
}
```

### Step 3: Start Development Server

```javascript
const devConfig = config.screenshot_config;

// Start dev server in background
const serverTask = Bash({
  command: devConfig.dev_command,
  run_in_background: true
});

// Wait for server to be ready
async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch (e) {
      // Server not ready yet
    }
    await sleep(1000);
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

await waitForServer(devConfig.dev_url, devConfig.wait_timeout);
```

### Step 4: Batch Screenshot Capture

```javascript
const capturedScreenshots = [];
const failedScreenshots = [];

for (const ss of screenshots) {
  try {
    const fullUrl = new URL(ss.url, devConfig.dev_url).href;

    // Configure capture options
    const captureOptions = {
      url: fullUrl,
      viewport: { width: 1280, height: 800 },
      fullPage: ss.fullPage || false,
      waitFor: ss.wait_for || null,
      delay: 500  // Wait for animations
    };

    // Add selector for partial screenshot
    if (ss.selector) {
      captureOptions.selector = ss.selector;
    }

    // Capture screenshot
    const result = await mcp__chrome__screenshot(captureOptions);

    // Save screenshot
    const filename = `${ss.id}.png`;
    Write(`${workDir}/screenshots/${filename}`, result.data, { encoding: 'base64' });

    capturedScreenshots.push({
      ...ss,
      file: filename,
      base64_size: result.data.length,
      captured_at: new Date().toISOString()
    });

  } catch (error) {
    failedScreenshots.push({
      ...ss,
      error: error.message
    });
  }
}
```

### Step 5: Generate Screenshot Manifest

```javascript
const manifest = {
  total: screenshots.length,
  captured: capturedScreenshots.length,
  failed: failedScreenshots.length,
  screenshots: capturedScreenshots,
  failures: failedScreenshots,
  dev_server: {
    url: devConfig.dev_url,
    command: devConfig.dev_command
  },
  capture_config: {
    viewport: { width: 1280, height: 800 },
    format: 'png'
  },
  timestamp: new Date().toISOString()
};

Write(`${workDir}/screenshots/screenshots-manifest.json`, JSON.stringify(manifest, null, 2));
```

### Step 6: Stop Development Server

```javascript
// Kill the dev server process
KillShell({ shell_id: serverTask.task_id });
```

### Step 7: Handle Failures

If any screenshots failed:

```javascript
if (failedScreenshots.length > 0) {
  // Generate manual capture instructions
  const manualGuide = `
# Manual Screenshot Capture Required

The following screenshots could not be captured automatically:

${failedScreenshots.map(s => `
## ${s.id}
- **URL**: ${s.url}
- **Description**: ${s.description}
- **Error**: ${s.error}

**Instructions**:
1. Navigate to ${s.url}
2. Capture screenshot of ${s.selector || 'full page'}
3. Save as \`${s.id}.png\`
4. Place in \`screenshots/\` directory
`).join('\n')}
`;

  Write(`${workDir}/screenshots/MANUAL_CAPTURE.md`, manualGuide);
}
```

## Fallback: Manual Screenshot Mode

When Chrome MCP is not available:

```javascript
function generateManualScreenshotGuide(screenshots) {
  const guide = `
# Manual Screenshot Capture Guide

Chrome MCP is not available. Please capture screenshots manually.

## Setup

1. Start your development server:
   \`\`\`bash
   ${config.screenshot_config.dev_command}
   \`\`\`

2. Open browser to: ${config.screenshot_config.dev_url}

## Screenshots Required

${screenshots.map((s, i) => `
### ${i + 1}. ${s.id}
- **URL**: ${s.url}
- **Description**: ${s.description}
- **Save as**: \`screenshots/${s.id}.png\`
${s.selector ? `- **Element**: Capture only \`${s.selector}\`` : '- **Type**: Full page'}
`).join('\n')}

## After Capturing

Place all PNG files in the \`screenshots/\` directory, then run Phase 5 to continue.
`;

  Write(`${workDir}/screenshots/MANUAL_CAPTURE.md`, guide);
}
```

## Chrome MCP Configuration Reference

Expected MCP configuration:

```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-chrome"],
      "env": {
        "CHROME_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      }
    }
  }
}
```

## Output

- **Files**: `screenshots/*.png`
- **Manifest**: `screenshots/screenshots-manifest.json`
- **Fallback**: `screenshots/MANUAL_CAPTURE.md` (if needed)

## Quality Checks

- [ ] All high-priority screenshots captured
- [ ] Screenshot dimensions consistent (1280x800)
- [ ] No broken/blank screenshots
- [ ] Manifest file complete

## Next Phase

Proceed to [Phase 5: HTML Assembly](05-html-assembly.md) with captured screenshots.
