#!/usr/bin/env node
/**
 * CLI Prompt Simulation Script
 * 
 * Simulates different prompt formats and outputs the final content passed to CLI.
 * Usage: node ccw/scripts/simulate-cli-prompt.js
 */

import chalk from 'chalk';

// Test cases for different prompt formats
const testCases = [
  {
    name: 'Single-line prompt',
    input: {
      prompt: 'Analyze the authentication module for security issues',
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: 'Single-line with quotes',
    input: {
      prompt: 'Fix the error: "Cannot read property \'id\' of undefined"',
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: 'Multi-line structured prompt',
    input: {
      prompt: `PURPOSE: Identify security vulnerabilities
TASK: • Scan injection flaws • Check auth bypass
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: Security report`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: '@ patterns with glob wildcards',
    input: {
      prompt: `CONTEXT: @src/**/*.{ts,tsx} @!node_modules/** @!dist/**
TASK: Analyze TypeScript files`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: '@ patterns with Memory section',
    input: {
      prompt: `PURPOSE: Security audit
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Vulnerability report`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: 'Full template format (from cli-tools-usage.md)',
    input: {
      prompt: `PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
CONSTRAINTS: Focus on authentication | Ignore test files`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: 'Special characters and Unicode',
    input: {
      prompt: `TASK: • 分析代码 • Check → errors • Fix ✗ issues
EXPECTED: Report with ✓ checkmarks`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
  {
    name: 'Code-like content',
    input: {
      prompt: `Fix: const result = arr.filter(x => x > 0).map(x => x * 2);
Error at line 42: TypeError: Cannot read property 'length' of null`,
      tool: 'gemini',
      mode: 'write',
    },
  },
  {
    name: 'Shell-like patterns',
    input: {
      prompt: `Run: npm run build && npm test | grep "passed"
Expected output: All tests passed`,
      tool: 'gemini',
      mode: 'analysis',
    },
  },
];

/**
 * Simulate prompt processing (mirrors cli.ts logic)
 */
function simulatePromptProcessing(input) {
  const { prompt, tool, mode, rule = 'universal-rigorous-style' } = input;
  
  // Step 1: Get base prompt
  let finalPrompt = prompt;
  
  // Step 2: Extract @ patterns from CONTEXT (for cache simulation)
  const contextMatch = prompt.match(/CONTEXT:\s*([^\n]+)/i);
  let extractedPatterns = [];
  if (contextMatch) {
    const contextLine = contextMatch[1];
    const patternMatches = contextLine.matchAll(/@[^\s|]+/g);
    extractedPatterns = Array.from(patternMatches).map(m => m[0]);
  }
  
  // Step 3: Simulate template concatenation
  const mockSystemRules = `[SYSTEM RULES - ${mode} mode protocol loaded]`;
  const mockRoles = `[ROLES - ${rule} template loaded]`;
  
  const parts = [finalPrompt];
  parts.push(`\n=== SYSTEM RULES ===\n${mockSystemRules}`);
  parts.push(`\n=== ROLES ===\n${mockRoles}`);
  
  return {
    originalPrompt: prompt,
    finalPrompt: parts.join('\n'),
    extractedPatterns,
    metadata: {
      tool,
      mode,
      rule,
      originalLength: prompt.length,
      finalLength: parts.join('\n').length,
      lineCount: parts.join('\n').split('\n').length,
      hasMultiline: prompt.includes('\n'),
      hasAtPatterns: extractedPatterns.length > 0,
    },
  };
}

/**
 * Display test result
 */
function displayResult(testCase, result) {
  console.log(chalk.bold.cyan('\n' + '═'.repeat(70)));
  console.log(chalk.bold.white(`📋 Test: ${testCase.name}`));
  console.log(chalk.cyan('═'.repeat(70)));
  
  // Input section
  console.log(chalk.bold.yellow('\n📥 INPUT:'));
  console.log(chalk.gray('  Tool: ') + chalk.green(testCase.input.tool));
  console.log(chalk.gray('  Mode: ') + chalk.green(testCase.input.mode));
  console.log(chalk.gray('  Prompt:'));
  console.log(chalk.white('  ┌' + '─'.repeat(66) + '┐'));
  testCase.input.prompt.split('\n').forEach(line => {
    const truncated = line.length > 64 ? line.substring(0, 61) + '...' : line;
    console.log(chalk.white('  │ ') + chalk.cyan(truncated.padEnd(64)) + chalk.white(' │'));
  });
  console.log(chalk.white('  └' + '─'.repeat(66) + '┘'));
  
  // Metadata section
  console.log(chalk.bold.yellow('\n📊 METADATA:'));
  console.log(chalk.gray('  Original length: ') + chalk.magenta(result.metadata.originalLength + ' chars'));
  console.log(chalk.gray('  Final length: ') + chalk.magenta(result.metadata.finalLength + ' chars'));
  console.log(chalk.gray('  Line count: ') + chalk.magenta(result.metadata.lineCount));
  console.log(chalk.gray('  Has multiline: ') + (result.metadata.hasMultiline ? chalk.green('✓') : chalk.red('✗')));
  console.log(chalk.gray('  Has @ patterns: ') + (result.metadata.hasAtPatterns ? chalk.green('✓') : chalk.red('✗')));
  
  if (result.extractedPatterns.length > 0) {
    console.log(chalk.gray('  Extracted patterns:'));
    result.extractedPatterns.forEach(p => {
      console.log(chalk.gray('    • ') + chalk.blue(p));
    });
  }
  
  // Final prompt section
  console.log(chalk.bold.yellow('\n📤 FINAL PROMPT (passed to CLI):'));
  console.log(chalk.white('  ┌' + '─'.repeat(66) + '┐'));
  result.finalPrompt.split('\n').slice(0, 15).forEach(line => {
    const truncated = line.length > 64 ? line.substring(0, 61) + '...' : line;
    console.log(chalk.white('  │ ') + chalk.green(truncated.padEnd(64)) + chalk.white(' │'));
  });
  if (result.finalPrompt.split('\n').length > 15) {
    console.log(chalk.white('  │ ') + chalk.dim(`... (${result.finalPrompt.split('\n').length - 15} more lines)`.padEnd(64)) + chalk.white(' │'));
  }
  console.log(chalk.white('  └' + '─'.repeat(66) + '┘'));
}

/**
 * Main execution
 */
function main() {
  console.log(chalk.bold.magenta('\n' + '█'.repeat(70)));
  console.log(chalk.bold.white('  CLI PROMPT SIMULATION - Testing Different Prompt Formats'));
  console.log(chalk.bold.magenta('█'.repeat(70)));
  
  console.log(chalk.gray('\nThis script simulates how different prompt formats are processed'));
  console.log(chalk.gray('and shows the final content passed to the CLI executor.\n'));
  
  for (const testCase of testCases) {
    const result = simulatePromptProcessing(testCase.input);
    displayResult(testCase, result);
  }
  
  console.log(chalk.bold.magenta('\n' + '█'.repeat(70)));
  console.log(chalk.bold.white(`  Completed ${testCases.length} simulations`));
  console.log(chalk.bold.magenta('█'.repeat(70) + '\n'));
}

main();
