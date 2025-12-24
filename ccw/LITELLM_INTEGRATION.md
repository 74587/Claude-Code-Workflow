# LiteLLM Integration Guide

## Overview

CCW now supports custom LiteLLM endpoints with integrated context caching. You can configure multiple providers (OpenAI, Anthropic, Ollama, etc.) and create custom endpoints with file-based caching strategies.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Executor                           │
│                                                             │
│  ┌─────────────┐         ┌──────────────────────────────┐  │
│  │   --model   │────────>│  Route Decision:             │  │
│  │   flag      │         │  - gemini/qwen/codex → CLI   │  │
│  └─────────────┘         │  - custom ID → LiteLLM       │  │
│                          └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  LiteLLM Executor                           │
│                                                             │
│  1. Load endpoint config (litellm-api-config.json)         │
│  2. Extract @patterns from prompt                          │
│  3. Pack files via context-cache                           │
│  4. Call LiteLLM client with cached content + prompt       │
│  5. Return result                                          │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### File Location

Configuration is stored per-project:
```
<project>/.ccw/storage/config/litellm-api-config.json
```

### Configuration Structure

```json
{
  "version": 1,
  "providers": [
    {
      "id": "openai-1234567890",
      "name": "My OpenAI",
      "type": "openai",
      "apiKey": "${OPENAI_API_KEY}",
      "enabled": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "endpoints": [
    {
      "id": "my-gpt4o",
      "name": "GPT-4o with Context Cache",
      "providerId": "openai-1234567890",
      "model": "gpt-4o",
      "description": "GPT-4o with automatic file caching",
      "cacheStrategy": {
        "enabled": true,
        "ttlMinutes": 60,
        "maxSizeKB": 512,
        "filePatterns": ["*.md", "*.ts", "*.js"]
      },
      "enabled": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "defaultEndpoint": "my-gpt4o",
  "globalCacheSettings": {
    "enabled": true,
    "cacheDir": "~/.ccw/cache/context",
    "maxTotalSizeMB": 100
  }
}
```

## Usage

### Via CLI

```bash
# Use custom endpoint with --model flag
ccw cli -p "Analyze authentication flow" --tool litellm --model my-gpt4o

# With context patterns (automatically cached)
ccw cli -p "@src/auth/**/*.ts Review security" --tool litellm --model my-gpt4o

# Disable caching for specific call
ccw cli -p "Quick question" --tool litellm --model my-gpt4o --no-cache
```

### Via Dashboard API

#### Create Provider
```bash
curl -X POST http://localhost:3000/api/litellm-api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My OpenAI",
    "type": "openai",
    "apiKey": "${OPENAI_API_KEY}",
    "enabled": true
  }'
```

#### Create Endpoint
```bash
curl -X POST http://localhost:3000/api/litellm-api/endpoints \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-gpt4o",
    "name": "GPT-4o with Cache",
    "providerId": "openai-1234567890",
    "model": "gpt-4o",
    "cacheStrategy": {
      "enabled": true,
      "ttlMinutes": 60,
      "maxSizeKB": 512,
      "filePatterns": ["*.md", "*.ts"]
    },
    "enabled": true
  }'
```

#### Test Provider Connection
```bash
curl -X POST http://localhost:3000/api/litellm-api/providers/openai-1234567890/test
```

## Context Caching

### How It Works

1. **Pattern Detection**: LiteLLM executor scans prompt for `@patterns`
   ```
   @src/**/*.ts
   @CLAUDE.md
   @../shared/**/*
   ```

2. **File Packing**: Files matching patterns are packed via `context-cache` tool
   - Respects `max_file_size` limit (default: 1MB per file)
   - Applies TTL from endpoint config
   - Generates session ID for retrieval

3. **Cache Integration**: Cached content is prepended to prompt
   ```
   <cached files>
   ---
   <original prompt>
   ```

4. **LLM Call**: Combined prompt sent to LiteLLM with provider credentials

### Cache Strategy Configuration

```typescript
interface CacheStrategy {
  enabled: boolean;           // Enable/disable caching for this endpoint
  ttlMinutes: number;         // Cache lifetime (default: 60)
  maxSizeKB: number;          // Max cache size (default: 512KB)
  filePatterns: string[];     // Glob patterns to cache
}
```

### Example: Security Audit with Cache

