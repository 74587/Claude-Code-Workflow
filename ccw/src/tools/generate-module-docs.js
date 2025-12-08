/**
 * Generate Module Docs Tool
 * Generate documentation for modules and projects with multiple strategies
 */

import { readdirSync, statSync, existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve, basename, extname, relative } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

// Directories to exclude
const EXCLUDE_DIRS = [
  '.git', '__pycache__', 'node_modules', '.venv', 'venv', 'env',
  'dist', 'build', '.cache', '.pytest_cache', '.mypy_cache',
  'coverage', '.nyc_output', 'logs', 'tmp', 'temp', '.workflow'
];

// Code file extensions
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.go', '.rs'
];

// Default models for each tool
const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  qwen: 'coder-model',
  codex: 'gpt5-codex'
};

// Template paths (relative to user home directory)
const TEMPLATE_BASE = '.claude/workflows/cli-templates/prompts/documentation';

/**
 * Detect folder type (code vs navigation)
 */
function detectFolderType(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const codeFiles = entries.filter(e => {
      if (!e.isFile()) return false;
      const ext = extname(e.name).toLowerCase();
      return CODE_EXTENSIONS.includes(ext);
    });
    return codeFiles.length > 0 ? 'code' : 'navigation';
  } catch (e) {
    return 'navigation';
  }
}

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
 * Calculate output path
 */
function calculateOutputPath(sourcePath, projectName, projectRoot) {
  const absSource = resolve(sourcePath);
  const normRoot = resolve(projectRoot);
  let relPath = relative(normRoot, absSource);
  relPath = relPath.replace(/\\/g, '/');

  return join('.workflow', 'docs', projectName, relPath);
}

/**
 * Load template content
 */
function loadTemplate(templateName) {
  const homePath = process.env.HOME || process.env.USERPROFILE;
  const templatePath = join(homePath, TEMPLATE_BASE, `${templateName}.txt`);

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf8');
  }

  // Fallback templates
  const fallbacks = {
    'api': 'Generate API documentation with function signatures, parameters, return values, and usage examples.',
    'module-readme': 'Generate README documentation with purpose, usage, configuration, and examples.',
    'folder-navigation': 'Generate navigation README with overview of subdirectories and their purposes.',
    'project-readme': 'Generate project README with overview, installation, usage, and configuration.',
    'project-architecture': 'Generate ARCHITECTURE.md with system design, components, and data flow.'
  };

  return fallbacks[templateName] || 'Generate comprehensive documentation.';
}

/**
 * Create temporary prompt file and return path
 */
function createPromptFile(prompt) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const promptFile = join(tmpdir(), `docs-prompt-${timestamp}-${randomSuffix}.txt`);
  writeFileSync(promptFile, prompt, 'utf8');
  return promptFile;
}

/**
 * Build CLI command using stdin piping (avoids shell escaping issues)
 */
