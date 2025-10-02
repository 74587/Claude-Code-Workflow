# 🔧 Claude Code Workflow (CCW) v3.2.1 Release Notes

**Release Date**: October 2, 2025
**Release Type**: Patch Release - Documentation Fix
**Repository**: https://github.com/catlog22/Claude-Code-Workflow

---

## 📋 Overview

CCW v3.2.1 is a critical documentation fix release that corrects `workflow-session.json` path references throughout the brainstorming workflow documentation. This ensures consistency with the architecture specification defined in `workflow-architecture.md`.

---

## 🐛 Bug Fixes

### **Documentation Path Corrections**

**Issue**: Documentation incorrectly referenced `workflow-session.json` inside the `.brainstorming/` subdirectory

**Impact**:
- Confusing path references in 9 brainstorming role documentation files
- Inconsistency with architectural specifications
- Potential runtime errors when commands attempt to read session metadata

**Fixed Files** (9 total):
1. ✅ `data-architect.md`
2. ✅ `product-manager.md`
3. ✅ `product-owner.md`
4. ✅ `scrum-master.md`
5. ✅ `subject-matter-expert.md`
6. ✅ `ui-designer.md`
7. ✅ `ux-expert.md`
8. ✅ `auto-parallel.md`
9. ✅ `artifacts.md`

**Corrections Applied**:
- ❌ **Incorrect**: `.workflow/WFS-{session}/.brainstorming/workflow-session.json`
- ✅ **Correct**: `.workflow/WFS-{session}/workflow-session.json`

---

## 📐 Architecture Alignment

### Confirmed Standard Structure
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # ✅ Session metadata (root level)
├── .brainstorming/              # Brainstorming artifacts subdirectory
│   └── topic-framework.md
├── IMPL_PLAN.md
├── TODO_LIST.md
└── .task/
    └── IMPL-*.json
```

### Key Points
- `workflow-session.json` is **always at session root level**
- `.brainstorming/` directory contains **only** framework and analysis files
- No session metadata files inside subdirectories

---

## 📊 Changes Summary

| Category | Files Changed | Lines Modified |
|----------|--------------|----------------|
| Documentation Fixes | 9 | 19 insertions, 18 deletions |
| Path Corrections | 8 role files | 2 corrections per file |
| Structure Clarifications | 1 artifacts file | Added architectural note |

---

## ✅ Verification

**Pre-Release Checks**:
- ✅ No incorrect `.brainstorming/workflow-session.json` references
- ✅ No legacy `session.json` references
- ✅ All brainstorming roles use correct paths
- ✅ Architecture consistency verified with Gemini analysis

---

## 🔄 Upgrade Instructions

### For Existing Users

**No action required** - This is a documentation-only fix.

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Review updated documentation:
   - `.claude/commands/workflow/brainstorm/*.md`

### For New Users

Simply clone the repository with the correct documentation:
```bash
git clone https://github.com/catlog22/Claude-Code-Workflow.git
```

---

## 📚 Related Documentation

- **Architecture Reference**: `.claude/workflows/workflow-architecture.md`
- **Brainstorming Commands**: `.claude/commands/workflow/brainstorm/`
- **Session Management**: `.claude/commands/workflow/session/`

---

## 🙏 Acknowledgments

Special thanks to the analysis tools used in this fix:
- **Gemini CLI**: Path verification and consistency checking
- **Codex**: Initial codebase analysis
- **Claude Code**: Documentation review and corrections

---

## 🔗 Links

- **Full Changelog**: [v3.2.0...v3.2.1](https://github.com/catlog22/Claude-Code-Workflow/compare/v3.2.0...v3.2.1)
- **Issues Fixed**: Documentation consistency issue
- **Previous Release**: [v3.2.0 Release Notes](RELEASE_NOTES_v3.2.0.md)

---

## 📝 Notes

- This is a **non-breaking change** - existing workflows will continue to function
- Documentation now correctly reflects the implemented architecture
- No code changes were necessary - this was purely a documentation correction

---

**Contributors**: Claude Code Development Team
**License**: MIT
**Support**: [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues)