```bash
ccw cli -p "
PURPOSE: OWASP Top 10 security audit of authentication module
TASK: • Check SQL injection • Verify session management • Test XSS vectors
CONTEXT: @src/auth/**/*.ts @src/middleware/auth.ts
EXPECTED: Security report with severity levels and remediation steps
" --tool litellm --model my-security-scanner --mode analysis
```

**What happens:**
1. Executor detects `@src/auth/**/*.ts` and `@src/middleware/auth.ts`
2. Packs matching files into context cache
3. Cache entry valid for 60 minutes (per endpoint config)
4. Subsequent calls reuse cached files (no re-packing)
5. LiteLLM receives full context without manual file specification

## Environment Variables

### Provider API Keys

LiteLLM uses standard environment variable names:

| Provider   | Env Var Name          |
|------------|-----------------------|
| OpenAI     | `OPENAI_API_KEY`      |
| Anthropic  | `ANTHROPIC_API_KEY`   |
| Google     | `GOOGLE_API_KEY`      |
| Azure      | `AZURE_API_KEY`       |
| Mistral    | `MISTRAL_API_KEY`     |
| DeepSeek   | `DEEPSEEK_API_KEY`    |

### Configuration Syntax

Use `${ENV_VAR}` syntax in config:
```json
{
  "apiKey": "${OPENAI_API_KEY}"
}
```

The executor resolves these at runtime via `resolveEnvVar()`.

## API Reference

### Config Manager (`litellm-api-config-manager.ts`)

#### Provider Management
```typescript
getAllProviders(baseDir: string): ProviderCredential[]
getProvider(baseDir: string, providerId: string): ProviderCredential | null
getProviderWithResolvedEnvVars(baseDir: string, providerId: string): ProviderCredential & { resolvedApiKey: string } | null
addProvider(baseDir: string, providerData): ProviderCredential
updateProvider(baseDir: string, providerId: string, updates): ProviderCredential
deleteProvider(baseDir: string, providerId: string): boolean
```

#### Endpoint Management
```typescript
getAllEndpoints(baseDir: string): CustomEndpoint[]
getEndpoint(baseDir: string, endpointId: string): CustomEndpoint | null
findEndpointById(baseDir: string, endpointId: string): CustomEndpoint | null
addEndpoint(baseDir: string, endpointData): CustomEndpoint
updateEndpoint(baseDir: string, endpointId: string, updates): CustomEndpoint
deleteEndpoint(baseDir: string, endpointId: string): boolean
```

### Executor (`litellm-executor.ts`)

```typescript
interface LiteLLMExecutionOptions {
  prompt: string;
  endpointId: string;
  baseDir: string;
  cwd?: string;
  includeDirs?: string[];
  enableCache?: boolean;
  onOutput?: (data: { type: string; data: string }) => void;
}

interface LiteLLMExecutionResult {
  success: boolean;
  output: string;
  model: string;
  provider: string;
  cacheUsed: boolean;
  cachedFiles?: string[];
  error?: string;
}

executeLiteLLMEndpoint(options: LiteLLMExecutionOptions): Promise<LiteLLMExecutionResult>
extractPatterns(prompt: string): string[]
```

## Dashboard Integration

The dashboard provides UI for managing LiteLLM configuration:

- **Providers**: Add/edit/delete provider credentials
- **Endpoints**: Configure custom endpoints with cache strategies
- **Cache Stats**: View cache usage and clear entries
- **Test Connections**: Verify provider API access

Routes are handled by `litellm-api-routes.ts`.

## Limitations

1. **Python Dependency**: Requires `ccw-litellm` Python package installed
2. **Model Support**: Limited to models supported by LiteLLM library
3. **Cache Scope**: Context cache is in-memory (not persisted across restarts)
4. **Pattern Syntax**: Only supports glob-style `@patterns`, not regex

## Troubleshooting

### Error: "Endpoint not found"
- Verify endpoint ID matches config file
- Check `litellm-api-config.json` exists in `.ccw/storage/config/`

### Error: "API key not configured"
- Ensure environment variable is set
- Verify `${ENV_VAR}` syntax in config
- Test with `echo $OPENAI_API_KEY`

### Error: "Failed to spawn Python process"
- Install ccw-litellm: `pip install ccw-litellm`
- Verify Python accessible: `python --version`

### Cache Not Applied
- Check endpoint has `cacheStrategy.enabled: true`
- Verify prompt contains `@patterns`
- Check cache TTL hasn't expired

## Examples

See `examples/litellm-config.json` for complete configuration template.
