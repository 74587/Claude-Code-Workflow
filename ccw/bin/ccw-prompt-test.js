#!/usr/bin/env node
/**
 * CCW Prompt Test Endpoint
 * 
 * 独立的提示词解析测试工具，用于调试不同格式的提示词传递。
 * 
 * Usage:
 *   node ccw/bin/ccw-prompt-test.js -p "prompt"        # 测试 -p 参数
 *   node ccw/bin/ccw-prompt-test.js -f file.txt        # 测试文件读取
 *   echo "prompt" | node ccw/bin/ccw-prompt-test.js    # 测试 stdin
 *   node ccw/bin/ccw-prompt-test.js --raw              # 原始 argv 输出
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

/**
 * Parse command line arguments manually (no dependencies)
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    prompt: undefined,
    file: undefined,
    tool: 'gemini',
    mode: 'analysis',
    raw: false,
    help: false,
    positional: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--raw') {
      result.raw = true;
    } else if (arg === '-p' || arg === '--prompt') {
      result.prompt = args[++i];
    } else if (arg === '-f' || arg === '--file') {
      result.file = args[++i];
    } else if (arg === '--tool') {
      result.tool = args[++i];
    } else if (arg === '--mode') {
      result.mode = args[++i];
    } else if (!arg.startsWith('-')) {
      result.positional.push(arg);
    }
  }

  return result;
}

/**
 * Read from stdin if available (non-TTY)
 */
