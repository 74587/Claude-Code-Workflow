# Parallel Execution Command Templates

**并行执行模式的完整命令示例**

## 基础并行执行模式

### 标准并行结构
```bash
# 基本并行执行模板
(
  command1 &
  command2 &
  command3 &
  wait  # 等待所有并行进程完成
)
```

### 资源限制并行执行
```bash
# 限制并行进程数量
MAX_PARALLEL=3
parallel_count=0

for cmd in "${commands[@]}"; do
    eval "$cmd" &
    ((parallel_count++))
    
    # 达到并发限制时等待
    if ((parallel_count >= MAX_PARALLEL)); then
        wait
        parallel_count=0
    fi
done

wait  # 等待剩余进程
```

## 按架构层级并行

### 前后端分离并行
```bash
# 前后端架构并行分析
(
  cd src/frontend && gemini --all-files -p "@{CLAUDE.md} Frontend architecture and patterns analysis" &
  cd src/backend && gemini --all-files -p "@{CLAUDE.md} Backend services and API patterns analysis" &
  cd src/shared && gemini --all-files -p "@{CLAUDE.md} Shared utilities and common patterns analysis" &
  wait
)
```

### 三层架构并行
```bash
# 表示层、业务层、数据层并行分析
(
  gemini -p "@{src/views/**/*,src/components/**/*} @{CLAUDE.md} Presentation layer analysis" &
  gemini -p "@{src/services/**/*,src/business/**/*} @{CLAUDE.md} Business logic layer analysis" &
  gemini -p "@{src/models/**/*,src/db/**/*} @{CLAUDE.md} Data access layer analysis" &
  wait
)
```

### 微服务架构并行
```bash
# 微服务并行分析
(
  cd services/user-service && gemini --all-files -p "@{CLAUDE.md} User service patterns and architecture" &
  cd services/order-service && gemini --all-files -p "@{CLAUDE.md} Order service patterns and architecture" &
  cd services/payment-service && gemini --all-files -p "@{CLAUDE.md} Payment service patterns and architecture" &
  cd services/notification-service && gemini --all-files -p "@{CLAUDE.md} Notification service patterns and architecture" &
  wait
)
```

## 按功能领域并行

### 核心功能并行分析
```bash
# 核心业务功能并行分析
(
  gemini -p "@{**/*auth*,**/*login*,**/*session*} @{CLAUDE.md} Authentication and session management analysis" &
  gemini -p "@{**/api/**/*,**/routes/**/*,**/controllers/**/*} @{CLAUDE.md} API endpoints and routing analysis" &
  gemini -p "@{**/components/**/*,**/ui/**/*,**/views/**/*} @{CLAUDE.md} UI components and interface analysis" &
  gemini -p "@{**/models/**/*,**/entities/**/*,**/schemas/**/*} @{CLAUDE.md} Data models and schema analysis" &
  wait
)
```

### 跨切面关注点并行
```bash
# 横切关注点并行分析
(
  gemini -p "@{**/*security*,**/*crypto*,**/*auth*} @{CLAUDE.md} Security and encryption patterns analysis" &
  gemini -p "@{**/*log*,**/*monitor*,**/*track*} @{CLAUDE.md} Logging and monitoring patterns analysis" &
  gemini -p "@{**/*cache*,**/*redis*,**/*memory*} @{CLAUDE.md} Caching and performance patterns analysis" &
  gemini -p "@{**/*test*,**/*spec*,**/*mock*} @{CLAUDE.md} Testing strategies and patterns analysis" &
  wait
)
```

## 按技术栈并行

### 全栈技术并行分析
```bash
# 多技术栈并行分析
(
  gemini -p "@{**/*.{js,jsx,ts,tsx}} @{CLAUDE.md} JavaScript/TypeScript patterns and usage analysis" &
  gemini -p "@{**/*.{css,scss,sass,less}} @{CLAUDE.md} Styling patterns and CSS architecture analysis" &
  gemini -p "@{**/*.{py,pyx}} @{CLAUDE.md} Python code patterns and implementation analysis" &
  gemini -p "@{**/*.{sql,migration}} @{CLAUDE.md} Database schema and migration patterns analysis" &
  wait
)
```

