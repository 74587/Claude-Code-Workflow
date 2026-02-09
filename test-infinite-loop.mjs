/**
 * contentPattern 无限循环风险测试
 * 使用 Worker 隔离环境，防止主线程卡死
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试函数代码
const workerCode = `
function findMatches(content, pattern) {
  try {
    const regex = new RegExp(pattern, 'gm');
    const matches = [];
    let match;
    let iterations = 0;
    const MAX_ITERATIONS = 1000;

    while ((match = regex.exec(content)) !== null && matches.length < 10) {
      iterations++;
      if (iterations > MAX_ITERATIONS) {
        return { error: 'Exceeded max iterations - possible infinite loop', iterations };
      }
      const lineStart = content.lastIndexOf('\\n', match.index) + 1;
      const lineEnd = content.indexOf('\\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      matches.push(line.substring(0, 200));
    }
    return { matches, iterations };
  } catch (error) {
    return { error: error.message };
  }
};

self.on('message', ({ content, pattern }) => {
  const result = findMatches(content, pattern);
  self.postMessage(result);
});
`;

async function testInfiniteLoop(content, pattern, testName, timeout = 2000) {
  console.log(`\n测试: ${testName}`);
  console.log(`模式: "${pattern}"`);

  // 创建临时 worker
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);

  try {
    const worker = new Worker(workerUrl);

    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        worker.terminate();
        resolve({ error: 'TIMEOUT - Infinite loop detected!', timeout: true });
      }, timeout);

      worker.once('message', (data) => {
        clearTimeout(timer);
        worker.terminate();
        resolve(data);
      });

      worker.once('error', (error) => {
        clearTimeout(timer);
        worker.terminate();
        resolve({ error: error.message });
      });

      worker.postMessage({ content, pattern });
    });

    URL.revokeObjectURL(workerUrl);

    if (result.error) {
      if (result.timeout) {
        console.log(`❌ 超时 - 检测到无限循环！`);
        return { hasInfiniteLoop: true };
      } else {
        console.log(`⚠️  错误: ${result.error}`);
        return { hasInfiniteLoop: false, error: result.error };
      }
    } else {
      console.log(`✅ 结果: ${result.matches?.length || 0} 个匹配, ${result.iterations} 次迭代`);
      return { hasInfiniteLoop: false, iterations: result.iterations };
    }
  } catch (error) {
    console.log(`❌ 异常: ${error.message}`);
    return { hasInfiniteLoop: false, error: error.message };
  }
}

async function main() {
  console.log('=== contentPattern 无限循环风险测试 ===\n');
  console.log('⚠️ 危险测试将在 Worker 中运行，2秒超时\n');

  const tests = [
    {
      name: '正常模式',
      content: 'Line 1\nLine 2\nLine 3',
      pattern: 'Line',
      expected: '正常'
    },
    {
      name: '空字符串模式（危险）',
      content: 'Line 1\nLine 2\nLine 3',
      pattern: '',
      expected: '无限循环'
    },
    {
      name: '零宽匹配（危险）',
      content: 'abc\ndef\nghi',
      pattern: 'x*',  // 匹配 0 个或多个 x
      expected: '无限循环'
    },
    {
      name: '或运算符空匹配（危险）',
      content: 'some text',
      pattern: 'a|',  // 匹配 'a' 或空
      expected: '无限循环'
    },
    {
      name: 'ReDoS 攻击（危险）',
      content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab',
      pattern: '(a+)+b',
      expected: '超时'
    },
    {
      name: '正常匹配',
      content: 'TODO fix this\nTODO fix that',
      pattern: 'TODO',
      expected: '正常'
    }
  ];

  const results = [];

  for (const test of tests) {
    const result = await testInfiniteLoop(test.content, test.pattern, test.name, 2000);
    results.push({ ...test, result });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n测试结果汇总:\n');

  const infiniteLoopCount = results.filter(r => r.result.hasInfiniteLoop).length;
  const timeoutCount = results.filter(r => r.result.error?.includes('TIMEOUT')).length;

  results.forEach((r, i) => {
    const status = r.result.hasInfiniteLoop ? '❌ 无限循环' :
                  r.result.error?.includes('TIMEOUT') ? '⏱️ 超时' :
                  r.result.error ? '⚠️ 错误' : '✅ 正常';
    console.log(`${i + 1}. ${r.name.padEnd(30)} ${status}`);
    if (r.result.iterations) {
      console.log(`   迭代次数: ${r.result.iterations}`);
    }
  });

  console.log(`\n总结:`);
  console.log(`- 无限循环风险: ${infiniteLoopCount} 个`);
  console.log(`- 超时风险: ${timeoutCount} 个`);
  console.log(`- 正常工作: ${results.length - infiniteLoopCount - timeoutCount} 个`);

  if (infiniteLoopCount > 0 || timeoutCount > 0) {
    console.log(`\n⚠️ contentPattern 存在严重的无限循环和 ReDoS 风险！`);
  }
}

main().catch(console.error);