function readStdin() {
  if (process.stdin.isTTY) {
    return null;
  }
  try {
    return readFileSync(0, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Analyze prompt content
 */
function analyzePrompt(prompt) {
  if (!prompt) return null;
  
  const analysis = {
    length: prompt.length,
    lines: prompt.split('\n').length,
    hasNewlines: prompt.includes('\n'),
    hasAtPatterns: /@[^\s]+/.test(prompt),
    atPatterns: [],
    hasBullets: /[•●○■□▪▫]/.test(prompt),
    hasMemory: /Memory:/i.test(prompt),
    sections: [],
  };

  // Extract @ patterns
  const atMatches = prompt.matchAll(/@[^\s|]+/g);
  analysis.atPatterns = Array.from(atMatches).map(m => m[0]);

  // Detect sections
  const sectionPatterns = ['PURPOSE', 'TASK', 'MODE', 'CONTEXT', 'EXPECTED', 'CONSTRAINTS'];
  for (const section of sectionPatterns) {
    if (new RegExp(`${section}:`, 'i').test(prompt)) {
      analysis.sections.push(section);
    }
  }

  return analysis;
}

/**
 * Print box
 */
function printBox(title, content, color = 'cyan') {
  const width = 70;
  const line = '─'.repeat(width);
  console.log(c(color, `┌${line}┐`));
  console.log(c(color, '│') + c('bold', ` ${title}`.padEnd(width)) + c(color, '│'));
  console.log(c(color, `├${line}┤`));
  
  const lines = content.split('\n');
  for (const l of lines) {
    const truncated = l.length > width - 2 ? l.substring(0, width - 5) + '...' : l;
    console.log(c(color, '│') + ` ${truncated}`.padEnd(width) + c(color, '│'));
  }
  console.log(c(color, `└${line}┘`));
}

/**
 * Main
 */
function main() {
  const parsed = parseArgs(process.argv);

  // Help
  if (parsed.help) {
    console.log(`
${c('bold', 'CCW Prompt Test Endpoint')}

${c('cyan', 'Usage:')}
  node ccw/bin/ccw-prompt-test.js -p "prompt"        Test -p argument
  node ccw/bin/ccw-prompt-test.js -f file.txt        Test file input
  echo "prompt" | node ccw/bin/ccw-prompt-test.js    Test stdin pipe
  node ccw/bin/ccw-prompt-test.js --raw              Show raw argv only

${c('cyan', 'Options:')}
  -p, --prompt <text>   Prompt text
  -f, --file <path>     Read prompt from file
  --tool <tool>         Tool name (default: gemini)
  --mode <mode>         Mode (default: analysis)
  --raw                 Show only raw process.argv
  -h, --help            Show this help

${c('cyan', 'Multi-line prompt methods:')}
  ${c('green', '1. Stdin pipe (recommended):')}
     echo "PURPOSE: Test
     TASK: Step 1" | node ccw/bin/ccw-prompt-test.js

  ${c('green', '2. File input:')}
     node ccw/bin/ccw-prompt-test.js -f prompt.txt

  ${c('green', '3. Heredoc:')}
     node ccw/bin/ccw-prompt-test.js << 'EOF'
     PURPOSE: Test
     TASK: Step 1
     EOF
`);
    return;
  }

  // Raw mode
  if (parsed.raw) {
    console.log(c('bold', '\nRaw process.argv:'));
    process.argv.forEach((arg, i) => {
      console.log(`  [${i}]: ${JSON.stringify(arg)}`);
    });
    return;
  }

  console.log(c('bold', '\n═══════════════════════════════════════════════════════════════════════'));
  console.log(c('bold', '  CCW PROMPT TEST ENDPOINT'));
  console.log(c('bold', '═══════════════════════════════════════════════════════════════════════\n'));

  // 1. Raw argv
  console.log(c('yellow', '📦 1. RAW PROCESS.ARGV:'));
  console.log(c('gray', `   Total: ${process.argv.length} arguments`));
  process.argv.forEach((arg, i) => {
    const display = arg.length > 60 ? arg.substring(0, 57) + '...' : arg;
    const hasNewline = arg.includes('\n');
    console.log(c('gray', `   [${i}]: `) + c(hasNewline ? 'green' : 'white', JSON.stringify(display)));
    if (hasNewline) {
      console.log(c('green', `        ↳ Contains ${arg.split('\n').length} lines (newlines preserved!)`));
    }
  });
  console.log();

  // 2. Parsed options
  console.log(c('yellow', '📋 2. PARSED OPTIONS:'));
  console.log(c('gray', '   --prompt: ') + (parsed.prompt ? c('green', JSON.stringify(parsed.prompt.substring(0, 50) + (parsed.prompt.length > 50 ? '...' : ''))) : c('dim', '(not set)')));
  console.log(c('gray', '   --file: ') + (parsed.file ? c('cyan', parsed.file) : c('dim', '(not set)')));
  console.log(c('gray', '   --tool: ') + c('white', parsed.tool));
  console.log(c('gray', '   --mode: ') + c('white', parsed.mode));
  console.log(c('gray', '   stdin.isTTY: ') + c(process.stdin.isTTY ? 'yellow' : 'green', String(process.stdin.isTTY)));
  console.log();

  // 3. Resolve final prompt
  console.log(c('yellow', '🎯 3. PROMPT RESOLUTION:'));
  let finalPrompt = null;
  let source = null;

  // Priority: file > stdin > -p > positional
  if (parsed.file) {
    source = 'file';
    const filePath = resolve(parsed.file);
    if (existsSync(filePath)) {
      finalPrompt = readFileSync(filePath, 'utf8').trim();
      console.log(c('gray', '   Source: ') + c('magenta', `--file (${filePath})`));
    } else {
      console.log(c('red', `   Error: File not found: ${filePath}`));
    }
  } else {
    const stdinContent = readStdin();
    if (stdinContent) {
      source = 'stdin';
      finalPrompt = stdinContent;
      console.log(c('gray', '   Source: ') + c('green', 'stdin (piped input)'));
    } else if (parsed.prompt) {
      source = '-p option';
      finalPrompt = parsed.prompt;
      console.log(c('gray', '   Source: ') + c('cyan', '--prompt/-p option'));
    } else if (parsed.positional.length > 0) {
      source = 'positional';
      finalPrompt = parsed.positional.join(' ');
      console.log(c('gray', '   Source: ') + c('yellow', 'positional argument'));
    } else {
      console.log(c('red', '   No prompt found!'));
    }
  }
  console.log();

  // 4. Prompt analysis
  if (finalPrompt) {
    const analysis = analyzePrompt(finalPrompt);
    
    console.log(c('yellow', '📊 4. PROMPT ANALYSIS:'));
    console.log(c('gray', '   Length: ') + c('white', `${analysis.length} chars`));
    console.log(c('gray', '   Lines: ') + c('white', String(analysis.lines)));
    console.log(c('gray', '   Has newlines: ') + c(analysis.hasNewlines ? 'green' : 'yellow', analysis.hasNewlines ? '✓ Yes' : '✗ No'));
    console.log(c('gray', '   Has @ patterns: ') + c(analysis.hasAtPatterns ? 'green' : 'dim', analysis.hasAtPatterns ? '✓ Yes' : '✗ No'));
    if (analysis.atPatterns.length > 0) {
      console.log(c('gray', '   @ patterns:'));
      analysis.atPatterns.forEach(p => console.log(c('blue', `      • ${p}`)));
    }
    console.log(c('gray', '   Has bullets: ') + c(analysis.hasBullets ? 'green' : 'dim', analysis.hasBullets ? '✓ Yes' : '✗ No'));
    console.log(c('gray', '   Has Memory: ') + c(analysis.hasMemory ? 'green' : 'dim', analysis.hasMemory ? '✓ Yes' : '✗ No'));
    if (analysis.sections.length > 0) {
      console.log(c('gray', '   Sections: ') + c('cyan', analysis.sections.join(', ')));
    }
    console.log();

    // 5. Final prompt content
    console.log(c('yellow', '📄 5. FINAL PROMPT CONTENT:'));
    printBox(`${source} → ${analysis.length} chars, ${analysis.lines} lines`, finalPrompt, 'green');
    console.log();

    // 6. Simulated CLI command
    console.log(c('yellow', '🚀 6. SIMULATED CLI EXECUTION:'));
    console.log(c('gray', '   Would execute:'));
    console.log(c('cyan', `   ${parsed.tool} cli --mode ${parsed.mode}`));
    console.log(c('gray', '   With prompt of ') + c('green', `${analysis.length} chars, ${analysis.lines} lines`));
  }

  console.log(c('bold', '\n═══════════════════════════════════════════════════════════════════════\n'));
}

main();
