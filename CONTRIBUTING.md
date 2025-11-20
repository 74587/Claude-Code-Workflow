# 🤝 Contributing to Claude Code Workflow

Thank you for your interest in contributing to Claude Code Workflow (CCW)! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Experience level
- Background
- Identity
- Perspective

### Our Standards

**Positive behaviors**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors**:
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

---

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Claude Code** - The latest version installed ([Installation Guide](INSTALL.md))
2. **Git** - For version control
3. **Text Editor** - VS Code, Vim, or your preferred editor
4. **Basic Knowledge**:
   - Bash scripting
   - Markdown formatting
   - JSON structure
   - Git workflow

### Understanding the Codebase

Start by reading:
1. [README.md](README.md) - Project overview
2. [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
3. [GETTING_STARTED.md](GETTING_STARTED.md) - Basic usage
4. [COMMAND_SPEC.md](COMMAND_SPEC.md) - Command specifications

---

## 💻 Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/Claude-Code-Workflow.git
cd Claude-Code-Workflow
```

### 2. Set Up Upstream Remote

```bash
git remote add upstream https://github.com/catlog22/Claude-Code-Workflow.git
git fetch upstream
```

### 3. Create Development Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 4. Install CCW for Testing

```bash
# Install your development version
bash Install-Claude.sh

# Or on Windows
powershell -ExecutionPolicy Bypass -File Install-Claude.ps1
```

---

## 🛠️ How to Contribute

### Types of Contributions

#### 1. **Bug Fixes**
- Report bugs via [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues)
- Include reproduction steps
- Provide system information (OS, Claude Code version)
- Submit PR with fix

#### 2. **New Features**
- Discuss in [GitHub Discussions](https://github.com/catlog22/Claude-Code-Workflow/discussions)
- Create feature proposal issue
- Get community feedback
- Implement after approval

#### 3. **Documentation**
- Fix typos or clarify existing docs
- Add missing documentation
- Improve examples
- Translate to other languages

#### 4. **New Commands**
- Follow command template structure
- Include comprehensive documentation
- Add tests for command execution
- Update COMMAND_REFERENCE.md

#### 5. **New Agents**
- Define agent role clearly
- Specify tools required
- Provide usage examples
- Document in ARCHITECTURE.md

---

## 📏 Coding Standards

### General Principles

Follow the project's core beliefs (from [CLAUDE.md](CLAUDE.md)):

1. **Pursue good taste** - Eliminate edge cases for natural, elegant code
2. **Embrace extreme simplicity** - Avoid unnecessary complexity
3. **Be pragmatic** - Solve real-world problems
4. **Data structures first** - Focus on data design
5. **Never break backward compatibility** - Existing functionality is sacred
6. **Incremental progress** - Small changes that compile and pass tests
7. **Learn from existing code** - Study patterns before implementing
8. **Clear intent over clever code** - Be boring and obvious

### Bash Script Standards

```bash
#!/usr/bin/env bash
# Command: /workflow:example
# Description: Brief description of what this command does

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Function definitions
function example_function() {
    local param1="$1"
    local param2="${2:-default}"

    # Implementation
}

# Main execution
function main() {
    # Validate inputs
    # Execute logic
    # Handle errors
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

### JSON Standards

```json
{
  "id": "IMPL-1",
  "title": "Task title",
  "status": "pending",
  "meta": {
    "type": "feature",
    "agent": "code-developer",
    "priority": "high"
  },
  "context": {
    "requirements": ["Requirement 1", "Requirement 2"],
    "focus_paths": ["src/module/"],
    "acceptance": ["Criterion 1", "Criterion 2"]
  }
}
```

**Rules**:
- Use 2-space indentation
- Always validate JSON syntax
- Include all required fields
- Use clear, descriptive values

### Markdown Standards

```markdown
# Main Title (H1) - One per document

## Section Title (H2)

### Subsection (H3)

- Use bullet points for lists
- Use `code blocks` for commands
- Use **bold** for emphasis
- Use *italics* for technical terms

```bash
# Code blocks with language specification
command --flag value
```

> Use blockquotes for important notes
```

### File Organization

```
.claude/
├── agents/                 # Agent definitions
│   ├── agent-name.md
├── commands/               # Slash commands
│   └── workflow/
│       ├── workflow-plan.md
├── skills/                 # Agent skills
│   └── skill-name/
│       ├── SKILL.md
└── workflows/              # Workflow docs
    ├── workflow-architecture.md
```

---

## 🧪 Testing Guidelines

### Manual Testing

Before submitting PR:

1. **Test the Happy Path**
   ```bash
   # Test basic functionality
   /your:new:command "basic input"
   ```

2. **Test Error Handling**
   ```bash
   # Test with invalid input
   /your:new:command ""
   /your:new:command --invalid-flag
   ```

3. **Test Edge Cases**
   ```bash
   # Test with special characters
   /your:new:command "input with 'quotes'"

   # Test with long input
   /your:new:command "very long input string..."
   ```

### Integration Testing

Test how your changes interact with existing commands:

```bash
# Example workflow test
/workflow:session:start "Test Feature"
/your:new:command "test input"
/workflow:status
/workflow:session:complete
```

### Testing Checklist

- [ ] Command executes without errors
- [ ] Error messages are clear and helpful
- [ ] Session state is preserved correctly
- [ ] JSON files are created with correct structure
- [ ] Memory system updates work correctly
- [ ] Works on both Linux and Windows
- [ ] Documentation is accurate

---

## 📚 Documentation Guidelines

### Command Documentation

Every new command must include:

#### 1. **Inline Documentation** (in command file)

```bash
#!/usr/bin/env bash
# Command: /workflow:example
# Description: One-line description
# Usage: /workflow:example [options] <arg>
#
# Options:
#   --option1    Description of option1
#   --option2    Description of option2
#
# Examples:
#   /workflow:example "basic usage"
#   /workflow:example --option1 value "advanced usage"
```

#### 2. **COMMAND_REFERENCE.md Entry**

Add entry to the appropriate section:

```markdown
| `/workflow:example` | Brief description of the command. |
```

#### 3. **COMMAND_SPEC.md Entry**

Add detailed specification:

```markdown
### `/workflow:example`

**Purpose**: Detailed description of what this command does and when to use it.

**Parameters**:
- `arg` (required): Description of argument
- `--option1` (optional): Description of option

**Workflow**:
1. Step 1
2. Step 2
3. Step 3

**Output**:
- Creates: Files created
- Updates: Files updated
- Returns: Return value

**Examples**:
```bash
/workflow:example "example input"
```

**Related Commands**:
- `/related:command1` - Description
- `/related:command2` - Description
```

### Agent Documentation

Every new agent must include:

```markdown
# Agent Name

## Role
Clear description of agent's responsibility and purpose.

## Specialization
What makes this agent unique and when to use it.

## Tools Available
- Tool 1: Usage
- Tool 2: Usage
- Tool 3: Usage

## Invocation
How the agent is typically invoked (manually or by workflow).

## Context Requirements
What context the agent needs to function effectively.

## Output
What the agent produces.

## Examples
Real usage examples.

## Prompt
The actual agent instructions...
```

---

## 📤 Submitting Changes

### Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:

```
feat(workflow): add workflow:example command

Add new workflow command for example functionality.
Includes:
- Command implementation
- Documentation updates
- Test cases

Closes #123
```

```
fix(memory): resolve memory update race condition

Fix race condition when multiple agents update memory
simultaneously by adding file locking mechanism.

Fixes #456
```

```
docs(readme): update installation instructions

Clarify Windows installation steps and add troubleshooting
section for common issues.
```

### Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Go to GitHub and create PR
   - Fill out PR template
   - Link related issues
   - Add screenshots/examples if applicable

4. **PR Title Format**
   ```
   feat: Add workflow:example command
   fix: Resolve memory update issue
   docs: Update contributing guide
   ```

5. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Refactoring

   ## Related Issues
   Closes #123

   ## Testing
   - [ ] Tested on Linux
   - [ ] Tested on Windows
   - [ ] Added/updated documentation

   ## Screenshots (if applicable)

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No breaking changes (or documented)
   ```

6. **Address Review Comments**
   - Respond to all comments
   - Make requested changes
   - Push updates to same branch
   - Re-request review when ready

---

## 🎯 Development Workflow

### Feature Development

```bash
# 1. Create branch
git checkout -b feat/new-command

# 2. Implement feature
# - Write code
# - Add documentation
# - Test thoroughly

# 3. Commit changes
git add .
git commit -m "feat(workflow): add new command"

# 4. Push and create PR
git push origin feat/new-command
```

### Bug Fix

```bash
# 1. Create branch
git checkout -b fix/issue-123

# 2. Fix bug
# - Identify root cause
# - Implement fix
# - Add regression test

# 3. Commit fix
git commit -m "fix: resolve issue #123"

# 4. Push and create PR
git push origin fix/issue-123
```

---

## 🔄 Release Process

### Version Numbering

CCW follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Example: `v5.8.1`
- `5`: Major version
- `8`: Minor version
- `1`: Patch version

### Release Checklist

Maintainers will:

1. Update version in:
   - `README.md`
   - `README_CN.md`
   - All documentation headers

2. Update `CHANGELOG.md`:
   ```markdown
   ## [v5.9.0] - 2025-11-20

   ### Added
   - New feature 1
   - New feature 2

   ### Fixed
   - Bug fix 1
   - Bug fix 2

   ### Changed
   - Change 1
   ```

3. Create release tag:
   ```bash
   git tag -a v5.9.0 -m "Release v5.9.0"
   git push origin v5.9.0
   ```

4. Create GitHub Release with:
   - Release notes from CHANGELOG.md
   - Installation scripts
   - Migration guide (if breaking changes)

---

## 💡 Tips for Contributors

### Best Practices

1. **Start Small**
   - Fix documentation typos
   - Add examples
   - Improve error messages
   - Then move to larger features

2. **Ask Questions**
   - Use GitHub Discussions for questions
   - Ask before starting major work
   - Clarify requirements early

3. **Follow Existing Patterns**
   - Study similar commands before creating new ones
   - Maintain consistency with existing code
   - Reuse existing utilities

4. **Test Thoroughly**
   - Test on both Linux and Windows if possible
   - Test with different input types
   - Test integration with existing workflows

5. **Document Everything**
   - Clear commit messages
   - Comprehensive PR descriptions
   - Updated documentation
   - Code comments where necessary

### Common Pitfalls to Avoid

❌ **Don't**:
- Break backward compatibility without discussion
- Add features without documentation
- Submit large PRs without prior discussion
- Ignore failing tests
- Copy code without attribution

✅ **Do**:
- Keep PRs focused and small
- Update documentation with code changes
- Add tests for new features
- Follow project coding standards
- Be responsive to review comments

---

## 📞 Getting Help

### Resources

- **Documentation**: Read all docs in repository
- **Discussions**: [GitHub Discussions](https://github.com/catlog22/Claude-Code-Workflow/discussions)
- **Issues**: [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues)
- **Command Guide**: Use `CCW-help` within Claude Code

### Contact

- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **Questions**: GitHub Discussions
- **Security Issues**: Create private security advisory

---

## 🙏 Recognition

Contributors will be:
- Listed in CHANGELOG.md for their contributions
- Mentioned in release notes
- Credited in commit history
- Appreciated by the community!

---

## 📄 License

By contributing to CCW, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Thank you for contributing to Claude Code Workflow!** 🎉

Your contributions help make AI-assisted development better for everyone.

---

**Last Updated**: 2025-11-20
**Version**: 5.8.1
