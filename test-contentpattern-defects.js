/**
 * contentPattern 缺陷测试
 * 测试 findMatches 函数的边界情况和潜在问题
 */

function findMatches(content, pattern) {
  try {
    const regex = new RegExp(pattern, 'gm');
    const matches = [];
    let match;

    while ((match = regex.exec(content)) !== null && matches.length < 10) {
      // Get line containing match
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      matches.push(line.substring(0, 200)); // Truncate long lines
    }

    return matches;
  } catch {
    return [];
  }
}

console.log('=== contentPattern 缺陷分析 ===\n');

// 测试用例
const tests = [
  {
    name: '缺陷 1: 空字符串模式 - 可能导致无限循环',
    content: 'Line 1\nLine 2\nLine 3',
    pattern: '',
    dangerous: true  // 可能导致无限循环
  },
  {
    name: '缺陷 2: 匹配空字符串的模式 - 无限循环',
    content: 'abc\ndef\nghi',
    pattern: 'x*',  // 匹配 0 个或多个 x
    dangerous: true  // 可能导致无限循环
  },
  {
    name: '缺陷 3: ReDoS 攻击 - 恶意正则表达式',
    content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab',
    pattern: '(a+)+b',  // 灾难性回溯
    dangerous: true  // 可能导致 CPU 耗尽
  },
  {
    name: '缺陷 4: 同一行多次匹配重复返回',
    content: 'TODO fix bug TODO fix crash',
    pattern: 'TODO',
    dangerous: false
  },
  {
    name: '缺陷 5: 文件开头没有换行符',
    content: 'TODO first line\nTODO second line',
    pattern: 'TODO',
    dangerous: false
  },
  {
    name: '缺陷 6: 无效正则表达式 - 静默失败',
    content: 'Some content',
    pattern: '[invalid(',  // 无效的正则
    dangerous: false
  },
  {
    name: '缺陷 7: 匹配跨行内容',
    content: 'function test() {\n  return "value";\n}',
    pattern: 'function.*\\{.*return',
    dangerous: false
  },
  {
    name: '正常: 简单匹配',
    content: 'Line 1\nLine 2\nLine 3',
    pattern: 'Line',
    dangerous: false
  }
];

// 安全地运行测试（有超时保护）
function safeRun(test, timeout = 1000) {
  return Promise.race([
    new Promise((resolve) => {
      try {
        const result = findMatches(test.content, test.pattern);
        resolve({ success: true, result, timedOut: false });
      } catch (error) {
        resolve({ success: false, error: error.message, timedOut: false });
      }
    }),
    new Promise((resolve) => {
      setTimeout(() => resolve({ success: false, timedOut: true, error: 'Timeout' }), timeout);
    })
  ]);
}

async function runTests() {
  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${test.name}`);
    console.log(`内容: "${test.content.substring(0, 50)}${test.content.length > 50 ? '...' : ''}"`);
    console.log(`模式: "${test.pattern}"`);
    console.log(`危险: ${test.dangerous ? '⚠️ 是' : '否'}`);

    if (test.dangerous) {
      console.log(`⚠️ 跳过危险测试（可能导致无限循环）`);
      continue;
    }

    const result = await safeRun(test, 100);

    if (result.timedOut) {
      console.log(`❌ 超时 - 检测到无限循环风险！`);
    } else if (result.success) {
      console.log(`✅ 结果:`, result.result);
    } else {
      console.log(`❌ 错误: ${result.error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n缺陷总结:');
  console.log('1. 空字符串模式可能导致无限循环');
  console.log('2. 匹配空字符的模式（如 "x*"）可能导致无限循环');
  console.log('3. 恶意正则（ReDoS）可能导致 CPU 耗尽');
  console.log('4. 同一行多次匹配会重复返回');
  console.log('5. 跨行匹配可能返回意外结果');
  console.log('6. 无效正则表达式静默失败，不返回错误信息');
  console.log('7. 缺少输入验证和长度限制');
}

runTests().catch(console.error);
