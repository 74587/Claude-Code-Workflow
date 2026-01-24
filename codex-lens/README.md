# CodexLens

CodexLens is a multi-modal code analysis platform designed to provide comprehensive code understanding and analysis capabilities.

## Features

- **Multi-language Support**: Analyze code in Python, JavaScript, TypeScript and more using Tree-sitter parsers
- **Semantic Search**: Find relevant code snippets using semantic understanding with fastembed and HNSWLIB
- **Code Parsing**: Advanced code structure parsing with tree-sitter
- **Flexible Architecture**: Modular design for easy extension and customization

## Installation

### Basic Installation

```bash
pip install codex-lens
```

### With Semantic Search

```bash
pip install codex-lens[semantic]
```

### With GPU Acceleration (NVIDIA CUDA)

```bash
pip install codex-lens[semantic-gpu]
```

### With DirectML (Windows - NVIDIA/AMD/Intel)

```bash
pip install codex-lens[semantic-directml]
```

### With All Optional Features

```bash
pip install codex-lens[full]
```

## Requirements

- Python >= 3.10
- See `pyproject.toml` for detailed dependency list

## Development

This project uses setuptools for building and packaging.

## License

MIT License

## Authors

CodexLens Contributors
