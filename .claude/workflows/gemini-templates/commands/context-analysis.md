# Context Analysis Command Templates

**完整的上下文获取命令示例**

## 项目完整上下文获取

### 基础项目上下文
```bash
# 获取项目完整上下文
cd /project/root && gemini --all-files -p "@{CLAUDE.md,**/*CLAUDE.md}

Extract comprehensive project context for agent coordination:
1. Implementation patterns and coding standards
2. Available utilities and shared libraries
3. Architecture decisions and design principles
4. Integration points and module dependencies
5. Testing strategies and quality standards

Output: Context package with patterns, utilities, standards, integration points"
```

### 技术栈特定上下文
```bash
# React 项目上下文
cd /project/root && gemini --all-files -p "@{src/components/**/*,src/hooks/**/*} @{CLAUDE.md}

React application context analysis:
1. Component patterns and composition strategies
2. Hook usage patterns and state management
3. Styling approaches and design system
4. Testing patterns and coverage strategies
5. Performance optimization techniques

Output: React development context with specific patterns"

# Node.js API 上下文
cd /project/root && gemini --all-files -p "@{**/api/**/*,**/routes/**/*,**/services/**/*} @{CLAUDE.md}

Node.js API context analysis:
1. Route organization and endpoint patterns
2. Middleware usage and request handling
3. Service layer architecture and patterns
4. Database integration and data access
5. Error handling and validation strategies

Output: API development context with integration patterns"
```

## 领域特定上下文

### 认证系统上下文
```bash
# 认证和安全上下文
gemini -p "@{**/*auth*,**/*login*,**/*session*,**/*security*} @{CLAUDE.md}

Authentication and security context analysis:
1. Authentication mechanisms and flow patterns
2. Authorization and permission management
3. Session management and token handling
4. Security middleware and protection layers
5. Encryption and data protection methods

Output: Security implementation context with patterns"
```

### 数据层上下文
```bash
# 数据库和模型上下文
gemini -p "@{**/models/**/*,**/db/**/*,**/migrations/**/*} @{CLAUDE.md}

Database and data layer context analysis:
1. Data model patterns and relationships
2. Query patterns and optimization strategies
3. Migration patterns and schema evolution
4. Database connection and transaction handling
5. Data validation and integrity patterns

Output: Data layer context with implementation patterns"
```

## 并行上下文获取

### 多层并行分析
```bash
# 按架构层级并行获取上下文
(
  cd src/frontend && gemini --all-files -p "@{CLAUDE.md} Frontend layer context analysis" &
  cd src/backend && gemini --all-files -p "@{CLAUDE.md} Backend layer context analysis" &
  cd src/database && gemini --all-files -p "@{CLAUDE.md} Data layer context analysis" &
  wait
)
```

### 跨领域并行分析
```bash
# 按功能领域并行获取上下文
(
  gemini -p "@{**/*auth*,**/*login*} @{CLAUDE.md} Authentication context" &
  gemini -p "@{**/api/**/*,**/routes/**/*} @{CLAUDE.md} API endpoint context" &
  gemini -p "@{**/components/**/*,**/ui/**/*} @{CLAUDE.md} UI component context" &
  gemini -p "@{**/*.test.*,**/*.spec.*} @{CLAUDE.md} Testing strategy context" &
  wait
)
```

## 模板引入示例

### 使用提示词模板
```bash
# 基础模板引入
gemini -p "@{src/**/*} $(cat ~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt)"

# 组合多个模板
gemini -p "@{src/**/*} $(cat <<'EOF'
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/architecture.txt)

Additional focus:
$(cat ~/.claude/workflows/gemini-templates/prompts/analysis/quality.txt)
EOF
)"
```

### 条件模板选择
```bash
# 基于项目特征动态选择模板
if [ -f "package.json" ] && grep -q "react" package.json; then
    TEMPLATE="~/.claude/workflows/gemini-templates/prompts/tech/react-component.txt"
elif [ -f "requirements.txt" ]; then
    TEMPLATE="~/.claude/workflows/gemini-templates/prompts/tech/python-api.txt"
else
    TEMPLATE="~/.claude/workflows/gemini-templates/prompts/analysis/pattern.txt"
fi

gemini -p "@{src/**/*} @{CLAUDE.md} $(cat $TEMPLATE)"
```

