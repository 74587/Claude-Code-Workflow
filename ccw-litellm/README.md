# ccw-litellm

Unified LiteLLM interface layer shared by ccw and codex-lens projects.

## Features

- **Unified LLM Interface**: Abstract interface for LLM operations (chat, completion)
- **Unified Embedding Interface**: Abstract interface for text embeddings
- **Multi-Provider Support**: OpenAI, Anthropic, Azure, and more via LiteLLM
- **Configuration Management**: YAML-based configuration with environment variable substitution
- **Type Safety**: Full type annotations with Pydantic models

## Installation

```bash
pip install -e .
```

## Quick Start

### Configuration

Create a configuration file at `~/.ccw/config/litellm-config.yaml`:

```yaml
version: 1
default_provider: openai

providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    api_base: https://api.openai.com/v1

llm_models:
  default:
    provider: openai
    model: gpt-4

embedding_models:
  default:
    provider: openai
    model: text-embedding-3-small
    dimensions: 1536
```

### Usage

#### LLM Client

```python
from ccw_litellm import LiteLLMClient, ChatMessage

# Initialize client with default model
client = LiteLLMClient(model="default")

# Chat completion
messages = [
    ChatMessage(role="user", content="Hello, how are you?")
]
response = client.chat(messages)
print(response.content)

# Text completion
response = client.complete("Once upon a time")
print(response.content)
```

#### Embedder

```python
from ccw_litellm import LiteLLMEmbedder

# Initialize embedder with default model
embedder = LiteLLMEmbedder(model="default")

# Embed single text
vector = embedder.embed("Hello world")
print(vector.shape)  # (1, 1536)

# Embed multiple texts
vectors = embedder.embed(["Text 1", "Text 2", "Text 3"])
print(vectors.shape)  # (3, 1536)
```

#### Custom Configuration

```python
from ccw_litellm import LiteLLMClient, load_config

# Load custom configuration
config = load_config("/path/to/custom-config.yaml")

# Use custom configuration
client = LiteLLMClient(model="fast", config=config)
```

## Configuration Reference

### Provider Configuration

```yaml
providers:
  <provider_name>:
    api_key: <api_key_or_${ENV_VAR}>
    api_base: <base_url>
```

Supported providers: `openai`, `anthropic`, `azure`, `vertex_ai`, `bedrock`, etc.

### LLM Model Configuration

```yaml
llm_models:
  <model_name>:
    provider: <provider_name>
    model: <model_identifier>
```

### Embedding Model Configuration

```yaml
embedding_models:
  <model_name>:
    provider: <provider_name>
    model: <model_identifier>
    dimensions: <embedding_dimensions>
```

## Environment Variables

The configuration supports environment variable substitution using the `${VAR}` or `${VAR:-default}` syntax:

```yaml
providers:
  openai:
    api_key: ${OPENAI_API_KEY}              # Required
    api_base: ${OPENAI_API_BASE:-https://api.openai.com/v1}  # With default
```

## API Reference

### Interfaces

- `AbstractLLMClient`: Abstract base class for LLM clients
- `AbstractEmbedder`: Abstract base class for embedders
- `ChatMessage`: Message data class (role, content)
- `LLMResponse`: Response data class (content, raw)

### Implementations

- `LiteLLMClient`: LiteLLM implementation of AbstractLLMClient
- `LiteLLMEmbedder`: LiteLLM implementation of AbstractEmbedder

### Configuration

- `LiteLLMConfig`: Root configuration model
- `ProviderConfig`: Provider configuration model
- `LLMModelConfig`: LLM model configuration model
- `EmbeddingModelConfig`: Embedding model configuration model
- `load_config(path)`: Load configuration from YAML file
- `get_config(path, reload)`: Get global configuration singleton
- `reset_config()`: Reset global configuration (for testing)

## Development

### Running Tests

```bash
pytest tests/ -v
```

### Type Checking

```bash
mypy src/ccw_litellm
```

## License

MIT
