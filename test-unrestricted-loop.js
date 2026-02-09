/**
 * 测试无限制情况下的无限循环风险
 * 移除 matches.length < 10 的限制
 */

function findMatchesUnrestricted(content, pattern, maxIterations = 10000) {
  try {
    const regex = new RegExp(pattern, 'gm');
    const matches = [];
    let match;
    let iterations = 0;
    let lastIndex = -1;

    while ((match = regex.exec(content)) !== null) {
      iterations++;

      // 检测是否卡在同一位置（无限循环指标）
      if (match.index === lastIndex) {
        return {
          hasStall: true,
          iterations,
          stalledAt: match.index,
          message: 'Detected stall - regex.exec() not advancing'
        };
      }
      lastIndex = match.index;

      // 安全限制
      if (iterations > maxIterations) {
        return {
          exceededIterations: true,
          iterations,
          message: `Exceeded ${maxIterations} iterations without completion`
        };
      }

      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      matches.push(line.substring(0, 200));
    }

    return { hasStall: false, iterations, matches, completed: true };
  } catch (error) {
    return { error: error.message, iterations };
  }
}

console.log('=== 无限循环风险详细分析 ===\n');
console.log('测试不受限制的 findMatches 行为（无 matches.length < 10 限制）\n');

const tests = [
  {
    name: '正常模式 - 应该正常完成',
    content: 'Line 1\nLine 2\nLine 3',
    pattern: 'Line',
    expected: '正常'
  },
  {
    name: '空字符串模式 - 卡住风险',
    content: 'Line 1\nLine 2',
    pattern: '',
    expected: '卡住或高迭代'
  },
  {
    name: '零宽匹配 - 卡住风险',
    content: 'abc\ndef',
    pattern: 'x*',
    expected: '卡住或高迭代'
  },
  {
    name: '或运算符空匹配 - 卡住风险',
    content: 'test',
    pattern: 'a|',
    expected: '卡住或高迭代'
  }
];

for (const test of tests) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${test.name}`);
  console.log(`内容: "${test.content}"`);
  console.log(`模式: "${test.pattern}"`);
  console.log(`预期: ${test.expected}`);

  const result = findMatchesUnrestricted(test.content, test.pattern, 1000);

  if (result.hasStall) {
    console.log(`❌ 检测到卡住!`);
    console.log(`   迭代次数: ${result.iterations}`);
    console.log(`   卡在位置: ${result.stalledAt}`);
    console.log(`   原因: ${result.message}`);
  } else if (result.exceededIterations) {
    console.log(`❌ 超过迭代限制!`);
    console.log(`   迭代次数: ${result.iterations}`);
    console.log(`   原因: ${result.message}`);
  } else if (result.error) {
    console.log(`⚠️ 错误: ${result.error}`);
  } else {
    console.log(`✅ 正常完成`);
    console.log(`   迭代次数: ${result.iterations}`);
    console.log(`   匹配数量: ${result.matches.length}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('\n结论:\n');

const dangerousPatterns = [
  {
    pattern: '"" (空字符串)',
    risk: '每次匹配空字符串，前进 0 字符',
    behavior: '无限循环或极高迭代次数'
  },
  {
    pattern: '"x*" (零宽量词)',
    risk: '匹配 0 个或多个，可能匹配空字符串',
    behavior: '在非 "x" 字符处无限循环'
  },
  {
    pattern: '"a|" (或空)',
    risk: '总是能匹配（至少匹配空）',
    behavior: '每个字符位置都匹配一次'
  },
  {
    pattern: '"(?=...)" (零宽断言)',
    risk: '断言不消耗字符',
    behavior: '如果断言总是成功，会卡住'
  }
];

dangerousPatterns.forEach((d, i) => {
  console.log(`${i + 1}. ${d.pattern}`);
  console.log(`   风险: ${d.risk}`);
  console.log(`   行为: ${d.behavior}`);
  console.log('');
});

console.log('当前实现的保护措施:');
console.log('- ✅ 有 matches.length < 10 限制（但不够）');
console.log('- ❌ 没有迭代计数器');
console.log('- ❌ 没有位置前进检查');
console.log('- ❌ 没有超时保护');
console.log('- ❌ 没有模式验证');

console.log('\n建议的修复方案:');
console.log(`
function findMatches(content: string, pattern: string): string[] {
  try {
    // 1. 验证模式
    if (!pattern || pattern.length === 0) {
      throw new Error('Pattern cannot be empty');
    }

    // 2. 检查危险模式
    const dangerousPatterns = ['', '.*', 'x*', 'a|', '(?='];
    if (dangerousPatterns.includes(pattern)) {
      throw new Error(\`Dangerous pattern: \${pattern}\`);
    }

    const regex = new RegExp(pattern, 'gm');
    const matches = [];
    const seen = new Set<string>(); // 去重
    let match;
    let iterations = 0;
    let lastIndex = -1;
    const MAX_ITERATIONS = 1000;

    while ((match = regex.exec(content)) !== null &&
           matches.length < 10) {
      iterations++;

      // 3. 迭代计数器保护
      if (iterations > MAX_ITERATIONS) {
        throw new Error(\`Pattern exceeded \${MAX_ITERATIONS} iterations\`);
      }

      // 4. 位置前进检查
      if (match.index === lastIndex) {
        // 正则没有前进，强制前进
        regex.lastIndex = match.index + 1;
        continue;
      }
      lastIndex = match.index;

      // 获取匹配行
      const lineStart = content.lastIndexOf('\\n', match.index) + 1;
      const lineEnd = content.indexOf('\\n', match.index);
      const line = content.substring(
        lineStart,
        lineEnd === -1 ? undefined : lineEnd
      ).trim();

      // 5. 去重
      if (!seen.has(line)) {
        seen.add(line);
        matches.push(line.substring(0, 200));
      }
    }

    return matches;
  } catch (error) {
    // 6. 返回错误信息而不是静默失败
    console.error(\`Pattern search failed: \${error.message}\`);
    return [];
  }
}
`);
