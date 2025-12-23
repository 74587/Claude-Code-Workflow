/**
 * LiteLLM Client - Bridge between CCW and ccw-litellm Python package
 * Provides LLM chat and embedding capabilities via spawned Python process
 *
 * Features:
 * - Chat completions with multiple models
 * - Text embeddings generation
 * - Configuration management
 * - JSON protocol communication
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

export interface LiteLLMConfig {
  pythonPath?: string;  // Default 'python'
  configPath?: string;  // Configuration file path
  timeout?: number;     // Default 60000ms
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbedResponse {
  vectors: number[][];
  dimensions: number;
  model: string;
}

export interface LiteLLMStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export class LiteLLMClient {
  private pythonPath: string;
  private configPath?: string;
  private timeout: number;

  constructor(config: LiteLLMConfig = {}) {
    this.pythonPath = config.pythonPath || 'python';
    this.configPath = config.configPath;
    this.timeout = config.timeout || 60000;
  }

  /**
   * Execute Python ccw-litellm command
   */
  private async executePython(args: string[], options: { timeout?: number } = {}): Promise<string> {
    const timeout = options.timeout || this.timeout;

    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, ['-m', 'ccw_litellm.cli', ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          return; // Already rejected
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          const errorMsg = stderr.trim() || `Process exited with code ${code}`;
          reject(new Error(errorMsg));
        }
      });
    });
  }

  /**
   * Check if ccw-litellm is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.executePython(['version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get status information
   */
  async getStatus(): Promise<LiteLLMStatus> {
    try {
      const output = await this.executePython(['version'], { timeout: 5000 });
      return {
        available: true,
        version: output.trim()
      };
    } catch (error: any) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<any> {
    const output = await this.executePython(['config', '--json']);
    return JSON.parse(output);
  }

  /**
   * Generate embeddings for texts
   */
  async embed(texts: string[], model: string = 'default'): Promise<EmbedResponse> {
    if (!texts || texts.length === 0) {
      throw new Error('texts array cannot be empty');
    }

    const args = ['embed', '--model', model, '--output', 'json'];

    // Add texts as arguments
    for (const text of texts) {
      args.push(text);
    }

    const output = await this.executePython(args, { timeout: this.timeout * 2 });
    const vectors = JSON.parse(output);

    return {
      vectors,
      dimensions: vectors[0]?.length || 0,
      model
    };
  }

  /**
   * Chat with LLM
   */
  async chat(message: string, model: string = 'default'): Promise<string> {
    if (!message) {
      throw new Error('message cannot be empty');
    }

    const args = ['chat', '--model', model, message];
    return this.executePython(args, { timeout: this.timeout * 2 });
  }

  /**
   * Multi-turn chat with messages array
   */
  async chatMessages(messages: ChatMessage[], model: string = 'default'): Promise<ChatResponse> {
    if (!messages || messages.length === 0) {
      throw new Error('messages array cannot be empty');
    }

    // For now, just use the last user message
    // TODO: Implement full message history support in ccw-litellm
    const lastMessage = messages[messages.length - 1];
    const content = await this.chat(lastMessage.content, model);

    return {
      content,
      model,
      usage: undefined // TODO: Add usage tracking
    };
  }
}

// Singleton instance
let _client: LiteLLMClient | null = null;

/**
 * Get or create singleton LiteLLM client
 */
export function getLiteLLMClient(config?: LiteLLMConfig): LiteLLMClient {
  if (!_client) {
    _client = new LiteLLMClient(config);
  }
  return _client;
}

/**
 * Check if LiteLLM is available
 */
export async function checkLiteLLMAvailable(): Promise<boolean> {
  try {
    const client = getLiteLLMClient();
    return await client.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Get LiteLLM status
 */
export async function getLiteLLMStatus(): Promise<LiteLLMStatus> {
  try {
    const client = getLiteLLMClient();
    return await client.getStatus();
  } catch (error: any) {
    return {
      available: false,
      error: error.message
    };
  }
}
