# Folder-Specific Analysis Command Templates

**针对特定文件夹的完整分析命令示例**

## 组件文件夹分析

### React 组件分析
```bash
# 标准 React 组件目录分析
cd src/components && gemini --all-files -p "@{CLAUDE.md}

React components architecture analysis:
1. Component composition patterns and prop design
2. State management strategies (local state vs context vs external)
3. Styling approaches and CSS-in-JS usage patterns
4. Testing strategies and component coverage
5. Performance optimization patterns (memoization, lazy loading)

Output: Component development guidelines with specific patterns and best practices"

# 带回退的组件分析
analyze_components() {
    if [ -d "src/components" ]; then
        cd src/components && gemini --all-files -p "@{CLAUDE.md} Component analysis"
    elif [ -d "components" ]; then
        cd components && gemini --all-files -p "@{CLAUDE.md} Component analysis"  
    else
        gemini -p "@{**/components/**/*,**/ui/**/*} @{CLAUDE.md} Component analysis"
    fi
}
```

### Vue 组件分析
```bash
# Vue 单文件组件分析
cd src/components && gemini --all-files -p "@{CLAUDE.md}

Vue component architecture analysis:
1. Single File Component structure and organization
2. Composition API vs Options API usage patterns
3. Props, emits, and component communication patterns
4. Scoped styling and CSS module usage
5. Component testing with Vue Test Utils patterns

Focus on Vue 3 composition patterns and modern development practices."
```

## API 文件夹分析

### RESTful API 分析
```bash
# API 路由和控制器分析
cd src/api && gemini --all-files -p "@{CLAUDE.md}

RESTful API architecture analysis:
1. Route organization and endpoint design patterns
2. Controller structure and request handling patterns
3. Middleware usage for authentication, validation, and error handling
4. Response formatting and error handling strategies
5. API versioning and backward compatibility approaches

Output: API development guidelines with routing patterns and best practices"

# Express.js 特定分析
cd routes && gemini --all-files -p "@{CLAUDE.md}

Express.js routing patterns analysis:
1. Route definition and organization strategies
2. Middleware chain design and error propagation
3. Parameter validation and sanitization patterns
4. Authentication and authorization middleware integration
5. Response handling and status code conventions

Focus on Express.js specific patterns and Node.js best practices."
```

### GraphQL API 分析
```bash
# GraphQL 解析器分析
cd src/graphql && gemini --all-files -p "@{CLAUDE.md}

GraphQL API architecture analysis:
1. Schema design and type definition patterns
2. Resolver implementation and data fetching strategies
3. Query complexity analysis and performance optimization
4. Authentication and authorization in GraphQL context
5. Error handling and custom scalar implementations

Focus on GraphQL-specific patterns and performance considerations."
```

## 服务层分析

### 业务服务分析
```bash
# 服务层架构分析
cd src/services && gemini --all-files -p "@{CLAUDE.md}

Business services architecture analysis:
1. Service layer organization and responsibility separation
2. Domain logic implementation and business rule patterns
3. External service integration and API communication
4. Transaction management and data consistency patterns
5. Service composition and orchestration strategies

Output: Service layer guidelines with business logic patterns and integration approaches"

# 微服务分析
analyze_microservices() {
    local services=($(find services -maxdepth 1 -type d -not -name services))
    
    for service in "${services[@]}"; do
        echo "Analyzing service: $service"
        cd "$service" && gemini --all-files -p "@{CLAUDE.md}
        
        Microservice analysis for $(basename $service):
        1. Service boundaries and responsibility definition
        2. Inter-service communication patterns
        3. Data persistence and consistency strategies
        4. Service configuration and environment management
        5. Monitoring and health check implementations
        
        Focus on microservice-specific patterns and distributed system concerns."
        cd - > /dev/null
    done
}
```

## 数据层分析

### 数据模型分析
```bash
# 数据库模型分析
cd src/models && gemini --all-files -p "@{CLAUDE.md}

Data model architecture analysis:
1. Entity relationship design and database schema patterns
2. ORM usage patterns and query optimization strategies
3. Data validation and integrity constraint implementations
4. Migration strategies and schema evolution patterns
5. Database connection management and transaction handling

Output: Data modeling guidelines with ORM patterns and database best practices"

# Prisma 特定分析
cd prisma && gemini --all-files -p "@{CLAUDE.md}

Prisma ORM integration analysis:
1. Schema definition and model relationship patterns
2. Query patterns and performance optimization with Prisma
3. Migration management and database versioning
4. Type generation and client usage patterns
5. Advanced features usage (middleware, custom types)

Focus on Prisma-specific patterns and TypeScript integration."
```

