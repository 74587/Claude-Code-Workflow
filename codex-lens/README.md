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

### Local ONNX Reranker Bootstrap

Use the pinned bootstrap flow when you want the local-only reranker backend in an
existing CodexLens virtual environment without asking pip to resolve the whole
project extras set at once.

1. Start from the CodexLens repo root and create or activate the project venv.
2. Review the pinned install manifest in `scripts/requirements-reranker-local.txt`.
3. Render the deterministic setup plan:

```bash
python scripts/bootstrap_reranker_local.py --dry-run
```

The bootstrap script always targets the selected venv Python, installs the local
ONNX reranker stack in a fixed order, and keeps the package set pinned to the
validated Python 3.13-compatible combination:

- `numpy==2.4.0`
- `onnxruntime==1.23.2`
- `huggingface-hub==0.36.2`
- `transformers==4.53.3`
- `optimum[onnxruntime]==2.1.0`

When you are ready to apply it to the CodexLens venv, use:

```bash
python scripts/bootstrap_reranker_local.py --apply
```

To pre-download the default local reranker model (`Xenova/ms-marco-MiniLM-L-6-v2`)
into the repo-local Hugging Face cache, use:

```bash
python scripts/bootstrap_reranker_local.py --apply --download-model
```

The dry-run plan also prints the equivalent explicit model download command. On
Windows PowerShell with the default repo venv, it looks like:

```bash
.venv/Scripts/hf.exe download Xenova/ms-marco-MiniLM-L-6-v2 --local-dir .cache/huggingface/models/Xenova--ms-marco-MiniLM-L-6-v2
```

After installation, probe the backend from the same venv:

```bash
python scripts/bootstrap_reranker_local.py --apply --probe
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
