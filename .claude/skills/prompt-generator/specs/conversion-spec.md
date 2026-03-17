# Conversion Specification

Rules for restyling existing command/agent files to GSD conventions. **Zero content loss is mandatory.**

## Core Principle

Conversion = structural transformation, NOT content rewriting. Every line of source content must appear in the output. Only the container (XML tags, section ordering, frontmatter format) changes.

## Content Loss Prevention Protocol

### Pre-conversion Inventory

Before converting, count:
- `$SRC_LINES` — total non-empty lines
- `$SRC_BLOCKS` — code block count (``` pairs)
- `$SRC_TABLES` — table count (lines starting with `|`)
- `$SRC_SECTIONS` — section count (## headers)

### Post-conversion Verification

| Metric | Rule | Action on Fail |
|--------|------|----------------|
| Lines | output >= source × 0.95 | STOP — find missing content |
| Code blocks | output >= source | STOP — find missing blocks |
| Tables | output >= source | STOP — find missing tables |
| Sections | output >= source | WARN — sections may have merged |

### Diff Display

After conversion, show summary:
```
Conversion Summary:
  Source: {path} ({src_lines} lines, {src_blocks} code blocks)
  Output: {path} ({out_lines} lines, {out_blocks} code blocks)
  Delta:  {+/-} lines, {+/-} code blocks
  New sections added: {list of TODO sections}
```

## Command Conversion Rules

### Source Pattern → Target Pattern

| Source Style | Target Style |
|-------------|-------------|
| `# Title` + `## Phase N:` flat markdown | `<purpose>` + `<process>` with numbered `## N.` steps |
| `## Implementation` + `### Phase N` | `<process>` with numbered steps, content preserved |
| `## Overview` / `## Core Principle` | `<purpose>` (merge into 2-3 sentences) + keep details in steps |
| `## Usage` with examples | Keep as-is inside `<process>` step 1 or before `<process>` |
| `## Auto Mode` / `## Auto Mode Defaults` | `<auto_mode>` section |
| `## Quick Reference` | Preserve as-is within appropriate section |
| Inline `AskUserQuestion` calls | Preserve verbatim — these belong in commands |
| `Agent()` / agent spawning calls | Preserve verbatim within process steps |
| Banner displays (`━━━`) | Preserve verbatim |
| Code blocks (```bash, ```javascript, etc.) | **Preserve exactly** — never modify code content |
| Tables | **Preserve exactly** — never reformat table content |

### Frontmatter Conversion

| Source Field | Target Field | Transformation |
|-------------|-------------|----------------|
| `name` | `name` | Keep as-is |
| `description` | `description` | Keep as-is |
| `argument-hint` | `argument-hint` | Keep as-is |
| `allowed-tools` | `allowed-tools` | Keep as-is |
| Missing `allowed-tools` | `allowed-tools` | Infer from content (Read, Write, etc.) |

### Section Wrapping

Content that was under plain `##` headers gets wrapped in XML tags:

```
## Overview / ## Core Principle  → content moves to <purpose>
## Process / ## Implementation  → content moves to <process>
## Success Criteria             → content moves to <success_criteria>
## Error Codes                  → preserve as-is (optional section)
```

**Everything else**: Wrap in appropriate GSD tag or keep as custom section inside `<process>`.

### What to ADD (with TODO markers)

| Missing Element | Add |
|----------------|-----|
| `<purpose>` | Extract from overview/description, mark `<!-- TODO: refine -->` if uncertain |
| `<success_criteria>` | Generate from existing content, mark `<!-- TODO: verify -->` |
| `<offer_next>` | Add skeleton with `<!-- TODO: fill next commands -->` |
| Banners | Add before major transitions if missing |

## Agent Conversion Rules

### Source Pattern → Target Pattern

| Source Style | Target Style |
|-------------|-------------|
| Plain prose role description | `<role>` with structured format |
| `## Core Philosophy` / `## Principles` | `<philosophy>` |
| `## Execution Process` / `## How to` | Domain section with descriptive name |
| `## Quality Gates` / `## Standards` | `<quality_gate>` with checkbox format |
| Flat numbered list of responsibilities | `<role>` core responsibilities bullet list |
| `## Examples` section | Move examples INTO relevant domain sections |

### Frontmatter Conversion

| Source Field | Target Field | Transformation |
|-------------|-------------|----------------|
| `name` | `name` | Keep as-is |
| `description` | `description` | Append "Spawned by /command orchestrator." if missing |
| `color` | `color` | Keep as-is |
| Missing `tools` | `tools` | Infer from content (Read, Write, Bash, etc.) |

### Section Restructuring

1. **`<role>` MUST be first** — gather identity content from wherever it appears
2. **Add "Spawned by:"** if missing — infer from description or mark `<!-- TODO: specify spawner -->`
3. **Add "Mandatory Initial Read"** block if missing
4. **Rename generic sections**: `<rules>` → descriptive name based on content
5. **Add `<output_contract>`** if missing — with TODO marker
6. **Add `<quality_gate>`** if missing — with TODO marker

### What NOT to Change

- Code blocks inside sections — preserve exactly
- Tables — preserve exactly
- Concrete examples (good/bad comparisons) — preserve exactly
- Shell commands — preserve exactly
- Agent prompts — preserve exactly
- Domain-specific terminology — preserve exactly

## Batch Conversion

For converting multiple files:

```bash
# List candidates
ls .claude/commands/**/*.md .claude/agents/*.md

# Convert one at a time, verify each
/prompt-generator convert .claude/commands/issue/new.md
/prompt-generator convert .claude/agents/universal-executor.md
```

## Anti-Patterns

| Anti-Pattern | Why It's Wrong |
|-------------|----------------|
| Rewriting code blocks | Content loss — code is sacred |
| Summarizing verbose sections | Content loss — preserve verbatim |
| Removing "redundant" content | User may depend on it |
| Merging sections without inventory | May lose content silently |
| Adding content beyond structural tags | Conversion adds structure, not content |
| Skipping post-conversion line count | Cannot verify zero content loss |
