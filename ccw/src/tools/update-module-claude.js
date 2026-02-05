/**
 * Update Module CLAUDE.md Tool
 * Generate/update CLAUDE.md module documentation using CLI tools
 */

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve, basename, extname } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

// Directories to exclude
const EXCLUDE_DIRS = [
  '.git', '__pycache__', 'node_modules', '.venv', 'venv', 'env',
  'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  'coverage', '.nyc_output', 'logs', 'tmp', 'temp'
];

/**
 * Count files in directory
 */
function countFiles(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile() && !e.name.startsWith('.')).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Scan directory structure
 */
function scanDirectoryStructure(targetPath, strategy) {
  const lines = [];
  const dirName = basename(targetPath);

  let totalFiles = 0;
  let totalDirs = 0;

  function countRecursive(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      entries.forEach(e => {
        if (e.name.startsWith('.') || EXCLUDE_DIRS.includes(e.name)) return;
        if (e.isFile()) totalFiles++;
        else if (e.isDirectory()) {
          totalDirs++;
          countRecursive(join(dir, e.name));
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  countRecursive(targetPath);

  lines.push(`Directory: ${dirName}`);
  lines.push(`Total files: ${totalFiles}`);
  lines.push(`Total directories: ${totalDirs}`);
  lines.push('');

  if (strategy === 'multi-layer') {
    lines.push('Subdirectories with files:');
    // List subdirectories with file counts
    function listSubdirs(dir, prefix = '') {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        entries.forEach(e => {
          if (!e.isDirectory() || e.name.startsWith('.') || EXCLUDE_DIRS.includes(e.name)) return;
          const subPath = join(dir, e.name);
          const fileCount = countFiles(subPath);
          if (fileCount > 0) {
            const relPath = subPath.replace(targetPath, '').replace(/^[/\\]/, '');
            lines.push(`  - ${relPath}/ (${fileCount} files)`);
          }
          listSubdirs(subPath, prefix + '  ');
        });
      } catch (e) {
        // Ignore
      }
    }
    listSubdirs(targetPath);
  } else {
    lines.push('Direct subdirectories:');
    try {
      const entries = readdirSync(targetPath, { withFileTypes: true });
      entries.forEach(e => {
        if (!e.isDirectory() || e.name.startsWith('.') || EXCLUDE_DIRS.includes(e.name)) return;
        const subPath = join(targetPath, e.name);
        const fileCount = countFiles(subPath);
        const hasClaude = existsSync(join(subPath, 'CLAUDE.md')) ? ' [has CLAUDE.md]' : '';
        lines.push(`  - ${e.name}/ (${fileCount} files)${hasClaude}`);
      });
    } catch (e) {
      // Ignore
    }
  }

  // Count file types in current directory
  lines.push('');
  lines.push('Current directory files:');
  try {
    const entries = readdirSync(targetPath, { withFileTypes: true });
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.sh'];
    const configExts = ['.json', '.yaml', '.yml', '.toml'];

    let codeCount = 0, configCount = 0, docCount = 0;
    entries.forEach(e => {
      if (!e.isFile()) return;
      const ext = extname(e.name).toLowerCase();
      if (codeExts.includes(ext)) codeCount++;
      else if (configExts.includes(ext)) configCount++;
      else if (ext === '.md') docCount++;
    });

    lines.push(`  - Code files: ${codeCount}`);
    lines.push(`  - Config files: ${configCount}`);
    lines.push(`  - Documentation: ${docCount}`);
  } catch (e) {
    // Ignore
  }

  return lines.join('\n');
}

/**
 * Load template content
 */
function loadTemplate() {
  const templatePath = join(
    process.env.HOME || process.env.USERPROFILE,
    '.claude/workflows/cli-templates/prompts/memory/02-document-module-structure.txt'
  );

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf8');
  }

  return 'Create comprehensive CLAUDE.md documentation following standard structure with Purpose, Structure, Components, Dependencies, Integration, and Implementation sections.';
}

/**
 * Create temporary prompt file and return cleanup function
 */
function createPromptFile(prompt) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const promptFile = join(tmpdir(), `claude-prompt-${timestamp}-${randomSuffix}.txt`);
  writeFileSync(promptFile, prompt, 'utf8');
  return promptFile;
}

/**
 * Build ccw cli command using prompt file
 */
function buildCliCommand(tool, promptFile, model) {
  // Use ccw cli with prompt file
  // ccw cli reads prompt from file when using -p @file syntax
  const normalizedPath = promptFile.replace(/\\/g, '/');
  const isWindows = process.platform === 'win32';

  // Read prompt content for ccw cli -p parameter
  const promptContent = readFileSync(promptFile, 'utf8');

  // Escape single quotes in prompt for shell
  const escapedPrompt = promptContent.replace(/'/g, "'\\''");

  // Build ccw cli command with --mode write
  // Format: ccw cli -p 'prompt content' --tool <tool> --model <model> --mode write
  return `ccw cli -p '${escapedPrompt}' --tool ${tool} --model ${model} --mode write`;
}

/**
 * Main execute function
 */
async function execute(params) {
  const { strategy, path: modulePath, tool = 'gemini', model } = params;

  // Validate parameters
  if (!strategy) {
    throw new Error('Parameter "strategy" is required. Valid: single-layer, multi-layer');
  }

  if (!['single-layer', 'multi-layer'].includes(strategy)) {
    throw new Error(`Invalid strategy '${strategy}'. Valid: single-layer, multi-layer`);
  }

  if (!modulePath) {
    throw new Error('Parameter "path" is required');
  }

  const targetPath = resolve(process.cwd(), modulePath);

  if (!existsSync(targetPath)) {
    throw new Error(`Directory not found: ${targetPath}`);
  }

  if (!statSync(targetPath).isDirectory()) {
    throw new Error(`Not a directory: ${targetPath}`);
  }

  // Check if directory has files
  const fileCount = countFiles(targetPath);
  if (fileCount === 0) {
    return {
      success: false,
      message: `Skipping '${modulePath}' - no files found`,
      skipped: true
    };
  }

  // Set model - if not provided by user, use SECONDARY_MODEL alias
  // The ccw cli will resolve this to the actual secondary model from cli-tools.json
  const actualModel = model || 'SECONDARY_MODEL';

  // Load template
  const templateContent = loadTemplate();

  // Scan directory structure
  const structureInfo = scanDirectoryStructure(targetPath, strategy);

  // Build prompt based on strategy
  let prompt;
  if (strategy === 'multi-layer') {
    prompt = `Directory Structure Analysis:
${structureInfo}

Read: @**/*

Generate CLAUDE.md files:
- Primary: ./CLAUDE.md (current directory)
- Additional: CLAUDE.md in each subdirectory containing files

Template Guidelines:
${templateContent}

Instructions:
- Work bottom-up: deepest directories first
- Parent directories reference children
- Each CLAUDE.md file must be in its respective directory
- Follow the template guidelines above for consistent structure
- Use the structure analysis to understand directory hierarchy`;
  } else {
    prompt = `Directory Structure Analysis:
${structureInfo}

Read: @*/CLAUDE.md @*.ts @*.tsx @*.js @*.jsx @*.py @*.sh @*.md @*.json @*.yaml @*.yml

Generate single file: ./CLAUDE.md

Template Guidelines:
${templateContent}

Instructions:
- Create exactly one CLAUDE.md file in the current directory
- Reference child CLAUDE.md files, do not duplicate their content
- Follow the template guidelines above for consistent structure
- Use the structure analysis to understand the current directory context`;
  }

  // Create temporary prompt file (avoids shell escaping issues with multiline prompts)
  const promptFile = createPromptFile(prompt);
  
  // Build command using file-based prompt
  const command = buildCliCommand(tool, promptFile, actualModel);

  // Log execution info
  console.log(`⚡ Updating: ${modulePath}`);
  console.log(`   Strategy: ${strategy} | Tool: ${tool} | Model: ${actualModel} | Files: ${fileCount}`);
  console.log(`   Prompt file: ${promptFile}`);

  try {
    const startTime = Date.now();

    execSync(command, {
      cwd: targetPath,
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000, // 5 minutes
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Cleanup prompt file
    try {
      unlinkSync(promptFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log(`   ✅ Completed in ${duration}s`);

    return {
      success: true,
      strategy,
      path: modulePath,
      tool,
      model: actualModel,
      file_count: fileCount,
      duration_seconds: duration,
      message: `CLAUDE.md updated successfully in ${duration}s`
    };
  } catch (error) {
    // Cleanup prompt file on error
    try {
      unlinkSync(promptFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log(`   ❌ Update failed: ${error.message}`);

    return {
      success: false,
      strategy,
      path: modulePath,
      tool,
      model: actualModel,
      error: error.message
    };
  }
}

/**
 * Tool Definition
 */
export const updateModuleClaudeTool = {
  name: 'update_module_claude',
  description: `Generate/update CLAUDE.md module documentation using ccw cli.

Strategies:
- single-layer: Read current dir code + child CLAUDE.md, generate ./CLAUDE.md
- multi-layer: Read all files, generate CLAUDE.md for each directory

Tools: gemini (default), qwen, codex
Model: Supports model aliases (PRIMARY_MODEL, SECONDARY_MODEL) or explicit model names
       Default: SECONDARY_MODEL (resolved from ~/.claude/cli-tools.json)`,
  parameters: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['single-layer', 'multi-layer'],
        description: 'Generation strategy'
      },
      path: {
        type: 'string',
        description: 'Module directory path'
      },
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to use (default: gemini)',
        default: 'gemini'
      },
      model: {
        type: 'string',
        description: 'Model name (optional, uses tool defaults)'
      }
    },
    required: ['strategy', 'path']
  },
  execute
};
