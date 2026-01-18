#!/usr/bin/env node
/**
 * CCW Native Wrapper
 * 
 * 替代 npm 生成的 shell wrapper，直接用 Node.js 处理参数传递，
 * 避免 Git Bash + Windows 的多行参数问题。
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 目标脚本路径
const targetScript = join(__dirname, 'ccw.js');

// 直接传递所有参数，不经过 shell
const child = spawn(process.execPath, [targetScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false, // 关键：不使用 shell，避免参数被 shell 解析
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start ccw:', err.message);
  process.exit(1);
});