### 框架特定并行分析
```bash
# React 生态系统并行分析
(
  gemini -p "@{src/components/**/*.{jsx,tsx}} @{CLAUDE.md} React component patterns and composition analysis" &
  gemini -p "@{src/hooks/**/*.{js,ts}} @{CLAUDE.md} Custom hooks patterns and usage analysis" &
  gemini -p "@{src/context/**/*.{js,ts,jsx,tsx}} @{CLAUDE.md} Context API usage and state management analysis" &
  gemini -p "@{**/*.stories.{js,jsx,ts,tsx}} @{CLAUDE.md} Storybook stories and component documentation analysis" &
  wait
)
```

## 按项目规模并行

### 大型项目分块并行
```bash
# 大型项目按模块并行分析
analyze_large_project() {
    local modules=("auth" "user" "product" "order" "payment" "notification")
    local pids=()
    
    for module in "${modules[@]}"; do
        (
            echo "Analyzing module: $module"
            gemini -p "@{src/$module/**/*,lib/$module/**/*} @{CLAUDE.md}
            
            Module-specific analysis for $module:
            1. Module architecture and organization patterns
            2. Internal API and interface definitions
            3. Integration points with other modules
            4. Testing strategies and coverage
            5. Performance considerations and optimizations
            
            Focus on module-specific patterns and integration points."
        ) &
        pids+=($!)
        
        # 控制并行数量
        if [ ${#pids[@]} -ge 3 ]; then
            wait "${pids[0]}"
            pids=("${pids[@]:1}")  # 移除已完成的进程ID
        fi
    done
    
    # 等待所有剩余进程
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
}
```

### 企业级项目并行策略
```bash
# 企业级项目分层并行分析
enterprise_parallel_analysis() {
    # 第一层：核心架构分析
    echo "Phase 1: Core Architecture Analysis"
    (
        gemini -p "@{src/core/**/*,lib/core/**/*} @{CLAUDE.md} Core architecture and foundation patterns" &
        gemini -p "@{config/**/*,*.config.*} @{CLAUDE.md} Configuration management and environment setup" &
        gemini -p "@{docs/**/*,README*,CHANGELOG*} @{CLAUDE.md} Documentation structure and project information" &
        wait
    )
    
    # 第二层：业务模块分析
    echo "Phase 2: Business Module Analysis"
    (
        gemini -p "@{src/modules/**/*} @{CLAUDE.md} Business modules and domain logic analysis" &
        gemini -p "@{src/services/**/*} @{CLAUDE.md} Service layer and business services analysis" &
        gemini -p "@{src/repositories/**/*} @{CLAUDE.md} Data access and repository patterns analysis" &
        wait
    )
    
    # 第三层：基础设施分析
    echo "Phase 3: Infrastructure Analysis"
    (
        gemini -p "@{infrastructure/**/*,deploy/**/*} @{CLAUDE.md} Infrastructure and deployment patterns" &
        gemini -p "@{scripts/**/*,tools/**/*} @{CLAUDE.md} Build scripts and development tools analysis" &
        gemini -p "@{tests/**/*,**/*.test.*} @{CLAUDE.md} Testing infrastructure and strategies analysis" &
        wait
    )
}
```

## 智能并行调度

### 依赖感知并行执行
```bash
# 基于依赖关系的智能并行调度
dependency_aware_parallel() {
    local -A dependencies=(
        ["core"]=""
        ["utils"]="core"
        ["services"]="core,utils"  
        ["api"]="services"
        ["ui"]="services"
        ["tests"]="api,ui"
    )
    
    local -A completed=()
    local -A running=()
    
    while [ ${#completed[@]} -lt ${#dependencies[@]} ]; do
        for module in "${!dependencies[@]}"; do
            # 跳过已完成或正在运行的模块
            [[ ${completed[$module]} ]] && continue
            [[ ${running[$module]} ]] && continue
            
            # 检查依赖是否已完成
            local deps="${dependencies[$module]}"
            local can_start=true
            
            if [[ -n "$deps" ]]; then
                IFS=',' read -ra dep_array <<< "$deps"
                for dep in "${dep_array[@]}"; do
                    [[ ! ${completed[$dep]} ]] && can_start=false && break
                done
            fi
            
            # 启动模块分析
            if $can_start; then
                echo "Starting analysis for module: $module"
                (
                    gemini -p "@{src/$module/**/*} @{CLAUDE.md} Module $module analysis"
                    echo "completed:$module"
                ) &
                running[$module]=$!
            fi
        done
        
        # 检查完成的进程
        for module in "${!running[@]}"; do
            if ! kill -0 "${running[$module]}" 2>/dev/null; then
                completed[$module]=true
                unset running[$module]
                echo "Module $module analysis completed"
            fi
        done
        
        sleep 1
    done
}
```

