/**
 * 测试空字符串模式的新行为
 */

import { executeTool } from './ccw/dist/tools/index.js';

async function testEmptyPattern() {
  console.log('=== 空字符串模式测试 ===\n');

  console.log('1. 测试空字符串 "" (应该返回所有内容)');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: '',
      includeContent: true
    });

    if (result.success) {
      const file = result.result.files[0];
      console.log(`✅ 成功返回文件`);
      console.log(`   文件: ${file.path}`);
      console.log(`   大小: ${file.size} bytes`);
      console.log(`   内容长度: ${file.content?.length || 0} chars`);
      console.log(`   截断: ${file.truncated ? '是' : '否'}`);
      console.log(`   总行数: ${file.totalLines}`);

      // 验证内容是否完整
      if (file.content && file.content.length > 100) {
        console.log(`   内容预览: ${file.content.substring(0, 100)}...`);
      }
    } else {
      console.log(`❌ 失败: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ 异常: ${error.message}`);
  }

  console.log('\n2. 测试正常模式 "CCW" (应该过滤)');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: 'CCW',
      includeContent: false
    });

    if (result.success) {
      const file = result.result.files[0];
      console.log(`✅ 成功返回文件`);
      console.log(`   文件: ${file.path}`);
      console.log(`   matches: ${file.matches?.length || 0}`);

      if (file.matches && file.matches.length > 0) {
        console.log(`   示例: ${file.matches[0]}`);
      }
    }
  } catch (error) {
    console.log(`❌ 异常: ${error.message}`);
  }

  console.log('\n3. 测试危险模式 "x*" (应该被拦截)');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: 'x*',
      includeContent: false
    });

    if (result.success) {
      const file = result.result.files[0];
      console.log(`✅ 返回文件: ${file.path}`);
      console.log(`   matches: ${file.matches?.length || 0}`);
      if (file.matches?.length === 0) {
        console.log(`   (被正确拦截，没有匹配)`);
      }
    }
  } catch (error) {
    console.log(`❌ 异常: ${error.message}`);
  }
}

testEmptyPattern().catch(console.error);
