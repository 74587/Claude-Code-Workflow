#!/bin/bash
# medium-project-update.sh
# Layered parallel execution for medium projects (50-200 files)
# Emphasizes gemini CLI usage with direct file modification

set -e  # Exit on any error

echo "🚀 === Medium Project Layered Analysis ==="
echo "Project: $(pwd)"
echo "Timestamp: $(date)"

# Function to check if directory exists and has files
check_directory() {
    local dir=$1
    local pattern=$2
    if [ -d "$dir" ] && find "$dir" -type f $pattern -print -quit | grep -q .; then
        return 0
    else
        return 1
    fi
}

# Function to run gemini with error handling
run_gemini() {
    local cmd="$1"
    local desc="$2"
    echo "  📝 $desc"
    if ! eval "$cmd"; then
        echo "  ❌ Failed: $desc"
        return 1
    else
        echo "  ✅ Completed: $desc"
        return 0
    fi
}

echo ""
echo "🏗️  === Layer 1: Foundation modules (parallel) ==="
echo "Analyzing base dependencies: types, utils, core..."
(
  # Only run gemini commands for directories that exist
  if check_directory "src/types" "-name '*.ts' -o -name '*.js'"; then
    run_gemini "gemini -yolo -p '@{src/types/**/*} 
Analyze type definitions and interfaces. Update src/types/CLAUDE.md with:
- Type architecture patterns
- Interface design principles  
- Type safety guidelines
- Usage examples'" "Type definitions analysis" &
  fi

  if check_directory "src/utils" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/utils/**/*} 
Analyze utility functions and helpers. Update src/utils/CLAUDE.md with:
- Utility function patterns
- Helper library organization
- Common functionality guidelines
- Reusability principles'" "Utility functions analysis" &
  fi

  if check_directory "src/core" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/core/**/*} 
Analyze core modules and system architecture. Update src/core/CLAUDE.md with:
- Core system architecture
- Module initialization patterns
- System-wide configuration
- Base class implementations'" "Core modules analysis" &
  fi

  if check_directory "src/lib" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/lib/**/*} 
Analyze library modules and shared functionality. Update src/lib/CLAUDE.md with:
- Shared library patterns
- Cross-module utilities  
- External integrations
- Library architecture'" "Library modules analysis" &
  fi

  wait
)

echo ""
echo "🏭 === Layer 2: Business logic (parallel, depends on Layer 1) ==="
echo "Analyzing business modules with foundation context..."
(
  if check_directory "src/api" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/api/**/*} @{src/core/CLAUDE.md,src/types/CLAUDE.md} 
Analyze API endpoints and routes with core/types context. Update src/api/CLAUDE.md with:
- API architecture patterns
- Endpoint design principles
- Request/response handling
- Authentication integration
- Error handling patterns'" "API endpoints analysis" &
  fi

  if check_directory "src/services" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/services/**/*} @{src/utils/CLAUDE.md,src/types/CLAUDE.md} 
Analyze business services with utils/types context. Update src/services/CLAUDE.md with:
- Service layer architecture
- Business logic patterns
- Data processing workflows
- Service integration patterns
- Dependency injection'" "Business services analysis" &
  fi

  if check_directory "src/models" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/models/**/*} @{src/types/CLAUDE.md} 
Analyze data models with types context. Update src/models/CLAUDE.md with:
- Data model architecture
- Entity relationship patterns
- Validation strategies
- Model lifecycle management
- Database integration'" "Data models analysis" &
  fi

  if check_directory "src/database" "-name '*.ts' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{src/database/**/*} @{src/models/CLAUDE.md,src/core/CLAUDE.md} 
Analyze database layer with models/core context. Update src/database/CLAUDE.md with:
- Database architecture
- Query optimization patterns
- Migration strategies
- Connection management
- Data access patterns'" "Database layer analysis" &
  fi

  wait
)