### 资源自适应并行
```bash
# 基于系统资源的自适应并行
adaptive_parallel_execution() {
    local available_memory=$(free -m 2>/dev/null | awk 'NR==2{print $7}' || echo 4000)
    local cpu_cores=$(nproc 2>/dev/null || echo 4)
    
    # 根据资源计算最优并行数
    local max_parallel
    if [ "$available_memory" -lt 2000 ]; then
        max_parallel=2
    elif [ "$available_memory" -lt 4000 ]; then
        max_parallel=3
    else
        max_parallel=$((cpu_cores > 4 ? 4 : cpu_cores))
    fi
    
    echo "Adaptive parallel execution: $max_parallel concurrent processes"
    
    local commands=(
        "gemini -p '@{src/components/**/*} @{CLAUDE.md} Component analysis'"
        "gemini -p '@{src/services/**/*} @{CLAUDE.md} Service analysis'"
        "gemini -p '@{src/utils/**/*} @{CLAUDE.md} Utility analysis'"
        "gemini -p '@{src/api/**/*} @{CLAUDE.md} API analysis'"
        "gemini -p '@{src/models/**/*} @{CLAUDE.md} Model analysis'"
    )
    
    local active_jobs=0
    for cmd in "${commands[@]}"; do
        eval "$cmd" &
        ((active_jobs++))
        
        # 达到并行限制时等待
        if [ $active_jobs -ge $max_parallel ]; then
            wait
            active_jobs=0
        fi
    done
    
    wait  # 等待所有剩余任务完成
}
```

## 错误处理和监控

### 并行执行错误处理
```bash
# 带错误处理的并行执行
robust_parallel_execution() {
    local commands=("$@")
    local pids=()
    local results=()
    
    # 启动所有并行任务
    for i in "${!commands[@]}"; do
        (
            echo "Starting task $i: ${commands[$i]}"
            if eval "${commands[$i]}"; then
                echo "SUCCESS:$i"
            else
                echo "FAILED:$i"
            fi
        ) &
        pids+=($!)
    done
    
    # 等待所有任务完成并收集结果
    for i in "${!pids[@]}"; do
        if wait "${pids[$i]}"; then
            results+=("Task $i: SUCCESS")
        else
            results+=("Task $i: FAILED")
            echo "Task $i failed, attempting retry..."
            
            # 简单重试机制
            if eval "${commands[$i]}"; then
                results[-1]="Task $i: SUCCESS (retry)"
            else
                results[-1]="Task $i: FAILED (retry failed)"
            fi
        fi
    done
    
    # 输出执行结果摘要
    echo "Parallel execution summary:"
    for result in "${results[@]}"; do
        echo "  $result"
    done
}
```

### 实时进度监控
```bash
# 带进度监控的并行执行
monitored_parallel_execution() {
    local total_tasks=$#
    local completed_tasks=0
    local failed_tasks=0
    
    echo "Starting $total_tasks parallel tasks..."
    
    for cmd in "$@"; do
        (
            if eval "$cmd"; then
                echo "COMPLETED:$(date): $cmd"
            else
                echo "FAILED:$(date): $cmd"
            fi
        ) &
    done
    
    # 监控进度
    while [ $completed_tasks -lt $total_tasks ]; do
        sleep 5
        
        # 计算当前完成数量
        local current_completed=$(jobs -r | wc -l)
        local current_failed=$((total_tasks - current_completed - $(jobs -s | wc -l)))
        
        if [ $current_completed -ne $completed_tasks ] || [ $current_failed -ne $failed_tasks ]; then
            completed_tasks=$current_completed
            failed_tasks=$current_failed
            
            echo "Progress: Completed: $completed_tasks, Failed: $failed_tasks, Remaining: $((total_tasks - completed_tasks - failed_tasks))"
        fi
    done
    
    wait
    echo "All parallel tasks completed."
}
```

这些并行执行模板提供了各种场景下的并行分析策略，从简单的并行执行到复杂的依赖感知调度和资源自适应执行。