# Qwen Advanced Multi-Phase Workflows

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines.

## Security Audit → Remediation → Verification Workflow

This three-phase workflow demonstrates comprehensive security audit with remediation and verification.

### Phase 1: Security Analysis

```bash
cd src && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Conduct comprehensive security audit for production hardening
TASK: Analyze security vulnerabilities: SQL injection, XSS, CSRF, authentication bypass, authorization flaws, sensitive data exposure, cryptographic weaknesses, dependency vulnerabilities, configuration issues
MODE: analysis
CONTEXT: @{**/*.ts,**/*.json,!**/node_modules/**,package.json,package-lock.json,.env.example} Web application with 100k users, handles PII and payment data, currently no WAF, uses Express 4.18, Helmet configured, CORS enabled
EXPECTED: Security audit report: 1) Executive Summary (risk score), 2) OWASP Top 10 assessment (mapped findings), 3) Dependency vulnerability scan (CVE list with CVSS), 4) Authentication/Authorization review, 5) Data protection analysis (encryption at rest/transit), 6) Input validation gaps, 7) Configuration hardening checklist, 8) Remediation plan (prioritized by CVSS score), 9) Estimated fix effort per issue
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) | Map all findings to OWASP Top 10 2021 | Include CVE references for dependencies | Check for hardcoded secrets (regex patterns) | Validate JWT implementation | Review CORS policy | Assess rate limiting coverage | Verify HTTPS enforcement | Check for information disclosure | Test for broken access control
"
```

### Phase 2: Documentation Generation (after remediation)

```bash
~/.claude/scripts/qwen-wrapper --approval-mode yolo -p "
PURPOSE: Document security controls for audit trail and team reference
TASK: Create security documentation based on Phase 1 findings and remediation actions
MODE: write
CONTEXT: Phase 1 audit identified: 3 high-priority issues (fixed), 7 medium issues (fixed), 12 low issues (backlog), implemented WAF with ModSecurity, added rate limiting, upgraded dependencies, enabled security headers
EXPECTED: Create SECURITY.md with sections: 1) Security Architecture Overview, 2) Threat Model, 3) Security Controls (preventive/detective/corrective), 4) Authentication & Authorization, 5) Data Protection, 6) API Security, 7) Dependency Management, 8) Incident Response Plan, 9) Security Checklist for Developers, 10) Audit Log. Include before/after comparisons for fixed issues.
RULES: Reference CWE IDs for all controls | Include mitigation strategies | Document security testing procedures | Add security review checklist for PRs | Reference OWASP ASVS controls | Include incident response runbook | Add security metrics for monitoring | Create security champion rotation schedule
"
```

### Phase 3: Verification (after documentation)

```bash
cd src && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Verify security remediation completeness and control effectiveness
TASK: Review implemented security fixes against Phase 1 findings, validate controls are working as documented in Phase 2, identify any gaps or regressions
MODE: analysis
CONTEXT: @{**/*.ts,SECURITY.md,tests/security/**/*.test.ts} All high and medium issues marked as fixed, 15 new security tests added, dependency updates applied, WAF rules configured
EXPECTED: Verification report: 1) Fix validation (each Phase 1 issue reviewed), 2) Control effectiveness assessment, 3) Test coverage for security controls, 4) Regression check, 5) Documentation accuracy review, 6) Remaining risks and acceptance criteria, 7) Go/No-Go recommendation for production deployment
RULES: Validate each fix has corresponding test | Verify security headers in HTTP responses | Check WAF rules are active | Confirm rate limiting is enforced | Validate dependency versions match recommendations | Review security test coverage >80% | Confirm incident response contacts are current
"
```

### Key Points

- **Three-phase workflow**: Audit → Document → Verify
- **Context continuity**: Each phase references previous results
- **Comprehensive coverage**: From findings to fixes to verification
- **Production readiness**: Includes go/no-go decision
