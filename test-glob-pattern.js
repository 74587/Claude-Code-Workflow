/**
 * Glob 模式匹配测试
 */

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

const tests = [
  ['*.ts', 'app.ts'],
  ['*.ts', 'app.tsx'],
  ['test_*.js', 'test_main.js'],
  ['test_*.js', 'main_test.js'],
  ['*.json', 'package.json'],
  ['c*.ts', 'config.ts'],
  ['data?.json', 'data1.json'],
  ['data?.json', 'data12.json'],
  ['*.{js,ts}', 'app.js'],      // 不支持大括号语法
  ['src/**/*.ts', 'src/app.ts'], // 不支持双星语法
];

console.log('Glob 模式匹配测试:');
console.log('─'.repeat(60));
tests.forEach(([pattern, filename]) => {
  const regex = globToRegex(pattern);
  const matches = regex.test(filename);
  console.log(`${pattern.padEnd(20)} → ${filename.padEnd(20)} ${matches ? '✅ 匹配' : '❌ 不匹配'}`);
  if (pattern.includes('{') || pattern.includes('**')) {
    console.log(`  ⚠️  注意: 当前实现不支持 ${pattern.includes('{') ? '{}' : '**'} 语法`);
  }
});
