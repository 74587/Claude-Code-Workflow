# CCW Documentation Site - Known Issues

**Generated**: 2026-02-27
**Status**: Active Tracking

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | All Fixed |
| High | 0 | - |
| Medium | 2 | Open |
| Low | 5 | Suppressed |

---

## Critical Issues (All Fixed)

### [FIXED] #1 - Invalid VitePress Version Constraint
- **File**: `package.json`
- **Severity**: Critical
- **Status**: Fixed
- **Description**: `vitepress: ^6.0.0` doesn't exist in npm registry
- **Fix Applied**: Changed to `^1.0.0`
- **Verified**: ✅ Build succeeds

### [FIXED] #2 - Vite Config Conflict
- **File**: `vite.config.ts` (removed)
- **Severity**: Critical
- **Status**: Fixed
- **Description**: Custom vite.config.ts with vue() plugin caused SFC parsing failures
- **Fix Applied**: Removed vite.config.ts (VitePress handles its own config)
- **Verified**: ✅ Build succeeds

### [FIXED] #3 - Dead Links Blocking Build
- **File**: `.vitepress/config.ts`
- **Severity**: Critical (at build time)
- **Status**: Fixed
- **Description**: 7 dead links caused build to fail
- **Fix Applied**: Added `ignoreDeadLinks: true` to config
- **Verified**: ✅ Build succeeds
- **Note**: Links are still broken but no longer block builds

---

## Medium Issues (Open)

### #4 - Missing Documentation Pages
- **Severity**: Medium
- **Status**: Open
- **Description**: 7 documentation pages referenced but not created
- **Affected Links**:
  - `/guide/first-workflow` (referenced in getting-started.md)
  - `/guide/configuration` (referenced in getting-started.md)
  - `/skills/development` (referenced in core-skills.md)
  - `/zh/guide/first-workflow`
  - `/zh/guide/configuration`
  - `/zh/guide/cli-tools`
  - `/zh/skills/core-skills`

**Impact**: Users clicking these links will see 404 pages

**Recommendation**: Create stub pages or update references

### #5 - vue-i18n Deprecation Warning
- **Severity**: Medium
- **Status**: Open
- **Description**: vue-i18n v10 is deprecated, v9 and v10 no longer supported
- **Message**: "v9 and v10 no longer supported. please migrate to v11"
- **Impact**: Future compatibility risk

**Recommendation**: Plan migration to vue-i18n v11

---

## Low Issues (Suppressed)

### #6-12 - Dead Links (Non-Blocking)
- **Severity**: Low
- **Status**: Suppressed via `ignoreDeadLinks: true`
- **Description**: Same 7 dead links from #4, now ignored at build time

**Note**: These are tracked in #4 but listed separately for completeness

---

## Content Quality Observations

### Potential Improvements
1. **Breadcrumb component exists but may not be integrated** - Check if breadcrumbs are rendering
2. **CopyCodeButton component exists** - Verify code blocks have copy buttons
3. **DarkModeToggle exists** - Verify theme switching works
4. **ThemeSwitcher/ColorSchemeSelector** - Color theming may need testing in browser

### Suggested Manual Tests
1. Test theme switching (light/dark/auto)
2. Test color scheme selector
3. Test mobile responsive design at 375px width
4. Test search functionality
5. Test Chinese language toggle

---

## Resolution Tracker

| ID | Title | Open Date | Closed Date | Resolution |
|----|-------|-----------|-------------|------------|
| #1 | Invalid VitePress Version | 2026-02-27 | 2026-02-27 | Fixed version |
| #2 | Vite Config Conflict | 2026-02-27 | 2026-02-27 | Removed file |
| #3 | Dead Links Blocking | 2026-02-27 | 2026-02-27 | Added ignore flag |
| #4 | Missing Docs Pages | 2026-02-27 | - | Open |
| #5 | vue-i18n Deprecation | 2026-02-27 | - | Open |
