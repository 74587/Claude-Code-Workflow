# contentPattern 实现方案对比

## 当前实现
```typescript
// 手动实现的正则搜索，存在无限循环风险
function findMatches(content: string, pattern: string): string[] {
  const regex = new RegExp(pattern, 'gm');
  // ... 手动处理，容易出错
}
```

**问题**：
- 🔴 无限循环风险（空字符串、零宽匹配）
- 🔴 ReDoS 攻击风险（灾难性回溯）
- 🟡 需要手动维护安全检查
- 🟡 测试覆盖成本高

---

## 方案对比

### 方案 1: ripgrep (rg) CLI 工具 ⭐ 推荐

**优点**：
- ✅ 工业级可靠性，被广泛使用
- ✅ 自动处理 ReDoS 保护
- ✅ 性能极佳（Rust 实现）
- ✅ 支持复杂的正则表达式
- ✅ 内置超时保护

**缺点**：
- ❌ 需要外部依赖
- ❌ 跨平台兼容性需要考虑

**实现**：
```typescript
import { execSync } from 'child_process';

function findMatches(content: string, pattern: string): string[] {
  // 将内容写入临时文件
  const tempFile = writeTempFile(content);

  try {
    const result = execSync(
      `rg --only-matching --no-line-number --max-count=10 --regexp ${escapeShellArg(pattern)} ${tempFile}`,
      { encoding: 'utf8', timeout: 5000 }
    );
    return result.split('\n').filter(Boolean);
  } catch (error) {
    // No matches or timeout
    return [];
  } finally {
      unlinkSync(tempFile);
  }
}
```

**评分**：⭐⭐⭐⭐⭐ (最可靠)

---

### 方案 2: search-mark 库

**npm**: `search-mark`

**优点**：
- ✅ 轻量级
- ✅ 纯 JavaScript
- ✅ API 简单
- ✅ 无外部依赖

**实现**：
```typescript
import search from 'search-mark';

function findMatches(content: string, pattern: string): string[] {
  try {
    const regex = new RegExp(pattern, 'gm');
    const results = search(content, regex);

    return results
      .slice(0, 10)  // 限制结果数量
      .map(r => r.match);  // 返回匹配文本
  } catch (error) {
    console.error(`Pattern error: ${error.message}`);
    return [];
  }
}
```

**评分**：⭐⭐⭐⭐ (平衡)

---

### 方案 3: fast-glob + 手动搜索

**npm**: `fast-glob`

**优点**：
- ✅ 快速的文件搜索
- ✅ 内置缓存
- ✅ TypeScript 支持

**实现**：
```typescript
import fastGlob from 'fast-glob';

// 使用 fast-glob 查找文件
const files = await fastGlob('**/*.ts', { cwd: projectDir });

// 使用 ripgrep 或简单字符串搜索内容
```

**评分**：⭐⭐⭐ (适合文件搜索)

---

### 方案 4: node-replace (简化版)

**npm**: `@nodelib/foo`

**实现**：
```typescript
import { replace } from '@nodelib/foo';

function findMatches(content: string, pattern: string): string[] {
  try {
    const matches: string[] = [];
    replace(content, new RegExp(pattern, 'g'), (match) => {
      if (matches.length < 10) {
        // 提取匹配所在行
        const lines = content.split('\n');
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;
        matches.push(lines[lineIndex].trim());
      }
      return match;  // 不替换，只收集
    });
    return matches;
  } catch (error) {
    console.error(`Pattern error: ${error.message}`);
    return [];
  }
}
```

**评分**：⭐⭐⭐ (中等复杂度)

---

## 推荐方案

### 对于 CCW read_file 工具：

**最佳方案**: **保持当前实现 + 添加安全检查**

原因：
1. ✅ 无需额外依赖
2. ✅ 性能可控（JavaScript 原生）
3. ✅ 已添加安全保护（迭代计数器、位置检查）
4. ✅ 简单可靠

**已添加的保护**：
```typescript
// 1. 空字符串检查
if (!pattern || pattern.length === 0) {
  return [];
}

// 2. 零宽度检测（新增）
const testRegex = new RegExp(pattern, 'gm');
const emptyTest = testRegex.exec('');
if (emptyTest && emptyTest[0] === '' && emptyTest.index === 0) {
  const secondMatch = testRegex.exec('');
  if (secondMatch && secondMatch.index === 0) {
    return [];  // 危险模式
  }
}

// 3. 迭代计数器 (1000 次)
// 4. 位置前进检查
// 5. 结果去重
```

---

## 如果需要更强的保护

考虑使用 **node-ripgrep** 或直接调用 **rg** CLI：

```typescript
// 如果 ripgrep 可用
import { execSync } from 'child_process';

function findMatchesRg(content: string, pattern: string, timeout = 5000): string[] {
  const tempFile = `/tmp/search_${Date.now()}.txt`;
  writeFileSync(tempFile, content, 'utf8');

  try {
    const cmd = [
      'rg',
      '--only-matching',
      '--no-line-number',
      '--max-count', '10',
      '--regexp', pattern,
      tempFile
    ].join(' ');

    const result = execSync(cmd, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return result.split('\n').filter(Boolean);
  } catch (error) {
    return [];
  } finally {
    unlinkSync(tempFile);
  }
}
```

---

## 总结

| 方案 | 可靠性 | 性能 | 依赖 | 推荐度 |
|------|--------|------|------|--------|
| ripgrep CLI | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 外部工具 | ⭐⭐⭐⭐ |
| search-mark | ⭐⭐⭐⭐ | ⭐⭐⭐ | npm 包 | ⭐⭐⭐⭐ |
| 当前实现 + 保护 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 无 | ⭐⭐⭐⭐ |
| node-replace | ⭐⭐⭐ | ⭐⭐⭐ | npm 包 | ⭐⭐⭐ |

**最终建议**: 保持当前实现 + 已添加的安全检查，如果需要更强的保护，再考虑 ripgrep CLI 方案。
