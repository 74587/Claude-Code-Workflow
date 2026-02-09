/**
 * 测试零宽度模式的检测逻辑
 */

console.log('=== 零宽度模式检测测试 ===\n');

const testPatterns = [
  { pattern: '', desc: '空字符串' },
  { pattern: 'x*', desc: '零宽量词' },
  { pattern: 'a|', desc: '或空匹配' },
  { pattern: '.*', desc: '点星' },
  { pattern: 'CCW', desc: '正常模式' },
  { pattern: 'TODO', desc: '正常模式2' }
];

for (const test of testPatterns) {
  console.log(`\n测试: ${test.desc}`);
  console.log(`模式: "${test.pattern}"`);

  try {
    const regex = new RegExp(test.pattern, 'gm');
    const emptyTest = regex.exec('');

    console.log(`第1次匹配:`, emptyTest ? {
      match: emptyTest[0],
      index: emptyTest.index,
      length: emptyTest[0].length
    } : 'null');

    if (emptyTest && emptyTest[0] === '' && emptyTest.index === 0) {
      const secondMatch = regex.exec('');
      console.log(`第2次匹配:`, secondMatch ? {
        match: secondMatch[0],
        index: secondMatch.index,
        length: secondMatch[0].length
      } : 'null');

      if (secondMatch && secondMatch.index === 0) {
        console.log(`❌ 危险: 卡在位置 0`);
      } else {
        console.log(`✅ 安全: 第2次匹配在位置 ${secondMatch?.index || '(end)'}`);
      }
    } else {
      console.log(`✅ 安全: 第1次匹配后位置 = ${emptyTest?.index || '(end)'}`);
    }
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('\n结论:');

console.log(`
问题分析:
- 空字符串 "" 应该被 pattern === '' 检查捕获
- "x*" 在空字符串上:
  * 第1次匹配: "" (index=0)
  * 第2次匹配: null (已经结束)
  * 所以不会卡住！
- "a|" 在空字符串上:
  * 第1次匹配: "" (index=0, 匹配 | 右侧)
  * 第2次匹配: null (已经结束)
  * 所以也不会卡住！
- ".*" 在空字符串上:
  * 第1次匹配: "" (index=0)
  * 第2次匹配: null (已经结束)

真正的危险是:
- 在**非空内容**上反复匹配空字符串
- 例如: "x*" 在 "abc" 上会匹配 4 次（a 前各一次）
`);

console.log('\n真正的危险测试:');
console.log('模式 "x*" 在内容 "abc" 上的行为:');

const regex = new RegExp('x*', 'gm');
const content = 'abc';
let match;
let count = 0;
let lastIndex = -1;

while ((match = regex.exec(content)) !== null && count < 10) {
  count++;
  console.log(`  匹配 #${count}: "${match[0]}" at index ${match.index}`);

  if (match.index === lastIndex) {
    console.log(\`  ❌ 卡住! 停留在 index \${match.index}\`);
    break;
  }
  lastIndex = match.index;
}

if (count >= 10) {
  console.log('  ⚠️ 达到 10 次迭代限制');
}

console.log(`\n结论: "x*" 会在非 x 字符的每个位置匹配空字符串!`);