## 错误处理和回退

### 带回退的上下文获取
```bash
# 智能回退策略
get_context_with_fallback() {
    local target_dir="$1"
    local analysis_type="${2:-general}"
    
    # 策略 1: 目录导航 + --all-files
    if cd "$target_dir" 2>/dev/null; then
        echo "Using directory navigation approach..."
        if gemini --all-files -p "@{CLAUDE.md} $analysis_type context analysis"; then
            cd - > /dev/null
            return 0
        fi
        cd - > /dev/null
    fi
    
    # 策略 2: 文件模式匹配
    echo "Fallback to pattern matching..."
    if gemini -p "@{$target_dir/**/*} @{CLAUDE.md} $analysis_type context analysis"; then
        return 0
    fi
    
    # 策略 3: 最简单的通用模式
    echo "Using generic fallback..."
    gemini -p "@{**/*} @{CLAUDE.md} $analysis_type context analysis"
}

# 使用示例
get_context_with_fallback "src/components" "component"
```

### 资源感知执行
```bash
# 检测系统资源并调整执行策略
smart_context_analysis() {
    local estimated_files
    estimated_files=$(find . -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | wc -l)
    
    if [ "$estimated_files" -gt 1000 ]; then
        echo "Large codebase detected ($estimated_files files). Using focused analysis..."
        
        # 分块执行
        gemini -p "@{src/components/**/*.{jsx,tsx}} @{CLAUDE.md} Component patterns" &
        gemini -p "@{src/services/**/*.{js,ts}} @{CLAUDE.md} Service patterns" &
        gemini -p "@{src/utils/**/*.{js,ts}} @{CLAUDE.md} Utility patterns" &
        wait
    else
        echo "Standard analysis for manageable codebase..."
        cd /project/root && gemini --all-files -p "@{CLAUDE.md} Comprehensive context analysis"
    fi
}
```

## 结果处理和整合

### 上下文结果解析
```bash
# 解析并结构化上下文结果
parse_context_results() {
    local results_file="$1"
    
    echo "## Context Analysis Summary"
    echo "Generated: $(date)"
    echo ""
    
    # 提取关键模式
    echo "### Key Patterns Found:"
    grep -E "Pattern:|pattern:" "$results_file" | sed 's/^/- /'
    echo ""
    
    # 提取工具和库
    echo "### Available Utilities:"
    grep -E "Utility:|utility:|Library:|library:" "$results_file" | sed 's/^/- /'
    echo ""
    
    # 提取集成点
    echo "### Integration Points:"
    grep -E "Integration:|integration:|API:|api:" "$results_file" | sed 's/^/- /'
    echo ""
}
```

### 上下文缓存
```bash
# 缓存上下文结果以供复用
cache_context_results() {
    local project_signature="$(pwd | md5sum | cut -d' ' -f1)"
    local cache_dir="~/.cache/gemini-context"
    local cache_file="$cache_dir/$project_signature.context"
    
    mkdir -p "$cache_dir"
    
    echo "# Context Cache - $(date)" > "$cache_file"
    echo "# Project: $(pwd)" >> "$cache_file"
    echo "" >> "$cache_file"
    
    # 保存上下文结果
    cat >> "$cache_file"
}
```

## 性能优化示例

### 内存优化执行
```bash
# 内存感知的上下文获取
memory_optimized_context() {
    local available_memory
    
    # Linux 系统内存检测
    if command -v free >/dev/null 2>&1; then
        available_memory=$(free -m | awk 'NR==2{print $7}')
        
        if [ "$available_memory" -lt 1000 ]; then
            echo "Low memory mode: Using selective patterns"
            
            # 仅分析关键文件
            gemini -p "@{src/**/*.{js,ts,jsx,tsx}} @{CLAUDE.md} Core patterns only" --timeout=30
        else
            echo "Standard memory mode: Full analysis"
            cd /project/root && gemini --all-files -p "@{CLAUDE.md} Complete context analysis"
        fi
    else
        echo "Memory detection unavailable, using standard mode"
        cd /project/root && gemini --all-files -p "@{CLAUDE.md} Standard context analysis"
    fi
}
```

这些命令模板提供了完整的、可直接执行的上下文获取示例，涵盖了各种项目类型、规模和复杂度的情况。