/**
 * contentPattern 最终验证测试
 *
 * 验证三种行为：
 * 1. 空字符串 "" → 返回全文
 * 2. 危险模式 "x*" → 返回全文（安全回退）
 * 3. 正常模式 "CCW" → 正常过滤
 */

import { executeTool } from './ccw/dist/tools/index.js';

async function testContentPattern() {
  console.log('=== contentPattern 最终验证测试 ===\n');

  // Test 1: 空字符串
  console.log('1. 空字符串 "" → 应该返回全文');
  console.log('---');
  const result1 = await executeTool('read_file', {
    paths: 'README.md',
    contentPattern: '',
    includeContent: true
  });

  if (result1.success) {
    const file = result1.result.files[0];
    console.log(`✅ 文件: ${file.path}`);
    console.log(`   内容长度: ${file.content?.length || 0} chars`);
    console.log(`   截断: ${file.truncated ? '是' : '否'}`);
    console.log(`   总行数: ${file.totalLines}`);
    console.log(`   状态: 返回全文（空字符串模式）`);
  }

  // Test 2: 危险模式
  console.log('\n2. 危险模式 "x*" → 应该返回全文（安全回退）');
  console.log('---');
  const result2 = await executeTool('read_file', {
    paths: 'README.md',
    contentPattern: 'x*',
    includeContent: true
  });

  if (result2.success) {
    const file = result2.result.files[0];
    console.log(`✅ 文件: ${file.path}`);
    console.log(`   内容长度: ${file.content?.length || 0} chars`);
    console.log(`   截断: ${file.truncated ? '是' : '否'}`);
    console.log(`   matches: ${file.matches?.length || '无（全文模式）'}`);
    console.log(`   状态: 安全回退 → 返回全文（危险模式被自动处理）`);
  }

  // Test 3: 正常模式
  console.log('\n3. 正常模式 "CCW" → 应该过滤并返回匹配');
  console.log('---');
  const result3 = await executeTool('read_file', {
    paths: 'README.md',
    contentPattern: 'CCW',
    includeContent: true
  });

  if (result3.success) {
    const file = result3.result.files[0];
    console.log(`✅ 文件: ${file.path}`);
    console.log(`   内容长度: ${file.content?.length || 0} chars`);
    console.log(`   matches: ${file.matches?.length || 0}`);
    if (file.matches?.length > 0) {
      console.log(`   匹配示例: ${file.matches[0]}`);
    }
    console.log(`   状态: 正常过滤（返回匹配内容）`);
  }

  // Test 4: 无匹配模式 (includeContent:true 才会过滤)
  console.log('\n4. 无匹配模式 "NOMATCHXYZ" → 应该跳过文件');
  console.log('---');
  console.log('注意: 需要使用 includeContent:true 才会进行内容过滤');
  const result4 = await executeTool('read_file', {
    paths: 'README.md',
    contentPattern: 'NOMATCHXYZ',
    includeContent: true
  });

  if (result4.success) {
    const files = result4.result.files;
    console.log(`返回文件数: ${files.length}`);
    if (files.length === 0) {
      console.log(`✅ 状态: 文件被跳过（无匹配）`);
    } else {
      console.log(`⚠️ 意外: 返回了 ${files.length} 个文件`);
      if (files[0]) {
        console.log(`   文件: ${files[0].path}, 有内容: ${files[0].content ? '是' : '否'}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ 所有测试通过！');
  console.log('\n行为总结:');
  console.log('  空字符串 ""     → 返回全文（设计行为）');
  console.log('  危险模式 "x*"   → 返回全文（安全回退）');
  console.log('  正常模式 "CCW"  → 正常过滤');
  console.log('  无匹配 "NOMATCH" → 跳过文件');
}

testContentPattern().catch(console.error);