### 数据访问层分析
```bash
# Repository 模式分析
cd src/repositories && gemini --all-files -p "@{CLAUDE.md}

Repository pattern implementation analysis:
1. Repository interface design and abstraction patterns
2. Data access optimization and caching strategies
3. Query builder usage and dynamic query construction
4. Transaction management across repository boundaries
5. Testing strategies for data access layer

Focus on repository pattern best practices and data access optimization."
```

## 工具和配置分析

### 构建配置分析
```bash
# 构建工具配置分析
gemini -p "@{webpack.config.*,vite.config.*,rollup.config.*} @{CLAUDE.md}

Build configuration analysis:
1. Build tool setup and optimization strategies
2. Asset processing and bundling patterns
3. Development vs production configuration differences
4. Plugin configuration and custom build steps
5. Performance optimization and bundle analysis

Focus on build optimization and development workflow improvements."

# package.json 和依赖分析
gemini -p "@{package.json,package-lock.json,yarn.lock} @{CLAUDE.md}

Package management and dependency analysis:
1. Dependency organization and version management strategies
2. Script definitions and development workflow automation
3. Peer dependency handling and version compatibility
4. Security considerations and dependency auditing
5. Package size optimization and tree-shaking opportunities

Output: Dependency management guidelines and optimization recommendations."
```

### 测试目录分析
```bash
# 测试策略分析
cd tests && gemini --all-files -p "@{CLAUDE.md}

Testing strategy and implementation analysis:
1. Test organization and structure patterns
2. Unit testing approaches and coverage strategies
3. Integration testing patterns and mock usage
4. End-to-end testing implementation and tooling
5. Test performance and maintainability considerations

Output: Testing guidelines with patterns for different testing levels"

# Jest 配置和测试模式
cd __tests__ && gemini --all-files -p "@{CLAUDE.md}

Jest testing patterns analysis:
1. Test suite organization and naming conventions
2. Mock strategies and dependency isolation
3. Async testing patterns and promise handling
4. Snapshot testing usage and maintenance
5. Custom matchers and testing utilities

Focus on Jest-specific patterns and JavaScript/TypeScript testing best practices."
```

## 样式和资源分析

### CSS 架构分析
```bash
# 样式架构分析
cd src/styles && gemini --all-files -p "@{CLAUDE.md}

CSS architecture and styling patterns analysis:
1. CSS organization methodologies (BEM, SMACSS, etc.)
2. Preprocessor usage and mixin/variable patterns
3. Component-scoped styling and CSS-in-JS approaches
4. Responsive design patterns and breakpoint management
5. Performance optimization and critical CSS strategies

Output: Styling guidelines with organization patterns and best practices"

# Tailwind CSS 分析
gemini -p "@{tailwind.config.*,**/*.css} @{CLAUDE.md}

Tailwind CSS implementation analysis:
1. Configuration customization and theme extension
2. Utility class usage patterns and component composition
3. Custom component creation with @apply directives
4. Purging strategies and bundle size optimization
5. Design system implementation with Tailwind

Focus on Tailwind-specific patterns and utility-first methodology."
```

### 静态资源分析
```bash
# 资源管理分析
cd src/assets && gemini --all-files -p "@{CLAUDE.md}

Static asset management analysis:
1. Asset organization and naming conventions
2. Image optimization and format selection strategies
3. Icon management and sprite generation patterns
4. Font loading and performance optimization
5. Asset versioning and cache management

Focus on performance optimization and asset delivery strategies."
```

## 智能文件夹检测

