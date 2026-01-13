# Action: Deep Review

深入审查指定维度的代码质量。

## Purpose

针对单个维度进行深入审查：
- 逐文件检查
- 记录发现的问题
- 提供具体的修复建议

## Preconditions

- [ ] state.status === 'running'
- [ ] state.scan_completed === true
- [ ] 存在未审查的维度

## Dimension Focus Areas

### Correctness (正确性)
- 逻辑错误和边界条件
- Null/undefined 处理
- 错误处理完整性
- 类型安全
- 资源泄漏

### Readability (可读性)
- 命名规范
- 函数长度和复杂度
- 代码重复
- 注释质量
- 代码组织

### Performance (性能)
- 算法复杂度
- 不必要的计算
- 内存使用
- I/O 效率
- 缓存策略

### Security (安全性)
- 注入风险 (SQL, XSS, Command)
- 认证和授权
- 敏感数据处理
- 加密使用
- 依赖安全

### Testing (测试)
- 测试覆盖率
- 边界条件测试
- 错误路径测试
- 测试可维护性
- Mock 使用

### Architecture (架构)
- 分层结构
- 依赖方向
- 单一职责
- 接口设计
- 扩展性

## Execution

```javascript
async function execute(state, workDir, currentDimension) {
  const context = state.context;
  const dimension = currentDimension;
  const findings = [];
  
  // 获取维度特定的检查规则
  const rules = getDimensionRules(dimension);
  
  // 优先审查高风险区域
  const filesToReview = state.scan_summary?.risk_areas
    ?.map(r => r.file)
    ?.filter(f => context.files.includes(f)) || context.files;
  
  const filesToCheck = [...new Set([
    ...filesToReview.slice(0, 20),
    ...context.files.slice(0, 30)
  ])].slice(0, 50);  // 最多50个文件
  
  let findingCounter = 1;
  
  for (const file of filesToCheck) {
    try {
      const content = Read(file);
      const lines = content.split('\n');
      
      // 应用维度特定规则
      for (const rule of rules) {
        const matches = rule.detect(content, lines, file);
        for (const match of matches) {
          findings.push({
            id: `${getDimensionPrefix(dimension)}-${String(findingCounter++).padStart(3, '0')}`,
            severity: match.severity,
            dimension: dimension,
            category: rule.category,
            file: file,
            line: match.line,
            code_snippet: match.snippet,
            description: match.description,
            recommendation: rule.recommendation,
            fix_example: rule.fixExample
          });
        }
      }
    } catch (e) {
      // 跳过无法读取的文件
    }
  }
  
  // 保存维度发现
  Write(`${workDir}/findings/${dimension}.json`, JSON.stringify(findings, null, 2));
  
  return {
    stateUpdates: {
      reviewed_dimensions: [...(state.reviewed_dimensions || []), dimension],
      current_dimension: null,
      [`findings.${dimension}`]: findings
    }
  };
}

function getDimensionPrefix(dimension) {
  const prefixes = {
    correctness: 'CORR',
    readability: 'READ',
    performance: 'PERF',
    security: 'SEC',
    testing: 'TEST',
    architecture: 'ARCH'
  };
  return prefixes[dimension] || 'MISC';
}

function getDimensionRules(dimension) {
  // 参见 specs/review-dimensions.md 获取完整规则
  const allRules = {
    correctness: [
      {
        category: 'null-check',
        detect: (content, lines) => {
          const issues = [];
          lines.forEach((line, i) => {
            if (line.match(/\w+\.\w+/) && !line.includes('?.') && !line.includes('if') && !line.includes('null')) {
              // 简化检测：可能缺少 null 检查
            }
          });
          return issues;
        },
        recommendation: 'Add null/undefined check before accessing properties',
        fixExample: 'obj?.property or if (obj) { obj.property }'
      },
      {
        category: 'empty-catch',
        detect: (content, lines) => {
          const issues = [];
          const regex = /catch\s*\([^)]*\)\s*{\s*}/g;
          let match;
          while ((match = regex.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            issues.push({
              severity: 'high',
              line: lineNum,
              snippet: match[0],
              description: 'Empty catch block silently swallows errors'
            });
          }
          return issues;
        },
        recommendation: 'Log the error or rethrow it',
        fixExample: 'catch (e) { console.error(e); throw e; }'
      }
    ],
    security: [
      {
        category: 'xss-risk',
        detect: (content, lines) => {
          const issues = [];
          lines.forEach((line, i) => {
            if (line.includes('innerHTML') || line.includes('dangerouslySetInnerHTML')) {
              issues.push({
                severity: 'critical',
                line: i + 1,
                snippet: line.trim().substring(0, 100),
                description: 'Direct HTML injection can lead to XSS vulnerabilities'
              });
            }
          });
          return issues;
        },
        recommendation: 'Use textContent or sanitize HTML before injection',
        fixExample: 'element.textContent = userInput; // or sanitize(userInput)'
      },
      {
        category: 'hardcoded-secret',
        detect: (content, lines) => {
          const issues = [];
          const regex = /(?:password|secret|api[_-]?key|token)\s*[=:]\s*['"]([^'"]{8,})['"]/gi;
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              issues.push({
                severity: 'critical',
                line: i + 1,
                snippet: line.trim().substring(0, 100),
                description: 'Hardcoded credentials detected'
              });
            }
            regex.lastIndex = 0;  // Reset regex
          });
          return issues;
        },
        recommendation: 'Use environment variables or secret management',
        fixExample: 'const apiKey = process.env.API_KEY;'
      }
    ],
    // ... 其他维度规则参见 specs/review-dimensions.md
  };
  
  return allRules[dimension] || [];
}
```

## State Updates

```javascript
return {
  stateUpdates: {
    reviewed_dimensions: [...state.reviewed_dimensions, currentDimension],
    current_dimension: null,
    findings: {
      ...state.findings,
      [currentDimension]: newFindings
    }
  }
};
```

## Output

- **File**: `findings/{dimension}.json`
- **Location**: `${workDir}/findings/`
- **Format**: JSON array of Finding objects

## Error Handling

| Error Type | Recovery |
|------------|----------|
| 文件读取失败 | 跳过该文件，记录警告 |
| 规则执行错误 | 跳过该规则，继续其他规则 |

## Next Actions

- 还有未审查维度: 继续 action-deep-review
- 所有维度完成: action-generate-report
