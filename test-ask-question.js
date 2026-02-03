/**
 * Test ask_question MCP tool
 */

import { executeTool } from './ccw/dist/tools/index.js';

async function testAskQuestion() {
  console.log('Testing ask_question tool...\n');

  // Test 1: Confirm question
  console.log('Test 1: Confirm Question');
  const confirmResult = await executeTool('ask_question', {
    question: {
      id: 'test-confirm-1',
      type: 'confirm',
      title: '是否继续执行当前操作？',
      message: '这是一个确认对话框测试',
      description: '点击确认继续，点击取消终止',
    },
    timeout: 30000, // 30 seconds
  });
  console.log('Result:', JSON.stringify(confirmResult, null, 2));

  // Test 2: Select question
  console.log('\n\nTest 2: Select Question');
  const selectResult = await executeTool('ask_question', {
    question: {
      id: 'test-select-1',
      type: 'select',
      title: '请选择您的偏好颜色',
      options: [
        { value: 'red', label: '红色', description: '热情的红色' },
        { value: 'blue', label: '蓝色', description: '冷静的蓝色' },
        { value: 'green', label: '绿色', description: '自然的绿色' },
      ],
    },
    timeout: 30000,
  });
  console.log('Result:', JSON.stringify(selectResult, null, 2));

  // Test 3: Input question
  console.log('\n\nTest 3: Input Question');
  const inputResult = await executeTool('ask_question', {
    question: {
      id: 'test-input-1',
      type: 'input',
      title: '请输入您的名字',
      placeholder: '例如: 张三',
      required: true,
    },
    timeout: 30000,
  });
  console.log('Result:', JSON.stringify(inputResult, null, 2));

  // Test 4: Multi-select question
  console.log('\n\nTest 4: Multi-Select Question');
  const multiResult = await executeTool('ask_question', {
    question: {
      id: 'test-multi-1',
      type: 'multi-select',
      title: '选择您感兴趣的编程语言（可多选）',
      options: [
        { value: 'js', label: 'JavaScript' },
        { value: 'ts', label: 'TypeScript' },
        { value: 'py', label: 'Python' },
        { value: 'go', label: 'Go' },
      ],
    },
    timeout: 30000,
  });
  console.log('Result:', JSON.stringify(multiResult, null, 2));

  console.log('\n✅ All tests completed');
}

// Run tests
testAskQuestion().catch(console.error);
