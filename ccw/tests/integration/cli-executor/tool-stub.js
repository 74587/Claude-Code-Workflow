#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { globSync } from 'glob';

function parseEnhancedPrompt(prompt) {
  const fields = ['PURPOSE', 'TASK', 'MODE', 'CONTEXT', 'EXPECTED', 'RULES'];
  const out = {};
  for (const field of fields) {
    const line = prompt
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${field}:`));
    out[field.toLowerCase()] = line ? line.slice(field.length + 1).trim() : null;
  }
  return out;
}

function parseDirectives(prompt) {
  const lines = prompt.split(/\r?\n/);
  const directiveLine = lines.find((l) => l.startsWith('CCW_TEST_DIRECTIVES:'));
  if (!directiveLine) return null;
  const json = directiveLine.slice('CCW_TEST_DIRECTIVES:'.length).trim();
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseIncludeDirs(tool, args) {
  if (tool === 'gemini' || tool === 'qwen') {
    const idx = args.indexOf('--include-directories');
    if (idx >= 0 && typeof args[idx + 1] === 'string') {
      return String(args[idx + 1])
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }
    return [];
  }
  if (tool === 'codex') {
    const dirs = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--add-dir' && typeof args[i + 1] === 'string') {
        dirs.push(String(args[i + 1]));
        i++;
      }
    }
    return dirs;
  }
  return [];
}

function extractAtPatterns(prompt) {
  const patterns = [];
  const re = /(^|\s)@([^\s]+)/g;
  let match;
  while ((match = re.exec(prompt)) !== null) {
    const raw = match[2] || '';
    const cleaned = raw.replace(/[),;"']+$/g, '');
    if (cleaned) patterns.push(cleaned);
  }
  return patterns;
}

function normalizeSlash(value) {
  return String(value).replace(/\\/g, '/');
}

function isOutsideCwdPattern(pattern) {
  const p = normalizeSlash(pattern);
  return p.startsWith('../') || p.startsWith('..\\');
}

function isAllowedOutsidePattern(pattern, includeDirs) {
  const p = normalizeSlash(pattern);
  const include = includeDirs.map((d) => normalizeSlash(d));
  return include.some((dir) => p === dir || p.startsWith(`${dir}/`));
}

function resolvePatterns(prompt, tool, args) {
  const includeDirs = parseIncludeDirs(tool, args);
  const patterns = extractAtPatterns(prompt);

  const files = new Set();
  for (const pattern of patterns) {
    if (isOutsideCwdPattern(pattern) && !isAllowedOutsidePattern(pattern, includeDirs)) {
      continue;
    }
    const matches = globSync(pattern, {
      cwd: process.cwd(),
      nodir: true,
      dot: true,
      windowsPathsNoEscape: true,
    });
    for (const m of matches) files.add(normalizeSlash(m));
  }

  return Array.from(files).sort();
}

function safeWriteFiles(writeFiles) {
  const wrote = [];
  for (const [rel, content] of Object.entries(writeFiles || {})) {
    const abs = resolvePath(process.cwd(), String(rel));
    if (!abs.startsWith(resolvePath(process.cwd()))) continue;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, String(content ?? ''), 'utf8');
    wrote.push(String(rel));
  }
  return wrote.sort();
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buf += chunk;
    });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(buf));
  });
}

async function main() {
  const tool = String(process.argv[2] || 'unknown');
  const args = process.argv.slice(3).map(String);
  const prompt = await readStdin();

  const directives = parseDirectives(prompt) || {};
  const resolvedFiles = directives.resolve_patterns ? resolvePatterns(prompt, tool, args) : [];
  const wroteFiles = directives.write_files ? safeWriteFiles(directives.write_files) : [];

  const payload = {
    tool,
    cwd: normalizeSlash(process.cwd()),
    args,
    prompt,
    parsed: parseEnhancedPrompt(prompt),
    resolved_files: resolvedFiles,
    wrote_files: wroteFiles,
  };

  const stdoutText =
    typeof directives.stdout === 'string' ? directives.stdout : `${JSON.stringify(payload)}\n`;
  const stderrText = typeof directives.stderr === 'string' ? directives.stderr : '';
  const exitCode = Number.isFinite(Number(directives.exit_code)) ? Number(directives.exit_code) : 0;
  const sleepMs = Number.isFinite(Number(directives.sleep_ms)) ? Number(directives.sleep_ms) : 0;

  if (sleepMs > 0) {
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  process.stdout.write(stdoutText);
  if (stderrText) process.stderr.write(stderrText);
  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err?.message || err));
  process.exit(1);
});

