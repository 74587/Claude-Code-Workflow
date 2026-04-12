/**
 * JSON Builder Tool — Pure JSON file operations.
 *
 * Commands:
 *   create   — Write a JSON file from provided content
 *   set      — Set/append/index/query fields by path
 *   get      — Read field(s) by path
 *   merge    — Merge multiple JSON files
 *   delete   — Remove field(s) by path
 *   validate — Basic structure check against inline rules
 *
 * No schema-file dependencies. Schema reading happens at the agent level
 * (LLM reads schema to understand structure, then uses this tool for file I/O).
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { promises as fsp } from 'fs';
import { dirname } from 'path';
import { validatePath } from '../utils/path-validator.js';

// ─── Params ──────────────────────────────────────────────────

const OpSchema = z.object({
  path: z.string().min(1),
  value: z.unknown(),
});

const RulesSchema = z.object({
  required: z.array(z.string()).optional(),
  types: z.record(z.string(), z.string()).optional(),
  minItems: z.record(z.string(), z.number()).optional(),
  minLength: z.record(z.string(), z.number()).optional(),
  enums: z.record(z.string(), z.array(z.string())).optional(),
}).optional();

const ParamsSchema = z.object({
  cmd: z.enum(['create', 'set', 'get', 'merge', 'delete', 'validate']),
  target: z.string().optional(),
  output: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  ops: z.array(OpSchema).optional(),
  fields: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  strategy: z.string().optional(),
  rules: RulesSchema,
});

type Params = z.infer<typeof ParamsSchema>;

// ─── Tool Schema ─────────────────────────────────────────────

export const schema: ToolSchema = {
  name: 'json_builder',
  description: `Pure JSON file operations. Commands:
  create: Write JSON file. Params: output (string), content (object)
  set: Set/append fields. Params: target (string), ops [{path, value}...]
  get: Read fields. Params: target (string), fields [path...]
  merge: Merge JSONs. Params: sources (string[]), output (string), strategy? (string)
  delete: Remove fields. Params: target (string), paths [path...]
  validate: Structure check. Params: target (string), rules {required?, types?, enums?}`,
  inputSchema: {
    type: 'object',
    properties: {
      cmd: { type: 'string', description: 'Command: create|set|get|merge|delete|validate' },
      target: { type: 'string', description: 'Target JSON file path (set/get/delete/validate)' },
      output: { type: 'string', description: 'Output file path (create/merge)' },
      content: { type: 'object', description: 'Complete JSON content (create)' },
      ops: {
        type: 'array',
        description: 'Set operations: [{path: "field.sub" or "arr[+]", value: ...}]',
      },
      fields: { type: 'array', description: 'Field paths to read (get)' },
      paths: { type: 'array', description: 'Field paths to delete (delete)' },
      sources: { type: 'array', description: 'Source files for merge' },
      strategy: { type: 'string', description: 'Merge strategy: dedup_by_path (default)' },
      rules: {
        type: 'object',
        description: 'Validation rules: {required:[], types:{}, enums:{}, minItems:{}, minLength:{}}',
      },
    },
    required: ['cmd'],
  },
};

// ─── Handler ─────────────────────────────────────────────────

export async function handler(params: Record<string, unknown>): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const p = parsed.data;
  try {
    switch (p.cmd) {
      case 'create':  return await cmdCreate(p);
      case 'set':     return await cmdSet(p);
      case 'get':     return await cmdGet(p);
      case 'merge':   return await cmdMerge(p);
      case 'delete':  return await cmdDelete(p);
      case 'validate':return await cmdValidate(p);
      default:
        return { success: false, error: `Unknown command: ${p.cmd}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── create ──────────────────────────────────────────────────

async function cmdCreate(p: Params): Promise<ToolResult> {
  if (!p.output) return { success: false, error: 'output is required for create' };
  if (!p.content || Object.keys(p.content).length === 0) {
    return { success: false, error: 'content is required for create' };
  }

  const outputPath = await validatePath(p.output);
  await ensureDir(outputPath);
  const jsonStr = JSON.stringify(p.content, null, 2);
  await fsp.writeFile(outputPath, jsonStr, 'utf-8');

  return {
    success: true,
    result: {
      path: outputPath,
      fields: Object.keys(p.content),
      size: Buffer.byteLength(jsonStr, 'utf-8'),
      message: `Created JSON file with ${Object.keys(p.content).length} fields`,
    },
  };
}

// ─── set ─────────────────────────────────────────────────────

async function cmdSet(p: Params): Promise<ToolResult> {
  if (!p.target) return { success: false, error: 'target is required for set' };
  if (!p.ops || p.ops.length === 0) return { success: false, error: 'ops is required for set' };

  const targetPath = await validatePath(p.target);
  let raw: string;
  try {
    raw = await fsp.readFile(targetPath, 'utf-8');
  } catch {
    return { success: false, error: `Target file not found: ${targetPath}` };
  }
  const doc = JSON.parse(raw) as Record<string, unknown>;

  const errors: string[] = [];
  let applied = 0;

  for (const op of p.ops) {
    const result = applyOp(doc, op.path, op.value);
    if (result.error) {
      errors.push(`${op.path}: ${result.error}`);
    } else {
      applied++;
    }
  }

  if (errors.length > 0 && applied === 0) {
    return { success: false, error: `All ops failed: ${errors.join('; ')}` };
  }

  await fsp.writeFile(targetPath, JSON.stringify(doc, null, 2), 'utf-8');

  return {
    success: true,
    result: { applied, errors: errors.length > 0 ? errors : undefined },
  };
}

function applyOp(doc: Record<string, unknown>, path: string, value: unknown): { error?: string } {
  // Handle "auto" values
  if (value === 'auto') {
    if (path.endsWith('timestamp')) {
      value = new Date().toISOString();
    }
  }

  const segments = parsePath(path);
  if (!segments || segments.length === 0) {
    return { error: 'Invalid path syntax' };
  }

  // Navigate to parent and set
  let current: unknown = doc;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.type === 'key') {
      if (typeof current !== 'object' || current === null) {
        return { error: `Cannot navigate into non-object at "${seg.value}"` };
      }
      const obj = current as Record<string, unknown>;
      if (obj[seg.value] === undefined) {
        const nextSeg = segments[i + 1];
        obj[seg.value] = nextSeg.type === 'append' || nextSeg.type === 'index' ? [] : {};
      }
      current = obj[seg.value];
    } else if (seg.type === 'index') {
      if (!Array.isArray(current)) return { error: `Not an array at index ${seg.value}` };
      current = current[Number(seg.value)];
    }
  }

  // Apply final segment
  const last = segments[segments.length - 1];
  if (last.type === 'key') {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return { error: `Cannot set key "${last.value}" on non-object` };
    }
    (current as Record<string, unknown>)[last.value] = value;
  } else if (last.type === 'append') {
    if (!Array.isArray(current)) {
      return { error: `Cannot append to non-array` };
    }
    current.push(value);
  } else if (last.type === 'index') {
    if (!Array.isArray(current)) {
      return { error: `Cannot index into non-array` };
    }
    current[Number(last.value)] = value;
  } else if (last.type === 'query') {
    if (!Array.isArray(current)) {
      return { error: `Cannot query non-array` };
    }
    const { key, val } = last as QuerySegment;
    const idx = current.findIndex((item: unknown) =>
      typeof item === 'object' && item !== null && (item as Record<string, unknown>)[key] === val
    );
    if (idx === -1) return { error: `No item found where ${key}=${val}` };
    current[idx] = value;
  }

  return {};
}

// ─── get ─────────────────────────────────────────────────────

async function cmdGet(p: Params): Promise<ToolResult> {
  if (!p.target) return { success: false, error: 'target is required for get' };

  const targetPath = await validatePath(p.target);
  let raw: string;
  try {
    raw = await fsp.readFile(targetPath, 'utf-8');
  } catch {
    return { success: false, error: `Target file not found: ${targetPath}` };
  }
  const doc = JSON.parse(raw) as Record<string, unknown>;

  const fields = p.fields || Object.keys(doc);
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const value = getByPath(doc, field);
    result[field] = value !== undefined ? value : null;
  }

  return {
    success: true,
    result,
  };
}

function getByPath(doc: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  if (!segments || segments.length === 0) return undefined;

  let current: unknown = doc;
  for (const seg of segments) {
    if (current === undefined || current === null) return undefined;
    if (seg.type === 'key') {
      if (typeof current !== 'object' || Array.isArray(current)) return undefined;
      current = (current as Record<string, unknown>)[seg.value];
    } else if (seg.type === 'index') {
      if (!Array.isArray(current)) return undefined;
      current = current[Number(seg.value)];
    } else if (seg.type === 'query') {
      if (!Array.isArray(current)) return undefined;
      const { key, val } = seg as QuerySegment;
      current = current.find((item: unknown) =>
        typeof item === 'object' && item !== null && (item as Record<string, unknown>)[key] === val
      );
    } else if (seg.type === 'append') {
      return undefined; // Can't "get" an append path
    }
  }
  return current;
}

// ─── merge ───────────────────────────────────────────────────

async function cmdMerge(p: Params): Promise<ToolResult> {
  if (!p.sources || p.sources.length < 2) {
    return { success: false, error: 'merge requires at least 2 sources' };
  }
  if (!p.output) return { success: false, error: 'output is required for merge' };

  const docs: Record<string, unknown>[] = [];
  for (const src of p.sources) {
    const srcPath = await validatePath(src);
    let content: string;
    try {
      content = await fsp.readFile(srcPath, 'utf-8');
    } catch {
      return { success: false, error: `Source not found: ${srcPath}` };
    }
    docs.push(JSON.parse(content));
  }

  const strategy = p.strategy || 'dedup_by_path';
  const merged = mergeDocuments(docs, strategy);

  const outputPath = await validatePath(p.output);
  await ensureDir(outputPath);
  const jsonStr = JSON.stringify(merged, null, 2);
  await fsp.writeFile(outputPath, jsonStr, 'utf-8');

  return {
    success: true,
    result: {
      path: outputPath,
      sourceCount: docs.length,
      strategy,
      fields: Object.keys(merged),
      message: `Merged ${docs.length} documents`,
    },
  };
}

function mergeDocuments(
  docs: Record<string, unknown>[],
  strategy: string,
): Record<string, unknown> {
  const base = structuredClone(docs[0]);

  for (let i = 1; i < docs.length; i++) {
    const other = docs[i];
    for (const [key, value] of Object.entries(other)) {
      if (key.startsWith('_') || key.startsWith('$')) continue;

      const existing = base[key];

      if (Array.isArray(existing) && Array.isArray(value)) {
        if (strategy === 'dedup_by_path') {
          base[key] = deduplicateArrays(existing, value);
        } else {
          base[key] = [...existing, ...value];
        }
      } else if (typeof existing === 'string' && typeof value === 'string') {
        if (existing && value && existing !== value) {
          base[key] = `${existing}\n\n${value}`;
        } else if (!existing && value) {
          base[key] = value;
        }
      } else if (existing === undefined || existing === null || existing === '' || existing === 0) {
        base[key] = value;
      }
    }
  }

  // Update metadata
  if (base._metadata && typeof base._metadata === 'object') {
    (base._metadata as Record<string, unknown>).timestamp = new Date().toISOString();
    (base._metadata as Record<string, unknown>).merged_from = docs.length;
  }

  return base;
}

function deduplicateArrays(a: unknown[], b: unknown[]): unknown[] {
  const result = [...a];
  const existingPaths = new Set<string>();
  const indexMap = new Map<string, number>();

  for (let i = 0; i < a.length; i++) {
    const item = a[i];
    if (typeof item === 'object' && item !== null) {
      const path = (item as Record<string, unknown>).path as string;
      if (path) {
        existingPaths.add(path);
        indexMap.set(path, i);
      }
    }
  }

  for (const item of b) {
    if (typeof item === 'object' && item !== null) {
      const path = (item as Record<string, unknown>).path as string;
      if (path && existingPaths.has(path)) {
        const existingIdx = indexMap.get(path);
        if (existingIdx !== undefined) {
          const existingRel = ((result[existingIdx] as Record<string, unknown>).relevance as number) || 0;
          const newRel = ((item as Record<string, unknown>).relevance as number) || 0;
          if (newRel > existingRel) {
            result[existingIdx] = item;
          }
        }
      } else {
        result.push(item);
        if (path) {
          existingPaths.add(path);
          indexMap.set(path, result.length - 1);
        }
      }
    } else {
      if (!result.includes(item)) {
        result.push(item);
      }
    }
  }

  return result;
}

// ─── delete ──────────────────────────────────────────────────

async function cmdDelete(p: Params): Promise<ToolResult> {
  if (!p.target) return { success: false, error: 'target is required for delete' };
  if (!p.paths || p.paths.length === 0) return { success: false, error: 'paths is required for delete' };

  const targetPath = await validatePath(p.target);
  let raw: string;
  try {
    raw = await fsp.readFile(targetPath, 'utf-8');
  } catch {
    return { success: false, error: `Target file not found: ${targetPath}` };
  }
  const doc = JSON.parse(raw) as Record<string, unknown>;

  const errors: string[] = [];
  let deleted = 0;

  for (const pathStr of p.paths) {
    const result = deleteByPath(doc, pathStr);
    if (result.error) {
      errors.push(`${pathStr}: ${result.error}`);
    } else {
      deleted++;
    }
  }

  if (errors.length > 0 && deleted === 0) {
    return { success: false, error: `All deletes failed: ${errors.join('; ')}` };
  }

  await fsp.writeFile(targetPath, JSON.stringify(doc, null, 2), 'utf-8');

  return {
    success: true,
    result: { deleted, errors: errors.length > 0 ? errors : undefined },
  };
}

function deleteByPath(doc: Record<string, unknown>, path: string): { error?: string } {
  const segments = parsePath(path);
  if (!segments || segments.length === 0) {
    return { error: 'Invalid path syntax' };
  }

  // Navigate to parent
  let current: unknown = doc;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.type === 'key') {
      if (typeof current !== 'object' || current === null || Array.isArray(current)) {
        return { error: `Cannot navigate into non-object at "${seg.value}"` };
      }
      const next = (current as Record<string, unknown>)[seg.value];
      if (next === undefined) return { error: `Path not found at "${seg.value}"` };
      current = next;
    } else if (seg.type === 'index') {
      if (!Array.isArray(current)) return { error: `Not an array at index ${seg.value}` };
      current = current[Number(seg.value)];
    } else {
      return { error: `Cannot navigate through ${seg.type} segment` };
    }
  }

  // Delete final segment
  const last = segments[segments.length - 1];
  if (last.type === 'key') {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return { error: `Cannot delete key "${last.value}" on non-object` };
    }
    if (!(last.value in (current as Record<string, unknown>))) {
      return { error: `Key "${last.value}" not found` };
    }
    delete (current as Record<string, unknown>)[last.value];
  } else if (last.type === 'index') {
    if (!Array.isArray(current)) {
      return { error: `Cannot delete from non-array` };
    }
    const idx = Number(last.value);
    if (idx < 0 || idx >= current.length) {
      return { error: `Index ${idx} out of range (length: ${current.length})` };
    }
    current.splice(idx, 1);
  } else if (last.type === 'query') {
    if (!Array.isArray(current)) {
      return { error: `Cannot query non-array` };
    }
    const { key, val } = last as QuerySegment;
    const idx = current.findIndex((item: unknown) =>
      typeof item === 'object' && item !== null && (item as Record<string, unknown>)[key] === val
    );
    if (idx === -1) return { error: `No item found where ${key}=${val}` };
    current.splice(idx, 1);
  } else {
    return { error: `Cannot delete using append path` };
  }

  return {};
}

// ─── validate (rules-based) ─────────────────────────────────

async function cmdValidate(p: Params): Promise<ToolResult> {
  if (!p.target) return { success: false, error: 'target is required for validate' };

  const targetPath = await validatePath(p.target);
  let raw: string;
  try {
    raw = await fsp.readFile(targetPath, 'utf-8');
  } catch {
    return { success: false, error: `Target file not found: ${targetPath}` };
  }
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { success: false, error: 'Invalid JSON in target file' };
  }

  const rules = p.rules || {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const field of rules.required || []) {
    const val = doc[field];
    if (val === undefined || val === null) {
      errors.push(`${field}: required field missing`);
    } else if (typeof val === 'string' && val === '') {
      errors.push(`${field}: required field is empty string`);
    }
  }

  // Check types
  for (const [field, expectedType] of Object.entries(rules.types || {})) {
    const val = doc[field];
    if (val === undefined || val === null) continue; // Skip if missing (caught by required)
    const actualType = Array.isArray(val) ? 'array' : typeof val;
    if (actualType !== expectedType) {
      if (!(actualType === 'number' && expectedType === 'integer')) {
        errors.push(`${field}: expected ${expectedType}, got ${actualType}`);
      }
    }
  }

  // Check minItems
  for (const [field, min] of Object.entries(rules.minItems || {})) {
    const val = doc[field];
    if (!Array.isArray(val)) continue;
    if (val.length < min) {
      errors.push(`${field}: array has ${val.length} items, needs >= ${min}`);
    }
  }

  // Check minLength
  for (const [field, min] of Object.entries(rules.minLength || {})) {
    const val = doc[field];
    if (typeof val !== 'string') continue;
    if (val.length < min) {
      errors.push(`${field}: string length ${val.length} < minLength ${min}`);
    }
  }

  // Check enums
  for (const [field, allowed] of Object.entries(rules.enums || {})) {
    const val = doc[field];
    if (val === undefined || val === null) continue;
    if (!allowed.includes(String(val))) {
      errors.push(`${field}: value "${val}" not in allowed values [${allowed.join(', ')}]`);
    }
  }

  const stats = {
    fields: Object.keys(doc).filter(k => !k.startsWith('_comment')).length,
    arrayItems: Object.fromEntries(
      Object.entries(doc).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length])
    ),
  };

  return {
    success: true,
    result: {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    },
  };
}

// ─── Path Parsing (shared utility) ───────────────────────────

interface KeySegment { type: 'key'; value: string; }
interface IndexSegment { type: 'index'; value: string; }
interface AppendSegment { type: 'append'; value: string; }
interface QuerySegment { type: 'query'; value: string; key: string; val: string; }
type PathSegment = KeySegment | IndexSegment | AppendSegment | QuerySegment;

function parsePath(path: string): PathSegment[] | null {
  const segments: PathSegment[] = [];
  // Split by '.' but respect brackets
  const parts = path.split(/\.(?![^\[]*\])/);

  for (const part of parts) {
    const bracketMatch = part.match(/^(\w+)\[(.+)\]$/);
    if (bracketMatch) {
      const [, field, bracket] = bracketMatch;
      segments.push({ type: 'key', value: field });

      if (bracket === '+') {
        segments.push({ type: 'append', value: '+' });
      } else if (/^\d+$/.test(bracket)) {
        segments.push({ type: 'index', value: bracket });
      } else if (bracket.includes('=')) {
        const [key, val] = bracket.split('=', 2);
        segments.push({ type: 'query', value: bracket, key: key.replace('?', ''), val } as QuerySegment);
      }
    } else {
      segments.push({ type: 'key', value: part });
    }
  }

  return segments.length > 0 ? segments : null;
}

// ─── Utilities ───────────────────────────────────────────────

async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
}
