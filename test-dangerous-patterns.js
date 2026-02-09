/**
 * 测试危险模式拦截功能
 * 通过捕获 console.error 来验证危险模式是否被检测
 */

import { executeTool } from './ccw/dist/tools/index.js';

// 捕获 console.error
const originalError = console.error;
const errorLogs = [];

console.error = (...args) => {
  errorLogs.push(args.join(' '));
  originalError(...args);
};

async function testDangerousPatterns() {
  console.log('=== 危险模式拦截测试 ===\n');

  const tests = [
    {
      name: '空字符串模式',
      pattern: '',
      shouldReject: true
    },
    {
      name: '零宽匹配 *',
      pattern: 'x*',
      shouldReject: true
    },
    {
      name: '或空匹配 a|',
      pattern: 'a|',
      shouldReject: true
    },
    {
      name: '点星 .*',
      pattern: '.*',
      shouldReject: true
    },
    {
      name: '正常模式',
      pattern: 'CCW',
      shouldReject: false
    },
    {
      name: '正常模式 TODO',
      pattern: 'TODO',
      shouldReject: false
    }
  ];

  for (const test of tests) {
    errorLogs.length = 0; // 清空错误日志

    console.log(`\n测试: ${test.name}`);
    console.log(`模式: "${test.pattern}"`);
    console.log(`预期: ${test.shouldReject ? '应该拒绝' : '应该接受'}`);

    try {
      const result = await executeTool('read_file', {
        paths: 'README.md',
        contentPattern: test.pattern,
        includeContent: false
      });

      // 检查是否有错误日志
      const hasError = errorLogs.some(log =>
        log.includes('contentPattern error') || log.includes('contentPattern warning')
      );

      if (test.shouldReject) {
        if (hasError) {
          console.log(`✅ 正确拒绝 - ${errorLogs[0]}`);
        } else {
          console.log(`❌ 未拒绝 - 应该拒绝但接受了`);
        }
      } else {
        if (hasError) {
          console.log(`❌ 错误拒绝 - ${errorLogs[0]}`);
        } else {
          console.log(`✅ 正常接受 - 找到 ${result.result.files.length} 个文件`);
        }
      }
    } catch (error) {
      console.log(`❌ 异常: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);

  // 恢复原始 console.error
  console.error = originalError;

  console.log('\n测试完成！');
}

testDangerousPatterns().catch(console.error);
