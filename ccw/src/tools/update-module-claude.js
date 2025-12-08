/**
 * Update Module CLAUDE.md Tool
 * Generate/update CLAUDE.md module documentation using CLI tools
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, resolve, basename, extname } from 'path';
import { execSync } from 'child_process';

// Directories to exclude
const EXCLUDE_DIRS = [
  '.git', '__pycache__', 'node_modules', '.venv', 'venv', 'env',
  'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  'coverage', '.nyc_output', 'logs', 'tmp', 'temp'
];

// Default models for each tool
const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  qwen: 'coder-model',
  codex: 'gpt5-codex'
};

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
 * Build CLI command
 */
function buildCliCommand(tool, prompt, model) {
  const escapedPrompt = prompt.replace(/"/g, '\\"');

  switch (tool) {
    case 'qwen':
      return model === 'coder-model'
        ? `qwen -p "${escapedPrompt}" --yolo`
        : `qwen -p "${escapedPrompt}" -m "${model}" --yolo`;
    case 'codex':
      return `codex --full-auto exec "${escapedPrompt}" -m "${model}" --skip-git-repo-check -s danger-full-access`;
    case 'gemini':
    default:
      return `gemini -p "${escapedPrompt}" -m "${model}" --yolo`;
  }
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

  // Set model
  const actualModel = model || DEFAULT_MODELS[tool] || DEFAULT_MODELS.gemini;

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
- Follow the template guidelines above for consistent structure`;
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
- Follow the template guidelines above for consistent structure`;
  }

  // Build and execute command
  const command = buildCliCommand(tool, prompt, actualModel);

  try {
    const startTime = Date.now();

    execSync(command, {
      cwd: targetPath,
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });

    const duration = Math.round((Date.now() - startTime) / 1000);

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
  description: `Generate/update CLAUDE.md module documentation using CLI tools.

Strategies:
- single-layer: Read current dir code + child CLAUDE.md, generate ./CLAUDE.md
- multi-layer: Read all files, generate CLAUDE.md for each directory

Tools: gemini (default), qwen, codex`,
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