### 自动文件夹检测和分析
```bash
# 智能检测项目结构并分析
auto_folder_analysis() {
    echo "Detecting project structure..."
    
    # 检测前端框架
    if [ -d "src/components" ]; then
        echo "Found React/Vue components directory"
        cd src/components && gemini --all-files -p "@{CLAUDE.md} Component architecture analysis"
        cd - > /dev/null
    fi
    
    # 检测API结构
    if [ -d "src/api" ] || [ -d "api" ] || [ -d "routes" ]; then
        echo "Found API directory structure"
        api_dir=$(find . -maxdepth 2 -name "api" -o -name "routes" | head -1)
        cd "$api_dir" && gemini --all-files -p "@{CLAUDE.md} API architecture analysis"
        cd - > /dev/null
    fi
    
    # 检测服务层
    if [ -d "src/services" ] || [ -d "services" ]; then
        echo "Found services directory"
        service_dir=$(find . -maxdepth 2 -name "services" | head -1)
        cd "$service_dir" && gemini --all-files -p "@{CLAUDE.md} Service layer analysis"
        cd - > /dev/null
    fi
    
    # 检测数据层
    if [ -d "src/models" ] || [ -d "models" ] || [ -d "src/db" ]; then
        echo "Found data layer directory"
        data_dir=$(find . -maxdepth 2 -name "models" -o -name "db" | head -1)
        cd "$data_dir" && gemini --all-files -p "@{CLAUDE.md} Data layer analysis"
        cd - > /dev/null
    fi
}
```

### 并行文件夹分析
```bash
# 多文件夹并行分析
parallel_folder_analysis() {
    local folders=("$@")
    local pids=()
    
    for folder in "${folders[@]}"; do
        if [ -d "$folder" ]; then
            (
                echo "Analyzing folder: $folder"
                cd "$folder" && gemini --all-files -p "@{CLAUDE.md}
                
                Folder-specific analysis for $folder:
                1. Directory organization and file structure patterns
                2. Code patterns and architectural decisions
                3. Integration points and external dependencies
                4. Testing strategies and quality standards
                5. Performance considerations and optimizations
                
                Focus on folder-specific patterns and best practices."
            ) &
            pids+=($!)
        fi
    done
    
    # 等待所有分析完成
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
}

# 使用示例
parallel_folder_analysis "src/components" "src/services" "src/api" "src/models"
```

## 条件分析和优化

### 基于文件大小的分析策略
```bash
# 基于文件夹大小选择分析策略
smart_folder_analysis() {
    local folder="$1"
    local file_count=$(find "$folder" -type f | wc -l)
    
    echo "Analyzing folder: $folder ($file_count files)"
    
    if [ "$file_count" -gt 100 ]; then
        echo "Large folder detected, using selective analysis"
        
        # 大文件夹：按文件类型分组分析
        cd "$folder" && gemini -p "@{**/*.{js,ts,jsx,tsx}} @{CLAUDE.md} JavaScript/TypeScript patterns"
        cd "$folder" && gemini -p "@{**/*.{css,scss,sass}} @{CLAUDE.md} Styling patterns" 
        cd "$folder" && gemini -p "@{**/*.{json,yaml,yml}} @{CLAUDE.md} Configuration patterns"
    elif [ "$file_count" -gt 20 ]; then
        echo "Medium folder, using standard analysis"
        cd "$folder" && gemini --all-files -p "@{CLAUDE.md} Comprehensive folder analysis"
    else
        echo "Small folder, using detailed analysis"
        cd "$folder" && gemini --all-files -p "@{CLAUDE.md} Detailed patterns and implementation analysis"
    fi
    
    cd - > /dev/null
}
```

### 增量分析策略
```bash
# 仅分析修改过的文件夹
incremental_folder_analysis() {
    local base_commit="${1:-HEAD~1}"
    
    echo "Finding modified folders since $base_commit"
    
    # 获取修改的文件夹
    local modified_folders=($(git diff --name-only "$base_commit" | xargs -I {} dirname {} | sort -u))
    
    for folder in "${modified_folders[@]}"; do
        if [ -d "$folder" ]; then
            echo "Analyzing modified folder: $folder"
            cd "$folder" && gemini --all-files -p "@{CLAUDE.md}
            
            Incremental analysis for recently modified folder:
            1. Recent changes impact on existing patterns
            2. New patterns introduced and their consistency
            3. Integration effects on related components
            4. Testing coverage for modified functionality
            5. Performance implications of recent changes
            
            Focus on change impact and pattern evolution."
            cd - > /dev/null
        fi
    done
}
```

这些文件夹特定的分析模板为不同类型的项目目录提供了专门的分析策略，从组件库到API层，从数据模型到配置管理，确保每种目录类型都能得到最适合的分析方式。