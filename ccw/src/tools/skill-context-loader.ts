/**
 * Skill Context Loader Tool
 * Loads SKILL context based on keyword matching in user prompt
 * Used by UserPromptSubmit hooks to inject skill context
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Input schema for keyword mode config
const SkillConfigSchema = z.object({
  skill: z.string(),
  keywords: z.array(z.string())
});

// Main params schema
const ParamsSchema = z.object({
  // Auto mode flag
  mode: z.literal('auto').optional(),
  // User prompt to match against
  prompt: z.string(),
  // Keyword mode configs (only for keyword mode)
  configs: z.array(SkillConfigSchema).optional()
});

type Params = z.infer<typeof ParamsSchema>;

/**
 * Get all available skill names from project and user directories
 */
function getAvailableSkills(): Array<{ name: string; folderName: string; location: 'project' | 'user' }> {
  const skills: Array<{ name: string; folderName: string; location: 'project' | 'user' }> = [];

  // Project skills
  const projectSkillsDir = join(process.cwd(), '.claude', 'skills');
  if (existsSync(projectSkillsDir)) {
    try {
      const entries = readdirSync(projectSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = join(projectSkillsDir, entry.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const name = parseSkillName(skillMdPath) || entry.name;
            skills.push({ name, folderName: entry.name, location: 'project' });
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // User skills
  const userSkillsDir = join(homedir(), '.claude', 'skills');
  if (existsSync(userSkillsDir)) {
    try {
      const entries = readdirSync(userSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = join(userSkillsDir, entry.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const name = parseSkillName(skillMdPath) || entry.name;
            // Skip if already added from project (project takes priority)
            if (!skills.some(s => s.folderName === entry.name)) {
              skills.push({ name, folderName: entry.name, location: 'user' });
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return skills;
}

/**
 * Parse skill name from SKILL.md frontmatter
 */
function parseSkillName(skillMdPath: string): string | null {
  try {
    const content = readFileSync(skillMdPath, 'utf8');
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex > 0) {
        const frontmatter = content.substring(3, endIndex);
        const nameMatch = frontmatter.match(/^name:\s*["']?([^"'\n]+)["']?/m);
        if (nameMatch) {
          return nameMatch[1].trim();
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Match prompt against keywords (case-insensitive)
 */
function matchKeywords(prompt: string, keywords: string[]): string | null {
  const lowerPrompt = prompt.toLowerCase();
  for (const keyword of keywords) {
    if (keyword && lowerPrompt.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

/**
 * Format skill invocation instruction for hook output
 * Returns a prompt to invoke the skill, not the full content
 */
function formatSkillInvocation(skillName: string, matchedKeyword?: string): string {
  return `Use /${skillName} skill to handle this request.`;
}

/**
 * Tool schema definition
 */
export const schema: ToolSchema = {
  name: 'skill_context_loader',
  description: 'Match keywords in user prompt and return skill invocation instruction. Returns "Use /skill-name skill" when keywords match.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['auto'],
        description: 'Auto mode: detect skill name in prompt automatically'
      },
      prompt: {
        type: 'string',
        description: 'User prompt to match against keywords'
      },
      configs: {
        type: 'array',
        description: 'Keyword mode: array of skill configs with keywords',
        items: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'Skill folder name to load' },
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to match in prompt'
            }
          },
          required: ['skill', 'keywords']
        }
      }
    },
    required: ['prompt']
  }
};

/**
 * Tool handler
 */
export async function handler(params: Record<string, unknown>): Promise<ToolResult<string>> {
  try {
    const parsed = ParamsSchema.parse(params);
    const { mode, prompt, configs } = parsed;

    // Auto mode: detect skill name in prompt
    if (mode === 'auto') {
      const skills = getAvailableSkills();
      const lowerPrompt = prompt.toLowerCase();

      for (const skill of skills) {
        // Check if prompt contains skill name or folder name
        if (lowerPrompt.includes(skill.name.toLowerCase()) ||
            lowerPrompt.includes(skill.folderName.toLowerCase())) {
          return {
            success: true,
            result: formatSkillInvocation(skill.folderName, skill.name)
          };
        }
      }
      // No match - return empty (silent)
      return { success: true, result: '' };
    }

    // Keyword mode: match against configured keywords
    if (configs && configs.length > 0) {
      for (const config of configs) {
        const matchedKeyword = matchKeywords(prompt, config.keywords);
        if (matchedKeyword) {
          return {
            success: true,
            result: formatSkillInvocation(config.skill, matchedKeyword)
          };
        }
      }
    }

    // No match - return empty (silent)
    return { success: true, result: '' };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `skill_context_loader error: ${message}`
    };
  }
}
