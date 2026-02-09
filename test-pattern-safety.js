/**
 * contentPattern 安全测试
 * 直接测试 findMatches 函数的边界情况
 */

function findMatchesWithLimit(content, pattern, maxIterations = 1000) {
  try {
    const regex = new RegExp(pattern, 'gm');
    const matches = [];
    let match;
    let iterations = 0;

    while ((match = regex.exec(content)) !== null && matches.length < 10) {
      iterations++;
      if (iterations > maxIterations) {
        return {
          hasInfiniteLoop: true,
          iterations,
          error: `Exceeded ${maxIterations} iterations - possible infinite loop`
        };
      }
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      matches.push(line.substring(0, 200));
    }

    return { hasInfiniteLoop: false, iterations, matches };
  } catch (error) {
    return { hasInfiniteLoop: false, error: error.message, matches: [] };
  }
}

console.log('=== contentPattern 安全分析 ===\n');

const tests = [
  {
    name: '✅ 正常模式',
    content: 'Line 1\nLine 2\nLine 3',
    pattern: 'Line'
  },
  {
    name: '❌ 空字符串模式（无限循环）',
    content: 'Line 1\nLine 2\nLine 3',
    pattern: ''
  },
  {
    name: '❌ 零宽匹配（无限循环）',
    content: 'abc\ndef\nghi',
    pattern: 'x*'
  },
  {
    name: '❌ 或运算符空匹配（无限循环）',
    content: 'some text',
    pattern: 'a|'
  },
  {
    name: '⏱️ ReDoS 攻击（灾难性回溯）',
    content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab',
    pattern: '(a+)+b'
  },
  {
    name: '⚠️ 同一行多次匹配（重复）',
    content: 'TODO fix bug TODO fix crash',
    pattern: 'TODO'
  },
  {
    name: '⚠️ 跨行匹配（失败）',
    content: 'function test() {\n  return "value";\n}',
    pattern: 'function.*\\{.*return'
  },
  {
    name: '⚠️ 无效正则（静默失败）',
    content: 'Some content',
    pattern: '[invalid('
  },
  {
    name: '✅ 点号匹配',
    content: 'cat dog\nbat log',
    pattern: '.at'
  },
  {
    name: '✅ 捕获组',
    content: 'User: John\nUser: Jane',
    pattern: 'User: (\\w+)'
  }
];

console.log('测试结果:\n');

for (const test of tests) {
  console.log(`${test.name}`);
  console.log(`模式: "${test.pattern}"`);

  const result = findMatchesWithLimit(test.content, test.pattern);

  if (result.hasInfiniteLoop) {
    console.log(`❌ 无限循环检测! 迭代次数: ${result.iterations}`);
  } else if (result.error) {
    console.log(`⚠️ 错误: ${result.error}`);
  } else {
    console.log(`✅ 迭代: ${result.iterations}, 匹配: ${result.matches.length}`);
    if (result.matches.length > 0) {
      console.log(`   结果:`, result.matches);
    }
  }
  console.log('');
}

console.log('='.repeat(60));
console.log('\n缺陷汇总:\n');

const defects = [
  {
    severity: '🔴 严重',
    title: '无限循环风险',
    description: '空字符串模式 ("") 或零宽匹配 ("x*") 会导致 regex.exec() 每次前进 0 个字符，造成无限循环',
    impact: '可能导致服务器挂起或 CPU 100%',
    fix: '添加迭代计数器，超过阈值时终止'
  },
  {
    severity: '🔴 严重',
    title: 'ReDoS 攻击',
    description: '恶意正则表达式如 "(a+)+b" 会导致灾难性回溯，消耗大量 CPU',
    impact: '可能导致服务拒绝攻击',
    fix: '使用正则超时或复杂的预验证'
  },
  {
    severity: '🟡 中等',
    title: '同一行重复返回',
    description: '如果同一行有多个匹配，会重复添加该行到结果中',
    impact: '结果冗余，用户体验差',
    fix: '使用 Set 去重或记录已处理的行号'
  },
  {
    severity: '🟡 中等',
    title: '跨行匹配失败',
    description: '使用 lastIndexOf 查找行首，只返回匹配所在的单行',
    impact: '跨行模式（如 "function.*\\{.*return"）无法正常工作',
    fix: '文档说明或改进为返回匹配上下文'
  },
  {
    severity: '🟢 轻微',
    title: '错误静默忽略',
    description: '无效正则表达式被 catch 块捕获，返回空数组但不提示原因',
    impact: '用户不知道为什么搜索失败',
    fix: '返回错误信息给用户'
  },
  {
    severity: '🟢 轻微',
    title: '缺少输入验证',
    description: '没有验证 pattern 参数的长度、复杂度或安全性',
    impact: '安全风险',
    fix: '添加模式验证和长度限制'
  }
];

defects.forEach((d, i) => {
  console.log(`${i + 1}. ${d.severity} ${d.title}`);
  console.log(`   描述: ${d.description}`);
  console.log(`   影响: ${d.impact}`);
  console.log(`   修复: ${d.fix}`);
  console.log('');
});

console.log('='.repeat(60));
console.log('\n建议修复优先级:');
console.log('1. 🔴 添加无限循环保护（迭代计数器）');
console.log('2. 🔴 添加 ReDoS 防护（超时或复杂度限制）');
console.log('3. 🟡 修复同一行重复问题（去重）');
console.log('4. 🟢 改进错误报告（返回错误信息）');
