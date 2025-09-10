# 🚀 Claude Code Workflow (CCW)
*The Neural Network for Software Development*

<div align="right">

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

<div align="center">

**Transform your development chaos into orchestrated brilliance**

*Where AI agents collaborate, complexity becomes clarity, and your codebase evolves into living documentation*

</div>

---

## 🌟 What Makes CCW Revolutionary?

Imagine having a **team of expert AI developers** working alongside you 24/7. CCW isn't just another workflow tool—it's a **living, breathing development ecosystem** that thinks, learns, and adapts to your project's DNA.

### 🎭 Meet Your AI Dream Team
- **🧠 Conceptual Planning Agent**: Your visionary architect who sees the big picture
- **⚡ Action Planning Agent**: The strategic executor who turns dreams into roadmaps  
- **💻 Code Developer**: Your tireless coding companion who implements with precision
- **🔍 Code Review Agent**: The perfectionist who ensures quality never slips
- **📚 Memory Gemini Bridge**: Your project historian who keeps everything documented

### 🎯 The Magic Happens in Three Layers

#### **🗂️ JSON-Only Data Model: Your Project's Brain**
Think of it as your project's **neural memory**—every decision, every task, every plan lives in pure, lightning-fast JSON. No more out-of-sync documentation nightmares!

- ⚡ **Sub-millisecond queries**: Your project responds faster than you can think
- 🔄 **Zero synchronization issues**: Single source of truth, always
- 🎯 **Pure data architecture**: Clean, fast, reliable

#### **🎪 Marker File Session Management: Instant Context Switching**
Like having **multiple development personalities** you can switch between instantly:

```bash
ls .workflow/.active-*  # See your active sessions at a glance
```

- 🏃‍♂️ **Atomic operations**: Session switching in microseconds
- 🔧 **Self-healing**: Automatic conflict resolution
- 📈 **Infinite scalability**: Hundreds of concurrent sessions, zero performance hit

#### **🧬 Progressive Complexity: Grows With Your Ambitions**

CCW **reads your project's mind** and adapts its sophistication:

| Your Project | CCW's Response | What You Get |
|-------------|----------------|--------------|
| **Quick fix** (<5 tasks) | 🎯 Minimal mode | Streamlined, no-nonsense workflow |
| **Feature work** (5-15 tasks) | ⚙️ Enhanced mode | Smart tracking + automated documentation |
| **Major project** (>15 tasks) | 🏰 Full suite | Complete orchestration + multi-level planning |

---

## 🎨 The Developer Experience Revolution

### 🌊 From Chaos to Flow State

**Before CCW:**
```
😰 "Where did I leave off?"
📝 "Is my documentation current?"
🤔 "What was the architecture again?"
⏰ "I've been stuck on this for hours..."
```

**After CCW:**
```bash
/workflow:session:resume "oauth-implementation"  # Instant context recovery
/context --format=hierarchy                      # See everything, beautifully organized
/gemini:analyze "authentication flow patterns"   # AI-powered insights
/codex:exec "@{src/auth/**/*} implement JWT refresh tokens"  # Autonomous execution
```

### 🎭 Your Workflow Becomes a Story

#### 🎪 **Act I: The Brainstorming Symphony**
```bash
/workflow:brainstorm "Payment gateway integration" \
  --perspectives=system-architect,security-expert,data-architect
```
Watch as **multiple AI experts** collaborate in real-time, each bringing their specialized knowledge to create a comprehensive foundation.

#### 🎯 **Act II: The Strategic Phase**
```bash
/workflow:plan --from-brainstorming
```
Your brainstorming insights transform into **crystal-clear implementation roadmaps** with dependency tracking and risk analysis.

#### ⚡ **Act III: The Execution Ballet**
```bash
/task:execute IMPL-1 --mode=auto
/gemini:execute IMPL-2.1  # Analysis-focused tasks
/codex:exec "@{src/api/**/*} implement payment validation"  # Development tasks
```
Watch your code **write itself** while maintaining the highest quality standards.

