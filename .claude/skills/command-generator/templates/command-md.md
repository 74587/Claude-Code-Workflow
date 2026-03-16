# Command Template — Structural Reference

This template defines the **structural pattern** for generated commands. The `draft_content` step uses this as a guide to generate concrete, domain-specific content — NOT as a literal copy target.

## Required Structure

```markdown
---
name: {$SKILL_NAME}
description: {$DESCRIPTION}
argument-hint: {$ARGUMENT_HINT}  # omit line if empty
---

<purpose>
{2-3 concrete sentences: what it does + when invoked + what it produces}
</purpose>

<required_reading>
{@ references to files this command needs before execution}
</required_reading>

<prerequisites>   <!-- include when command uses external CLI tools -->
- {tool} ({version}+) — {what it's used for}
</prerequisites>

<process>

<step name="parse_input" priority="first">
**Parse arguments and validate input.**

Parse `$ARGUMENTS` for:
- {specific flags from $ARGUMENT_HINT}
- {positional args}

{Decision routing table if multiple modes:}
| Condition | Action |
|-----------|--------|
| flag present | set variable |
| missing required | Error: "message" `# (see code: E001)` + `exit 1` |

</step>

<step name="{domain_action_1}">
**{Concrete action description.}**

$STATE_VAR="default"  <!-- Initialize BEFORE conditional -->

```bash
# Use heredoc for multi-line output
cat <<EOF > output-file
{structured content with $VARIABLES}
EOF

# Every error path: message + code ref + exit
if [ ! -f "$REQUIRED_FILE" ]; then
  echo "Error: Required file missing" # (see code: E003)
  exit 1
fi
```

| Condition | Action |
|-----------|--------|
| success | Continue to next step |
| failure | Error `# (see code: E0XX)`, exit 1 |
</step>

<step name="report">
**Format and display results.**

{Banner with status, file paths, next steps}
</step>

</process>

<error_codes>

| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | error | {specific to parse_input validation} | parse_input |
| E002 | error | {specific to domain action failure} | {step_name} |
| W001 | warning | {specific recoverable condition} | {step_name} |

<!-- Every code MUST be referenced by `# (see code: EXXX)` in <process> -->
</error_codes>

<success_criteria>
- [ ] {Input validated}
- [ ] {Domain action 1 completed}
- [ ] {Domain action 2 completed}
- [ ] {Output produced / effect applied}
</success_criteria>
```

## Content Quality Rules

| Rule | Bad Example | Good Example |
|------|-------------|--------------|
| No bracket placeholders | `[Describe purpose]` | `Deploy to target environment with rollback on failure.` |
| Concrete step names | `execute` | `run_deployment`, `validate_config` |
| Specific error codes | `E001: Invalid input` | `E001: --env must be "prod" or "staging"` |
| Verifiable criteria | `Command works` | `Deployment log written to .deploy/latest.log` |
| Real shell commands | `# TODO: implement` | `kubectl apply -f $MANIFEST_PATH` |

## Step Naming Conventions

| Domain | Typical Steps |
|--------|--------------|
| Deploy/Release | `validate_config`, `run_deployment`, `verify_health`, `report` |
| CRUD operations | `parse_input`, `validate_entity`, `persist_changes`, `report` |
| Analysis/Review | `parse_input`, `gather_context`, `run_analysis`, `present_findings` |
| Sync/Migration | `parse_input`, `detect_changes`, `apply_sync`, `verify_state` |
| Build/Generate | `parse_input`, `resolve_dependencies`, `run_build`, `write_output` |
