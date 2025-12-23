/**
 * LiteLLM Client Tests
 * Tests for the LiteLLM TypeScript bridge
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LiteLLMClient, getLiteLLMClient, checkLiteLLMAvailable, getLiteLLMStatus } from '../src/tools/litellm-client';

describe('LiteLLMClient', () => {
  let client: LiteLLMClient;

  beforeEach(() => {
    client = new LiteLLMClient({ timeout: 5000 });
  });

  describe('Constructor', () => {
    it('should create client with default config', () => {
      const defaultClient = new LiteLLMClient();
      expect(defaultClient).toBeDefined();
    });

    it('should create client with custom config', () => {
      const customClient = new LiteLLMClient({
        pythonPath: 'python3',
        timeout: 10000
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should check if ccw-litellm is available', async () => {
      const available = await client.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('getStatus', () => {
    it('should return status object', async () => {
      const status = await client.getStatus();
      expect(status).toHaveProperty('available');
      expect(typeof status.available).toBe('boolean');
    });
  });

  describe('embed', () => {
    it('should throw error for empty texts array', async () => {
      await expect(client.embed([])).rejects.toThrow('texts array cannot be empty');
    });

    it('should throw error for null texts', async () => {
      await expect(client.embed(null as any)).rejects.toThrow();
    });
  });

  describe('chat', () => {
    it('should throw error for empty message', async () => {
      await expect(client.chat('')).rejects.toThrow('message cannot be empty');
    });
  });

  describe('chatMessages', () => {
    it('should throw error for empty messages array', async () => {
      await expect(client.chatMessages([])).rejects.toThrow('messages array cannot be empty');
    });

    it('should throw error for null messages', async () => {
      await expect(client.chatMessages(null as any)).rejects.toThrow();
    });
  });
});

describe('Singleton Functions', () => {
  describe('getLiteLLMClient', () => {
    it('should return singleton instance', () => {
      const client1 = getLiteLLMClient();
      const client2 = getLiteLLMClient();
      expect(client1).toBe(client2);
    });
  });

  describe('checkLiteLLMAvailable', () => {
    it('should return boolean', async () => {
      const available = await checkLiteLLMAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('getLiteLLMStatus', () => {
    it('should return status object', async () => {
      const status = await getLiteLLMStatus();
      expect(status).toHaveProperty('available');
      expect(typeof status.available).toBe('boolean');
    });
  });
});