---

## 🛠️ Dual-CLI Superpowers

### 🔍 **Gemini: Your Project Detective**
*"Tell me everything about this codebase"*

```bash
gemini --all-files -p "@{src/**/*} @{CLAUDE.md} 
Analyze the authentication patterns and security implications"
```

**Gemini sees patterns you've never noticed**, understands architectural decisions, and provides insights that would take hours to discover manually.

### 🤖 **Codex: Your Autonomous Developer**
*"Build this feature while I grab coffee"*

```bash
codex --full-auto "@{**/*} Create a complete user dashboard with 
real-time notifications and responsive design"
```

**Codex doesn't just suggest—it implements**, tests, documents, and even handles edge cases you forgot to mention.

---

## 🏗️ Architecture That Scales With Your Dreams

### 🌳 Living Documentation System

Forget static README files. CCW creates a **living, breathing documentation ecosystem**:

```
📁 Your Project/
├── CLAUDE.md                    # 🌍 Project Universe View
├── src/
│   ├── CLAUDE.md               # 🏢 Domain Architecture
│   ├── components/
│   │   ├── CLAUDE.md           # 🧩 Component Patterns
│   │   └── auth/
│   │       └── CLAUDE.md       # 🔐 Implementation Details
```

**Each layer knows exactly what it should contain**—no more, no less. Your documentation **updates itself** as your code evolves.

### 🧠 Intelligence That Never Sleeps

#### 🎯 **Context-Aware Updates**
```bash
/update-memory-related  # "What changed? Let me update the docs intelligently"
```

CCW uses **git-aware change detection** to update only what matters, keeping your documentation **fresh and relevant**.

#### 🌊 **Full Project Synchronization**
```bash
/update-memory-full     # "Let me refresh everything from scratch"
```

Perfect for onboarding new team members or after major architectural changes.

---

## ⚡ Quick Start: From Zero to Hero

### 🚀 One-Line Installation
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

### 🎯 Essential Setup
Configure Gemini CLI integration:
```json
{
  "contextFileName": "CLAUDE.md"  // The magic connection
}
```

### 🎪 Your First Workflow
```bash
# 1. 🎭 Start with vision
/workflow:session:start "Build an AI-powered todo app"

# 2. 🧠 Gather perspectives  
/workflow:brainstorm "Todo app architecture" \
  --perspectives=ui-designer,system-architect,data-architect

# 3. 📋 Create the master plan
/workflow:plan --from-brainstorming

# 4. ⚡ Execute with precision
/workflow:execute --type=complex --auto-create-tasks

# 5. 🎯 Watch the magic happen
/context --format=hierarchy
```

---

## 🎭 Command Arsenal

### 🧠 **Intelligence Commands**
| Command | Superpower | Example |
|---------|------------|---------|
| `/gemini:mode:auto` | 🎯 **Smart Template Selection** | Auto-detects bug reports, feature requests, architecture questions |
| `/codex:mode:auto` | 🤖 **Autonomous Development** | Full-stack feature implementation while you focus on strategy |
| `/enhance-prompt` | 💡 **Context Amplification** | Transforms vague requests into precise technical specifications |

### 🎪 **Workflow Orchestration**
| Command | Magic | Result |
|---------|-------|---------|
| `/workflow:brainstorm` | 🎭 **Multi-Expert Collaboration** | 5 AI specialists collaborate on your challenge |
| `/workflow:plan-deep` | 🏗️ **Architectural Mastery** | 3-level deep planning with dependency mapping |
| `/workflow:execute` | ⚡ **Intelligent Automation** | Complexity-aware task orchestration |

### 🔧 **Task Mastery**
| Command | Power | Impact |
|---------|-------|---------|
| `/task:breakdown` | 🧩 **Smart Decomposition** | Complex tasks → manageable chunks |
| `/task:replan` | 🔄 **Adaptive Intelligence** | Requirements changed? No problem. |
| `/context` | 🎯 **Omniscient Awareness** | See everything, understand everything |

