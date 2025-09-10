# Module: Gemini Mode (`/gemini:mode:*`)

## Overview

The `mode` module provides specialized commands for executing the Gemini CLI with different analysis strategies. Each mode is tailored for a specific task, such as bug analysis, project planning, or automatic template selection based on user intent.

These commands act as wrappers around the core `gemini` CLI, pre-configuring it with specific prompt templates and context settings.

## Module-Specific Implementation Patterns

### Command Definition Files

Each command within the `mode` module is defined by a Markdown file (e.g., `auto.md`, `bug-index.md`). These files contain YAML frontmatter that specifies:
- `name`: The command name.
- `description`: A brief explanation of the command's purpose.
- `usage`: How to invoke the command.
- `argument-hint`: A hint for the user about the expected argument.
- `examples`: Sample usages.
- `allowed-tools`: Tools the command is permitted to use.
- `model`: The underlying model to be used.

The body of the Markdown file provides detailed documentation for the command.

### Template-Driven Execution

The core pattern for this module is the use of pre-defined prompt templates stored in `~/.claude/prompt-templates/`. The commands construct a `gemini` CLI call, injecting the content of a specific template into the prompt.

## Commands and Interfaces

### `/gemini:mode:auto`
- **Purpose**: Automatically selects the most appropriate Gemini template by analyzing the user's input against keywords, names, and descriptions defined in the templates' YAML frontmatter.
- **Interface**: `/gemini:mode:auto "description of task"`
- **Dependencies**: Relies on the dynamic discovery of templates in `~/.claude/prompt-templates/`.

### `/gemini:mode:bug-index`
- **Purpose**: Executes a systematic bug analysis using a dedicated diagnostic template.
- **Interface**: `/gemini:mode:bug-index "bug description"`
- **Dependencies**: Uses the `~/.claude/prompt-templates/bug-fix.md` template.

### `/gemini:mode:plan`
- **Purpose**: Performs comprehensive project planning and architecture analysis using a specialized planning template.
- **Interface**: `/gemini:mode:plan "planning topic"`
- **Dependencies**: Uses the `~/.claude/prompt-templates/plan.md` template.

## Dependencies and Relationships

- **External Dependency**: The `mode` module is highly dependent on the prompt templates located in the `~/.claude/prompt-templates/` directory. The structure and metadata (YAML frontmatter) of these templates are critical for the `auto` mode's functionality.
- **Internal Relationship**: The commands within this module are independent of each other but share a common purpose of simplifying access to the `gemini` CLI for specific use cases. They do not call each other.
- **Core CLI**: All commands are wrappers that ultimately construct and execute a `gemini` shell command.

## Testing Strategy

- **Unit Testing**: Not directly applicable as these are command definition files.
- **Integration Testing**: Testing should focus on verifying that each command correctly constructs and executes the intended `gemini` CLI command.
    - For `/gemini:mode:auto`, tests should cover the selection logic with various inputs to ensure the correct template is chosen.
    - For `/gemini:mode:bug-index` and `/gemini:mode:plan`, tests should confirm that the correct, hardcoded template is used.
- **Manual Verification**: Manually running each command with its example arguments is the primary way to ensure they are functioning as documented.