function buildCliCommand(tool, promptFile, model) {
  const normalizedPath = promptFile.replace(/\\/g, '/');
  const isWindows = process.platform === 'win32';
  
  // Build the cat/read command based on platform
  const catCmd = isWindows ? `Get-Content -Raw "${normalizedPath}" | ` : `cat "${normalizedPath}" | `;
  
  switch (tool) {
    case 'qwen':
      return model === 'coder-model'
        ? `${catCmd}qwen --yolo`
        : `${catCmd}qwen -m "${model}" --yolo`;
    case 'codex':
      // codex uses different syntax - prompt as exec argument
      if (isWindows) {
        return `codex --full-auto exec (Get-Content -Raw "${normalizedPath}") -m "${model}" --skip-git-repo-check -s danger-full-access`;
      }
      return `codex --full-auto exec "$(cat "${normalizedPath}")" -m "${model}" --skip-git-repo-check -s danger-full-access`;
    case 'gemini':
    default:
      return `${catCmd}gemini -m "${model}" --yolo`;
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
  const folderType = detectFolderType(targetPath);

  lines.push(`Directory: ${dirName}`);
  lines.push(`Total files: ${totalFiles}`);
  lines.push(`Total directories: ${totalDirs}`);
  lines.push(`Folder type: ${folderType}`);

  return {
    info: lines.join('\n'),
    folderType
  };
}

/**
 * Main execute function
 */
async function execute(params) {
  const { strategy, sourcePath, projectName, tool = 'gemini', model } = params;

  // Validate parameters
  const validStrategies = ['full', 'single', 'project-readme', 'project-architecture', 'http-api'];

  if (!strategy) {
    throw new Error(`Parameter "strategy" is required. Valid: ${validStrategies.join(', ')}`);
  }

  if (!validStrategies.includes(strategy)) {
    throw new Error(`Invalid strategy '${strategy}'. Valid: ${validStrategies.join(', ')}`);
  }

  if (!sourcePath) {
    throw new Error('Parameter "sourcePath" is required');
  }

  if (!projectName) {
    throw new Error('Parameter "projectName" is required');
  }

  const targetPath = resolve(process.cwd(), sourcePath);

  if (!existsSync(targetPath)) {
    throw new Error(`Directory not found: ${targetPath}`);
  }

  if (!statSync(targetPath).isDirectory()) {
    throw new Error(`Not a directory: ${targetPath}`);
  }

  // Set model
  const actualModel = model || DEFAULT_MODELS[tool] || DEFAULT_MODELS.gemini;

  // Scan directory
  const { info: structureInfo, folderType } = scanDirectoryStructure(targetPath, strategy);

  // Calculate output path
  const outputPath = calculateOutputPath(targetPath, projectName, process.cwd());

  // Ensure output directory exists
  mkdirSync(outputPath, { recursive: true });

  // Build prompt based on strategy
  let prompt;
  let templateContent;

  switch (strategy) {
    case 'full':
    case 'single':
      if (folderType === 'code') {
        templateContent = loadTemplate('api');
        prompt = `Directory Structure Analysis:
${structureInfo}

Read: ${strategy === 'full' ? '@**/*' : '@*.ts @*.tsx @*.js @*.jsx @*.py @*.sh @*.md @*.json'}

Generate documentation files:
- API.md: Code API documentation
- README.md: Module overview and usage

Output directory: ${outputPath}

Template Guidelines:
${templateContent}`;
      } else {
        templateContent = loadTemplate('folder-navigation');
        prompt = `Directory Structure Analysis:
${structureInfo}

Read: @*/API.md @*/README.md

Generate documentation file:
- README.md: Navigation overview of subdirectories

Output directory: ${outputPath}

Template Guidelines:
${templateContent}`;
      }
      break;

    case 'project-readme':
      templateContent = loadTemplate('project-readme');
      prompt = `Read all module documentation:
@.workflow/docs/${projectName}/**/API.md
@.workflow/docs/${projectName}/**/README.md

Generate project-level documentation:
- README.md in .workflow/docs/${projectName}/

Template Guidelines:
${templateContent}`;
      break;

    case 'project-architecture':
      templateContent = loadTemplate('project-architecture');
      prompt = `Read project documentation:
@.workflow/docs/${projectName}/README.md
@.workflow/docs/${projectName}/**/API.md

Generate:
- ARCHITECTURE.md: System design documentation
- EXAMPLES.md: Usage examples

Output directory: .workflow/docs/${projectName}/

Template Guidelines:
${templateContent}`;
      break;

    case 'http-api':
      prompt = `Read API route files:
@**/routes/**/*.ts @**/routes/**/*.js
@**/api/**/*.ts @**/api/**/*.js

Generate HTTP API documentation:
- api/README.md: REST API endpoints documentation

Output directory: .workflow/docs/${projectName}/api/`;
      break;
  }

  // Create temporary prompt file (avoids shell escaping issues)
  const promptFile = createPromptFile(prompt);
  
  // Build command using file-based prompt
  const command = buildCliCommand(tool, promptFile, actualModel);

  // Log execution info
  console.log(`📚 Generating docs: ${sourcePath}`);
  console.log(`   Strategy: ${strategy} | Tool: ${tool} | Model: ${actualModel}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Prompt file: ${promptFile}`);

  try {
    const startTime = Date.now();

    execSync(command, {
      cwd: targetPath,
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 600000, // 10 minutes
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
      source_path: sourcePath,
      project_name: projectName,
      output_path: outputPath,
      folder_type: folderType,
      tool,
      model: actualModel,
      duration_seconds: duration,
      message: `Documentation generated successfully in ${duration}s`
    };
  } catch (error) {
    // Cleanup prompt file on error
    try {
      unlinkSync(promptFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log(`   ❌ Generation failed: ${error.message}`);

    return {
      success: false,
      strategy,
      source_path: sourcePath,
      project_name: projectName,
      tool,
      error: error.message
    };
  }
}

/**
 * Tool Definition
 */
export const generateModuleDocsTool = {
  name: 'generate_module_docs',
  description: `Generate documentation for modules and projects.

Module-Level Strategies:
- full: Full documentation (API.md + README.md for all directories)
- single: Single-layer documentation (current directory only)

Project-Level Strategies:
- project-readme: Project overview from module docs
- project-architecture: System design documentation
- http-api: HTTP API documentation

Output: .workflow/docs/{projectName}/...`,
  parameters: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['full', 'single', 'project-readme', 'project-architecture', 'http-api'],
        description: 'Documentation strategy'
      },
      sourcePath: {
        type: 'string',
        description: 'Source module directory path'
      },
      projectName: {
        type: 'string',
        description: 'Project name for output path'
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
    required: ['strategy', 'sourcePath', 'projectName']
  },
  execute
};
