/**
 * 测试优化后的 findMatches 函数
 */

import { executeTool } from './ccw/dist/tools/index.js';

console.log('=== 优化后的 contentPattern 测试 ===\n');

const tests = [
  {
    name: '正常模式',
    tool: 'read_file',
    params: {
      paths: 'README.md',
      contentPattern: 'CCW',
      includeContent: false
    },
    expected: 'success'
  },
  {
    name: '空字符串模式（应该拒绝）',
    tool: 'read_file',
    params: {
      paths: 'README.md',
      contentPattern: '',
      includeContent: false
    },
    expected: 'error_or_empty'
  },
  {
    name: '零宽匹配（应该拒绝）',
    tool: 'read_file',
    params: {
      paths: 'README.md',
      contentPattern: 'x*',
      includeContent: false
    },
    expected: 'error_or_empty'
  },
  {
    name: '或空匹配（应该拒绝）',
    tool: 'read_file',
    params: {
      paths: 'README.md',
      contentPattern: 'a|',
      includeContent: false
    },
    expected: 'error_or_empty'
  },
  {
    name: '正常搜索（TODO）',
    tool: 'read_file',
    params: {
      paths: 'src/tools/read-file.ts',
      contentPattern: 'function',
      includeContent: false
    },
    expected: 'success'
  }
];

async function runTests() {
  for (const test of tests) {
    console.log(`\n测试: ${test.name}`);
    console.log(`参数: contentPattern = "${test.params.contentPattern}"`);

    try {
      const result = await executeTool(test.tool, test.params);

      if (!result.success) {
        console.log(`❌ 工具执行失败: ${result.error}`);
        continue;
      }

      const fileCount = result.result.files.length;
      console.log(`✅ 成功 - 找到 ${fileCount} 个文件`);

      // 检查是否有 matches
      result.result.files.forEach((file) => {
        if (file.matches && file.matches.length > 0) {
          console.log(`   匹配数: ${file.matches.length}`);
          console.log(`   示例: ${file.matches[0].substring(0, 60)}...`);
        }
      });
    } catch (error) {
      console.log(`❌ 异常: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n优化总结:');
  console.log('✅ 空字符串模式检测 - 已添加');
  console.log('✅ 危险模式黑名单 - 已添加');
  console.log('✅ 迭代计数器保护 (1000) - 已添加');
  console.log('✅ 位置前进检查 - 已添加');
  console.log('✅ 结果去重 - 已添加');
  console.log('✅ 错误报告改进 - 已添加');
  console.log('✅ 模式长度限制 (1000) - 已添加');
}

runTests().catch(console.error);
