#!/usr/bin/env node
/**
 * CLI Shell Prompt Test Script
 * 
 * Tests actual shell execution of different prompt formats.
 * Demonstrates correct vs incorrect multi-line prompt handling.
 */

import { execSync, exec } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';

const tmpDir = mkdtempSync(join(tmpdir(), 'ccw-shell-test-'));

/**
 * Execute ccw cli test-parse and capture output
 */
function testParse(command, description) {
  console.log(chalk.bold.cyan(`\n${'─'.repeat(70)}`));
  console.log(chalk.bold.white(`📋 ${description}`));
  console.log(chalk.gray(`Command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`));
  console.log(chalk.cyan('─'.repeat(70)));
  
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: process.cwd(),
      shell: true,
      timeout: 10000,
    });
    
    // Extract key info from output
    const promptMatch = result.match(/Value: "([^"]+)"/);
    const sourceMatch = result.match(/Source: ([^\n]+)/);
    
    if (promptMatch) {
      console.log(chalk.green('✓ Parsed prompt: ') + chalk.yellow(promptMatch[1].substring(0, 60)));
    }
    if (sourceMatch) {
      console.log(chalk.gray('  Source: ') + sourceMatch[1]);
    }
    
    // Check if prompt was truncated or split
    if (result.includes('Positional Arguments') && result.includes('[0]:')) {
      const posMatch = result.match(/\[0\]: "([^"]+)"/);
      if (posMatch) {
        console.log(chalk.red('⚠ WARNING: Part of prompt leaked to positional args: ') + chalk.yellow(posMatch[1]));
      }
    }
    
    return { success: true, output: result };
  } catch (error) {
    console.log(chalk.red('✗ Error: ') + error.message);
    return { success: false, error };
  }
}

/**
 * Main test suite
 */
function main() {
  console.log(chalk.bold.magenta('\n' + '█'.repeat(70)));
  console.log(chalk.bold.white('  SHELL PROMPT FORMAT TESTS'));
  console.log(chalk.bold.magenta('█'.repeat(70)));

  // ============================================
  // INCORRECT METHODS (will fail or parse wrong)
  // ============================================
  console.log(chalk.bold.red('\n\n⛔ INCORRECT METHODS (will fail):'));
  
  // Method 1: Direct multi-line in double quotes (WRONG)
  testParse(
    `ccw cli test-parse -p "PURPOSE: Test
TASK: Step 1" --tool gemini`,
    '❌ Direct multi-line in double quotes (WRONG)'
  );

  // ============================================
  // CORRECT METHODS
  // ============================================
  console.log(chalk.bold.green('\n\n✅ CORRECT METHODS:'));

  // Method 1: Single line (works)
  testParse(
    `ccw cli test-parse -p "PURPOSE: Test | TASK: Step 1" --tool gemini`,
    '✓ Single line with pipe separator'
  );

  // Method 2: File-based (-f option) - RECOMMENDED
  const promptFile = join(tmpDir, 'prompt.txt');
  writeFileSync(promptFile, `PURPOSE: Identify vulnerabilities
TASK: • Scan injection flaws • Check auth bypass
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: Security report`);
  
  testParse(
    `ccw cli test-parse -f "${promptFile}" --tool gemini`,
    '✓ File-based prompt (-f option) - RECOMMENDED'
  );

  // Method 3: $'...' syntax with literal \n (bash only)
  testParse(
    `ccw cli test-parse -p $'PURPOSE: Test\\nTASK: Step 1\\nMODE: analysis' --tool gemini`,
    "✓ $'...' syntax with \\n (bash only)"
  );

  // Method 4: Heredoc via stdin (if supported)
  // Note: ccw cli currently doesn't support stdin, but showing the pattern
  console.log(chalk.bold.cyan(`\n${'─'.repeat(70)}`));
  console.log(chalk.bold.white(`📋 ✓ Heredoc pattern (for reference)`));
  console.log(chalk.gray(`Command: cat <<'EOF' > prompt.txt && ccw cli -f prompt.txt ...`));
  console.log(chalk.cyan('─'.repeat(70)));
  console.log(chalk.green('✓ Create file with heredoc, then use -f option'));

  // Method 5: Single line with escaped newlines in content
  testParse(
    `ccw cli test-parse -p "PURPOSE: Test | TASK: Step 1 | MODE: analysis | CONTEXT: @src/**/*" --tool gemini`,
    '✓ Single line with | as logical separator'
  );

  // Cleanup
  try {
    unlinkSync(promptFile);
  } catch {}

  // Summary
  console.log(chalk.bold.magenta('\n\n' + '█'.repeat(70)));
  console.log(chalk.bold.white('  SUMMARY: Recommended Approaches'));
  console.log(chalk.bold.magenta('█'.repeat(70)));
  
  console.log(`
${chalk.bold.green('For multi-line prompts, use ONE of these methods:')}

${chalk.bold('1. File-based (RECOMMENDED):')}
   ${chalk.cyan('ccw cli -f prompt.txt --tool gemini --mode analysis')}

${chalk.bold("2. $'...' syntax (bash only):")}
   ${chalk.cyan("ccw cli -p $'PURPOSE: ...\\nTASK: ...\\nMODE: ...' --tool gemini")}

${chalk.bold('3. Heredoc + file:')}
   ${chalk.cyan(`cat <<'EOF' > /tmp/prompt.txt
PURPOSE: ...
TASK: ...
EOF
ccw cli -f /tmp/prompt.txt --tool gemini`)}

${chalk.bold('4. Single line with separators:')}
   ${chalk.cyan('ccw cli -p "PURPOSE: ... | TASK: ... | MODE: ..." --tool gemini')}

${chalk.bold.red('AVOID:')}
   ${chalk.red('ccw cli -p "PURPOSE: ...')}
   ${chalk.red('TASK: ..."  # Multi-line in quotes - WILL BREAK')}
`);
}

main();
