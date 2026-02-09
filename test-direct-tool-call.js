/**
 * 直接测试 read_file 工具的危险模式拦截
 */

import { executeTool } from './ccw/dist/tools/index.js';

async function testPatterns() {
  console.log('=== 直接测试 read_file 工具 ===\n');

  // 测试空字符串模式
  console.log('1. 测试空字符串模式 ""');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: '',
      includeContent: false
    });
    console.log('结果:', result.success ? '成功' : '失败');
    console.log('文件数:', result.result?.files?.length || 0);
  } catch (error) {
    console.log('异常:', error.message);
  }

  // 测试零宽匹配
  console.log('\n2. 测试零宽匹配 "x*"');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: 'x*',
      includeContent: false
    });
    console.log('结果:', result.success ? '成功' : '失败');
    console.log('文件数:', result.result?.files?.length || 0);
  } catch (error) {
    console.log('异常:', error.message);
  }

  // 测试或空匹配
  console.log('\n3. 测试或空匹配 "a|"');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: 'a|',
      includeContent: false
    });
    console.log('结果:', result.success ? '成功' : '失败');
    console.log('文件数:', result.result?.files?.length || 0);
  } catch (error) {
    console.log('异常:', error.message);
  }

  // 测试正常模式
  console.log('\n4. 测试正常模式 "CCW"');
  try {
    const result = await executeTool('read_file', {
      paths: 'README.md',
      contentPattern: 'CCW',
      includeContent: false
    });
    console.log('结果:', result.success ? '成功' : '失败');
    console.log('文件数:', result.result?.files?.length || 0);
  } catch (error) {
    console.log('异常:', error.message);
  }
}

testPatterns().catch(console.error);
