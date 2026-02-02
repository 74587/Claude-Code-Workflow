/**
 * Test script to verify CLI API response format
 * Tests that the API returns properly parsed JSON without double-serialization
 */

import { join } from 'path';

async function testApiResponse() {
  console.log('=== API Response Format Test ===\n');

  // Use parent directory as project root (D:\Claude_dms3 instead of D:\Claude_dms3\ccw)
  const projectPath = join(process.cwd(), '..');

  // Test 1: Get a sample execution (you'll need to replace with an actual ID)
  console.log('Test 1: Get conversation detail');
  console.log('Project path:', projectPath);
  
  try {
    // Get the most recent execution for testing
    const { getHistoryStore } = await import('../src/tools/cli-history-store.js');
    const store = getHistoryStore(projectPath);
    const history = store.getHistory({ limit: 1 });

    if (history.total === 0 || history.executions.length === 0) {
      console.log('❌ No execution history found. Please run a CLI command first.');
      console.log('Example: ccw cli -p "test" --tool gemini --mode analysis\n');
      return;
    }

    const executionId = history.executions[0].id;
    console.log('Testing with execution ID:', executionId, '\n');

    // Get conversation detail - use getConversationWithNativeInfo from store directly
    const conversation = store.getConversationWithNativeInfo(executionId);
    
    if (!conversation) {
      console.log('❌ Conversation not found');
      return;
    }
    
    console.log('✅ Conversation retrieved');
    console.log('  - ID:', conversation.id);
    console.log('  - Tool:', conversation.tool);
    console.log('  - Mode:', conversation.mode);
    console.log('  - Turns:', conversation.turns.length);
    console.log();
    
    // Test 2: Check turn output structure
    console.log('Test 2: Verify turn output structure');
    
    if (conversation.turns.length > 0) {
      const firstTurn = conversation.turns[0];
      console.log('First turn output keys:', Object.keys(firstTurn.output));
      console.log();
      
      // Test 3: Check for double-serialization
      console.log('Test 3: Check for JSON double-serialization');
      
      const outputFields = [
        'stdout',
        'stderr',
        'parsed_output',
        'final_output'
      ];
      
      let hasDoubleSerializtion = false;
      
      for (const field of outputFields) {
        const value = firstTurn.output[field as keyof typeof firstTurn.output];
        if (value && typeof value === 'string') {
          // Check if the string starts with a JSON structure indicator
          const trimmed = value.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              console.log(`⚠️  ${field}: Contains JSON string (length: ${trimmed.length})`);
              console.log(`   First 100 chars: ${trimmed.substring(0, 100)}...`);
              console.log(`   Parsed type: ${typeof parsed}, keys: ${Object.keys(parsed).slice(0, 5).join(', ')}`);
              hasDoubleSerializtion = true;
            } catch {
              // Not JSON, this is fine
              console.log(`✅ ${field}: Plain text (length: ${trimmed.length})`);
            }
          } else {
            console.log(`✅ ${field}: Plain text (length: ${trimmed.length})`);
          }
        } else if (value) {
          console.log(`ℹ️  ${field}: Type ${typeof value}`);
        }
      }
      
      console.log();
      
      if (hasDoubleSerializtion) {
        console.log('❌ ISSUE FOUND: Some fields contain JSON strings instead of plain text');
        console.log('   This suggests double-serialization or incorrect parsing.');
      } else {
        console.log('✅ No double-serialization detected');
      }
    }
    
    // Test 4: Simulate API JSON.stringify
    console.log('\nTest 4: Simulate API response serialization');
    const apiResponse = JSON.stringify(conversation);
    console.log('API response length:', apiResponse.length);
    
    // Parse it back (like frontend would)
    const parsed = JSON.parse(apiResponse);
    console.log('✅ Can be parsed back');
    console.log('Parsed turn count:', parsed.turns.length);
    
    if (parsed.turns.length > 0) {
      const parsedTurn = parsed.turns[0];
      console.log('Parsed turn output keys:', Object.keys(parsedTurn.output));
      
      // Check if parsed_output is accessible
      if (parsedTurn.output.parsed_output) {
        console.log('✅ parsed_output field is accessible');
        console.log('   Length:', parsedTurn.output.parsed_output.length);
      } else {
        console.log('❌ parsed_output field is missing or undefined');
      }
    }
    
    // Test 5: Check stdout content - is it JSON lines or plain text?
    console.log('\nTest 5: Check stdout content format');
    if (conversation.turns.length > 0) {
      const stdout = conversation.turns[0].output.stdout;
      const firstLines = stdout.split('\n').slice(0, 5);
      console.log('First 5 lines of stdout:');
      for (const line of firstLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let isJson = false;
        try {
          JSON.parse(trimmed);
          isJson = true;
        } catch {}
        console.log(`  ${isJson ? '⚠️ JSON' : '✅ TEXT'}: ${trimmed.substring(0, 120)}${trimmed.length > 120 ? '...' : ''}`);
      }

      // Compare stdout vs parsed_output
      const parsedOutput = conversation.turns[0].output.parsed_output;
      console.log('\nTest 6: Compare stdout vs parsed_output');
      console.log(`  stdout length: ${stdout.length}`);
      console.log(`  parsed_output length: ${parsedOutput?.length || 0}`);
      if (parsedOutput) {
        const parsedFirstLines = parsedOutput.split('\n').slice(0, 3);
        console.log('  First 3 lines of parsed_output:');
        for (const line of parsedFirstLines) {
          console.log(`    ${line.substring(0, 120)}${line.length > 120 ? '...' : ''}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test that buildCommand returns correct outputFormat for all tools
 */
async function testOutputFormatDetection() {
  console.log('\n=== Output Format Detection Test ===\n');

  const { buildCommand } = await import('../src/tools/cli-executor-utils.js');

  const tools = ['gemini', 'qwen', 'codex', 'claude', 'opencode'];

  for (const tool of tools) {
    try {
      const result = buildCommand({
        tool,
        prompt: 'test prompt',
        mode: 'analysis',
      });
      const expected = 'json-lines';
      const status = result.outputFormat === expected ? '✅' : '❌';
      console.log(`  ${status} ${tool}: outputFormat = "${result.outputFormat}" (expected: "${expected}")`);
    } catch (err) {
      console.log(`  ⚠️  ${tool}: buildCommand error (${(err as Error).message})`);
    }
  }
}

/**
 * Test that JsonLinesParser correctly extracts text from Gemini JSON lines
 */
async function testJsonLinesParsing() {
  console.log('\n=== JSON Lines Parser Test ===\n');

  const { createOutputParser, flattenOutputUnits } = await import('../src/tools/cli-output-converter.js');

  const parser = createOutputParser('json-lines');

  // Simulate Gemini stream-json output
  const geminiLines = [
    '{"type":"init","timestamp":"2026-01-01T00:00:00.000Z","session_id":"test-session","model":"gemini-2.5-pro"}',
    '{"type":"message","timestamp":"2026-01-01T00:00:01.000Z","role":"user","content":"test prompt"}',
    '{"type":"message","timestamp":"2026-01-01T00:00:02.000Z","role":"assistant","content":"Hello, this is the response text.","delta":true}',
    '{"type":"message","timestamp":"2026-01-01T00:00:03.000Z","role":"assistant","content":" More response text here.","delta":true}',
    '{"type":"result","timestamp":"2026-01-01T00:00:04.000Z","status":"success","stats":{"input_tokens":100,"output_tokens":50}}',
  ];

  const input = Buffer.from(geminiLines.join('\n') + '\n');
  const units = parser.parse(input, 'stdout');
  const remaining = parser.flush();
  const allUnits = [...units, ...remaining];

  console.log(`  Total IR units created: ${allUnits.length}`);
  for (const unit of allUnits) {
    const contentPreview = typeof unit.content === 'string'
      ? unit.content.substring(0, 80)
      : JSON.stringify(unit.content).substring(0, 80);
    console.log(`    Type: ${unit.type.padEnd(20)} Content: ${contentPreview}`);
  }

  // Test flattenOutputUnits with same filters as cli-executor-core.ts
  const parsedOutput = flattenOutputUnits(allUnits, {
    excludeTypes: ['stderr', 'progress', 'metadata', 'system', 'tool_call', 'thought', 'code', 'file_diff', 'streaming_content'],
    stripCommandJsonBlocks: true
  });

  console.log();
  console.log(`  parsed_output result:`);
  console.log(`    "${parsedOutput}"`);

  // Verify it's NOT JSON lines
  const firstLine = parsedOutput.split('\n')[0]?.trim();
  let isJson = false;
  try {
    JSON.parse(firstLine);
    isJson = true;
  } catch {}

  if (isJson) {
    console.log(`  ❌ parsed_output still contains JSON lines!`);
  } else {
    console.log(`  ✅ parsed_output contains plain text (not JSON lines)`);
  }
}

// Run all tests
(async () => {
  await testApiResponse();
  await testOutputFormatDetection();
  await testJsonLinesParsing();
})().catch(console.error);