echo ""
echo "🎨 === Layer 3: Application layer (depends on Layer 2) ==="
echo "Analyzing UI and application modules with business context..."
(
  if check_directory "src/components" "-name '*.tsx' -o -name '*.jsx' -o -name '*.vue'"; then
    run_gemini "gemini -yolo -p '@{src/components/**/*} @{src/api/CLAUDE.md,src/services/CLAUDE.md} 
Analyze UI components with API/services context. Update src/components/CLAUDE.md with:
- Component architecture patterns
- State management strategies
- Props and event handling
- Component lifecycle patterns
- Styling conventions'" "UI components analysis" &
  fi

  if check_directory "src/pages" "-name '*.tsx' -o -name '*.jsx' -o -name '*.vue'"; then
    run_gemini "gemini -yolo -p '@{src/pages/**/*} @{src/services/CLAUDE.md,src/components/CLAUDE.md} 
Analyze page components with services/components context. Update src/pages/CLAUDE.md with:
- Page architecture patterns
- Route management
- Data fetching strategies
- Layout compositions
- SEO considerations'" "Page components analysis" &
  fi

  if check_directory "src/hooks" "-name '*.ts' -o -name '*.js'"; then
    run_gemini "gemini -yolo -p '@{src/hooks/**/*} @{src/services/CLAUDE.md} 
Analyze custom hooks with services context. Update src/hooks/CLAUDE.md with:
- Custom hook patterns
- State logic reusability
- Effect management
- Hook composition strategies
- Performance considerations'" "Custom hooks analysis" &
  fi

  if check_directory "src/styles" "-name '*.css' -o -name '*.scss' -o -name '*.less'"; then
    run_gemini "gemini -yolo -p '@{src/styles/**/*} @{src/components/CLAUDE.md} 
Analyze styling with components context. Update src/styles/CLAUDE.md with:
- Styling architecture
- CSS methodology
- Theme management
- Responsive design patterns
- Design system integration'" "Styling analysis" &
  fi

  wait
)

echo ""
echo "📋 === Layer 4: Supporting modules (parallel) ==="
echo "Analyzing configuration, tests, and documentation..."
(
  if check_directory "tests" "-name '*.test.*' -o -name '*.spec.*'"; then
    run_gemini "gemini -yolo -p '@{tests/**/*,**/*.test.*,**/*.spec.*} 
Analyze testing strategy and patterns. Update tests/CLAUDE.md with:
- Testing architecture
- Unit test patterns
- Integration test strategies
- Mocking and fixtures
- Test data management
- Coverage requirements'" "Testing strategy analysis" &
  fi

  if check_directory "config" "-name '*.json' -o -name '*.js' -o -name '*.yaml'"; then
    run_gemini "gemini -yolo -p '@{config/**/*,*.config.*,.env*} 
Analyze configuration management. Update config/CLAUDE.md with:
- Configuration architecture
- Environment management
- Secret handling patterns
- Build configuration
- Deployment settings'" "Configuration analysis" &
  fi

  if check_directory "scripts" "-name '*.sh' -o -name '*.js' -o -name '*.py'"; then
    run_gemini "gemini -yolo -p '@{scripts/**/*} 
Analyze build and deployment scripts. Update scripts/CLAUDE.md with:
- Build process documentation
- Deployment workflows
- Development scripts
- Automation patterns
- CI/CD integration'" "Scripts analysis" &
  fi

  wait
)

echo ""
echo "🎯 === Layer 5: Root documentation integration ==="
echo "Generating comprehensive root documentation..."

# Collect all existing CLAUDE.md files
existing_docs=$(find . -name "CLAUDE.md" -path "*/src/*" | sort)
if [ -n "$existing_docs" ]; then
    echo "Found module documentation:"
    echo "$existing_docs" | sed 's/^/  📄 /'
    
    run_gemini "gemini -yolo -p '@{src/*/CLAUDE.md,tests/CLAUDE.md,config/CLAUDE.md,scripts/CLAUDE.md} @{CLAUDE.md} 
Integrate all module documentation and update root CLAUDE.md with:

## Project Overview
- Complete project architecture summary
- Technology stack and dependencies
- Module integration patterns
- Development workflow and guidelines

## Architecture
- System design principles  
- Module interdependencies
- Data flow patterns
- Key architectural decisions

## Development Guidelines
- Coding standards and patterns
- Testing strategies
- Deployment procedures
- Contribution guidelines

## Module Summary
- Brief overview of each module's purpose
- Key patterns and conventions
- Integration points
- Performance considerations

Focus on providing a comprehensive yet concise project overview that serves as the single source of truth for new developers.'" "Root documentation integration"
else
    echo "⚠️  No module documentation found, generating basic root documentation..."
    run_gemini "gemini -yolo -p '@{**/*} @{CLAUDE.md} 
Generate comprehensive root CLAUDE.md documentation with:
- Project overview and architecture
- Technology stack summary
- Development guidelines
- Key patterns and conventions'" "Basic root documentation"
fi

echo ""
echo "✅ === Medium project update completed ==="
echo "📊 Summary:"
echo "  - Layered analysis completed in dependency order"
echo "  - All gemini commands executed with -yolo for direct file modification"  
echo "  - Module-specific CLAUDE.md files updated with contextual information"
echo "  - Root documentation integrated with complete project overview"
echo "  - Timestamp: $(date)"

# Optional: Show generated documentation structure
echo ""
echo "📁 Generated documentation structure:"
find . -name "CLAUDE.md" | sort | sed 's/^/  📄 /'