/**
 * LiteLLM Usage Examples
 * Demonstrates how to use the LiteLLM TypeScript client
 */

import { getLiteLLMClient, getLiteLLMStatus } from '../src/tools/litellm-client';

async function main() {
  console.log('=== LiteLLM TypeScript Bridge Examples ===\n');

  // Example 1: Check availability
  console.log('1. Checking LiteLLM availability...');
  const status = await getLiteLLMStatus();
  console.log('   Status:', status);
  console.log('');

  if (!status.available) {
    console.log('❌ LiteLLM is not available. Please install ccw-litellm:');
    console.log('   pip install ccw-litellm');
    return;
  }

  const client = getLiteLLMClient();

  // Example 2: Get configuration
  console.log('2. Getting configuration...');
  try {
    const config = await client.getConfig();
    console.log('   Config:', config);
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  // Example 3: Generate embeddings
  console.log('3. Generating embeddings...');
  try {
    const texts = ['Hello world', 'Machine learning is amazing'];
    const embedResult = await client.embed(texts, 'default');
    console.log('   Dimensions:', embedResult.dimensions);
    console.log('   Vectors count:', embedResult.vectors.length);
    console.log('   First vector (first 5 dims):', embedResult.vectors[0]?.slice(0, 5));
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  // Example 4: Single message chat
  console.log('4. Single message chat...');
  try {
    const response = await client.chat('What is 2+2?', 'default');
    console.log('   Response:', response);
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  // Example 5: Multi-turn chat
  console.log('5. Multi-turn chat...');
  try {
    const chatResponse = await client.chatMessages([
      { role: 'system', content: 'You are a helpful math tutor.' },
      { role: 'user', content: 'What is the Pythagorean theorem?' }
    ], 'default');
    console.log('   Content:', chatResponse.content);
    console.log('   Model:', chatResponse.model);
    console.log('   Usage:', chatResponse.usage);
  } catch (error) {
    console.log('   Error:', error.message);
  }
  console.log('');

  console.log('=== Examples completed ===');
}

// Run examples
main().catch(console.error);
