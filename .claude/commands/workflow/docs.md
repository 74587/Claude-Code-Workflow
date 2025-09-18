---
name: docs
description: Generate hierarchical architecture and API documentation using doc-generator agent with flow_control
usage: /workflow:docs <type> [scope]
argument-hint: "architecture"|"api"|"all"
examples:
  - /workflow:docs all
  - /workflow:docs architecture src/modules
  - /workflow:docs api --scope api/
---

# Hierarchical Documentation Generator

## Usage
```bash
/workflow:docs <type> [scope]
```

## Document Types
- **architecture**: System architecture documentation (bottom-up analysis)
- **api**: API interface documentation (module-first approach)
- **all**: Complete documentation suite with full hierarchy (default)

## Generation Strategy
Uses **doc-generator agent** with **flow_control** for structured documentation generation:
1. Agent receives task with embedded flow_control structure
2. Agent executes pre_analysis steps using CLI tools
3. Agent generates hierarchical documentation (module → system)
4. Agent tracks progress with TodoWrite throughout process

## Output Structure
```
.workflow/docs/
├── README.md              # System navigation
├── modules/               # Level 1: Module documentation
│   ├── [module-1]/
│   │   ├── overview.md
│   │   ├── api.md
│   │   ├── dependencies.md
│   │   └── examples.md
│   └── [module-n]/...
├── architecture/          # Level 2: System architecture
│   ├── system-design.md
│   ├── module-map.md
│   ├── data-flow.md
│   └── tech-stack.md
└── api/                   # Level 2: Unified API docs
    ├── unified-api.md
    └── openapi.yaml
```

## Complete Documentation Generation (All Types)

### Agent Task Invocation
```bash
Task(
  description="Generate complete system documentation",
  prompt="[FLOW_CONTROL] You are the doc-generator agent tasked with creating comprehensive system documentation. Execute the embedded flow_control structure for hierarchical documentation generation.

Your flow_control includes these pre_analysis steps:
1. Initialize TodoWrite tracking for documentation process
2. Discover project modules using bash commands
3. Analyze project structure with gemini-wrapper
4. Perform deep module analysis with gemini-wrapper
5. Scan API endpoints using bash/rg commands
6. Analyze API structure with gemini-wrapper

After pre_analysis, generate documentation:
- Create module documentation in .workflow/docs/modules/
- Generate architecture docs in .workflow/docs/architecture/
- Create unified API docs in .workflow/docs/api/
- Build main navigation in .workflow/docs/README.md

Use TodoWrite to track progress and update status as you complete each phase.",
  subagent_type="doc-generator"
)
```

## Architecture-Only Documentation

### Agent Task for Architecture Focus
```bash
Task(
  description="Generate architecture documentation",
  prompt="[FLOW_CONTROL] You are the doc-generator agent focused on architecture documentation.

Execute flow_control with these pre_analysis steps:
1. Initialize TodoWrite for architecture documentation tracking
2. Analyze system architecture with gemini-wrapper using comprehensive architectural analysis rules
3. Generate architecture documentation in .workflow/docs/architecture/

Focus on system design, module relationships, and technology stack documentation.",
  subagent_type="doc-generator"
)
```

## API-Only Documentation

### Agent Task for API Focus
```bash
Task(
  description="Generate API documentation",
  prompt="[FLOW_CONTROL] You are the doc-generator agent focused on API documentation.

Execute flow_control with these pre_analysis steps:
1. Initialize TodoWrite for API documentation tracking
2. Scan for API endpoints using bash/rg commands
3. Analyze API patterns with gemini-wrapper for comprehensive documentation
4. Generate API documentation in .workflow/docs/api/

Create complete API reference with OpenAPI specifications and usage examples.",
  subagent_type="doc-generator"
)
```

## Flow Control Templates

The doc-generator agent internally uses these flow_control structures:

### Complete Documentation Flow Control
- **initialize_tracking**: Set up TodoWrite progress tracking
- **discover_modules**: Find project modules with bash commands
- **analyze_project_structure**: Comprehensive analysis with gemini-wrapper
- **analyze_individual_modules**: Deep module analysis with gemini-wrapper
- **scan_api_endpoints**: API endpoint discovery with bash/rg
- **analyze_api_structure**: API documentation with gemini-wrapper

### Architecture Flow Control
- **initialize_architecture_tracking**: TodoWrite setup for architecture
- **analyze_architecture**: System architecture analysis with gemini-wrapper

### API Flow Control
- **initialize_api_tracking**: TodoWrite setup for API documentation
- **scan_apis**: API endpoint scanning with bash/rg
- **analyze_api_patterns**: API documentation with gemini-wrapper

## Analysis Templates

### Project Structure Analysis Rules
- Identify main modules and purposes
- Map directory organization patterns
- Extract entry points and configuration files
- Recognize architectural styles and design patterns
- Analyze module relationships and dependencies
- Document technology stack and requirements

### Module Analysis Rules
- Identify module boundaries and entry points
- Extract exported functions, classes, interfaces
- Document internal organization and structure
- Analyze API surfaces with types and parameters
- Map dependencies within and between modules
- Extract usage patterns and examples

### API Analysis Rules
- Classify endpoint types (REST, GraphQL, WebSocket, RPC)
- Extract request/response parameters and schemas
- Document authentication and authorization requirements
- Generate OpenAPI 3.0 specification structure
- Create comprehensive endpoint documentation
- Provide usage examples and integration guides

## Integration with Workflow System

### Automatic Context Loading
- Generated documentation serves as context for `/workflow:plan` and `/workflow:execute`
- Documentation provides single source of truth for system understanding
- Other workflow commands automatically reference `.workflow/docs/` for context

### Progressive Enhancement
- Documentation builds incrementally from modules to system
- Individual modules can be re-documented as needed
- System documentation synthesizes from module-level understanding

## Key Benefits

### Agent + Flow Control Architecture
- **Unified Execution**: All documentation generation through doc-generator agent
- **Structured Analysis**: Flow control ensures systematic context gathering
- **CLI Tool Integration**: Agent uses bash, gemini-wrapper, and codex internally
- **Progress Tracking**: TodoWrite provides visibility throughout process

### Hierarchical Documentation
- **Bottom-up Analysis**: Start with detailed module understanding
- **System Synthesis**: Build unified documentation from module knowledge
- **Two-level Architecture**: Module-level and system-level documentation

### Quality and Consistency
- **Flow Control Ensures Completeness**: Structured analysis prevents missing components
- **Agent Expertise**: Specialized doc-generator provides consistent quality
- **Tool Optimization**: Right tool for each analysis phase
- **Error Recovery**: Progress tracking enables recovery from failures

## Usage Examples

```bash
# Generate complete documentation suite
/workflow:docs all

# Generate only architecture documentation
/workflow:docs architecture

# Generate only API documentation
/workflow:docs api

# Generate scoped documentation
/workflow:docs architecture src/core,src/auth
```

The system executes the appropriate agent task with embedded flow_control, ensuring systematic and comprehensive documentation generation.