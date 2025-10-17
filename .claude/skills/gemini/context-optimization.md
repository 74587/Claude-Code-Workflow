# Gemini Context Optimization Examples

> **📖 Template Structure**: See [Universal Template Structure](command-structure.md) for detailed field guidelines.

## Focused Analysis with Exclusions

```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Audit authentication security for compliance certification
TASK: Review JWT implementation, password hashing, session management, token refresh logic, MFA support, rate limiting, brute force protection
MODE: analysis
CONTEXT: @{**/*.ts,!**/*.test.ts,!**/*.mock.ts,../../config/security.json,../../middleware/auth.middleware.ts} Targeting SOC 2 Type II compliance, current system uses bcrypt, JWT with RS256, Redis for session store
EXPECTED: Security compliance report including: 1) Compliance checklist (SOC 2 controls mapped to implementation), 2) Vulnerability assessment (with CVE references), 3) Configuration review, 4) Encryption strength analysis, 5) Audit logging evaluation, 6) Remediation plan with compliance deadlines, 7) Evidence collection guide for auditors
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) | Map to SOC 2 CC6.1, CC6.6, CC6.7 controls | Follow NIST password guidelines | Validate OWASP ASVS Level 2 compliance | Check for hardcoded secrets | Evaluate token expiration policies | Include incident response procedures | Reference GDPR data handling requirements
"
```

**Key Points**:
- **Context exclusions**: `!` pattern for test and mock files
- **Compliance context**: Specific certification requirements
- **Detailed EXPECTED**: Compliance-focused deliverables with evidence collection
- **Compliance RULES**: Specific standards (SOC 2, NIST, OWASP, GDPR) + control mappings

## Large Codebase with Scoped Analysis

Split large analysis into focused modules to avoid timeout.

### Module 1: Core Analysis

```bash
cd src/core && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze core module patterns to establish architectural foundation
TASK: Review core abstractions, utility functions, base classes, shared types, configuration management
MODE: analysis
CONTEXT: @{**/*.ts,../../CLAUDE.md} Core module used by 15 feature modules, no external dependencies allowed
EXPECTED: Core architecture analysis: 1) Abstraction layer review, 2) Dependency graph (showing zero external deps), 3) Reusability metrics, 4) API stability assessment, 5) Recommended improvements prioritized by breaking change risk
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on zero-dependency principle | Evaluate backward compatibility | Consider semver implications | Document all public APIs | Assess bundle size impact
"
```

### Module 2: Features Analysis (separate execution)

```bash
cd src/features && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze feature module patterns referencing core architecture findings
TASK: Review feature implementations, core module usage, inter-feature dependencies, feature flag patterns
MODE: analysis
CONTEXT: @{**/*.ts,../core/**/*.ts,../../CLAUDE.md} Core analysis results: 5 base classes, 12 utilities, stable API since v2.0
EXPECTED: Feature pattern analysis: 1) Core usage compliance report, 2) Inter-feature coupling matrix, 3) Feature flag effectiveness, 4) Code reuse opportunities, 5) Migration path to reduce coupling
RULES: Reference core module standards from previous analysis | Identify tight coupling antipatterns | Evaluate feature flag strategy | Consider feature extraction to separate packages | Follow plugin architecture where applicable
"
```

**Key Points**:
- **Split strategy**: Large codebase divided by module
- **Context flow**: Module 2 references Module 1 results
- **Scoped EXPECTED**: Each module has focused deliverables
- **Progressive RULES**: Build on previous analysis findings

## Directory-Scoped Analysis

Use `cd` pattern to reduce context size:

```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Security audit of authentication module
TASK: Deep security analysis of auth implementation
MODE: analysis
CONTEXT: @{**/*.ts} All files in current directory
EXPECTED: Security audit report
RULES: Focus on OWASP Top 10
"
```

**Benefits**:
- Reduced context size
- Faster execution
- Focused analysis
- Avoid irrelevant code inclusion