---

## 🌟 Real-World Scenarios

### 🚀 **Scenario: Building a SaaS Platform**
```bash
# Day 1: Vision
/workflow:session:start "Multi-tenant SaaS platform with real-time collaboration"
/workflow:brainstorm "SaaS architecture design" --perspectives=business-analyst,system-architect,security-expert

# Day 2: Foundation  
/workflow:plan-deep --complexity=high --depth=3
/task:create "Authentication & Authorization System"
/task:create "Multi-tenant Database Architecture"
/task:create "Real-time Communication Layer"

# Week 1-4: Implementation
/codex:mode:auto "Implement JWT-based authentication with role management"
/codex:mode:auto "Create tenant isolation middleware"
/codex:mode:auto "Build WebSocket-based collaboration features"

# Ongoing: Maintenance
/update-memory-related  # After each feature
/workflow:issue:create "Add OAuth2 integration"
/workflow:review --auto-fix
```

### 🐛 **Scenario: Emergency Bug Fix**
```bash
# The Crisis
/workflow:session:start "Critical payment processing bug in production"

# The Investigation
/gemini:analyze "Payment flow failures in @{src/payments/**/*} - analyze error patterns"

# The Solution
/codex:exec "@{src/payments/**/*} Fix payment validation race condition"

# The Recovery
/workflow:review --auto-fix
/update-memory-related
```

### 🔒 **Scenario: Security Audit**
```bash
# The Audit
/workflow:brainstorm "Security vulnerability assessment" --perspectives=security-expert,penetration-tester

# The Analysis
/gemini:mode:auto "Comprehensive security analysis of authentication system"

# The Remediation
/codex:mode:auto "Implement security fixes for identified vulnerabilities"

# The Documentation
/update-memory-full  # Complete security documentation update
```

---

## 🎯 Why Developers Are Obsessed

### 🧠 **Cognitive Superpowers**
- **🔮 Perfect Memory**: Never lose context again
- **⚡ Instant Expertise**: AI specialists at your fingertips  
- **🎯 Laser Focus**: Complex projects become manageable steps
- **📚 Living Knowledge**: Documentation that grows with your code

### 💪 **Productivity Amplification**
- **10x Faster Planning**: Multi-agent brainstorming in minutes
- **5x Better Code Quality**: Built-in review and testing integration
- **Zero Documentation Debt**: Self-updating project knowledge
- **Infinite Scalability**: Handle projects of any complexity

### 🎨 **Developer Joy**
- **Flow State Preservation**: Never lose your train of thought
- **Complexity Mastery**: Big problems become small wins
- **Autonomous Assistance**: AI that actually helps, doesn't hinder
- **Professional Growth**: Learn from AI experts in real-time

---

## 🚀 The Future is Now

CCW represents the **evolution of software development**—from manual, error-prone processes to **intelligent, adaptive workflows** that scale with your ambitions.

### 🌟 **What's Next?**
- 🤝 **Enhanced Multi-AI Collaboration**: Even more specialized agents
- 🌍 **Real-time Team Synchronization**: Distributed teams, unified flow
- 📊 **Predictive Project Analytics**: AI that predicts and prevents issues
- 🔧 **Custom Agent Training**: Teach CCW your unique patterns

---

## 🤝 Join the Revolution

```bash
# Fork the future
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow

# Make it yours
git checkout -b feature/my-amazing-contribution

# Share the magic
git push origin feature/my-amazing-contribution
```

---

<div align="center">

**🎭 Claude Code Workflow (CCW)**

*Where software development becomes an art form*

**Transform • Orchestrate • Elevate**

---

*Licensed under MIT • Built with ❤️ by the community • Powered by AI*

[⭐ Star us on GitHub](https://github.com/catlog22/Claude-Code-Workflow) • [📖 Full Documentation](https://github.com/catlog22/Claude-Code-Workflow/wiki) • [💬 Join Our Community](https://github.com/catlog22/Claude-Code-Workflow/discussions)

</div>