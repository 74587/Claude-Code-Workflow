#!/usr/bin/env python3
"""
Setup script for UltraThink Path-Aware Analyzer
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_path = Path(__file__).parent / "README.md"
long_description = readme_path.read_text(encoding='utf-8') if readme_path.exists() else ""

# Read requirements
requirements_path = Path(__file__).parent / "requirements.txt"
requirements = []
if requirements_path.exists():
    with open(requirements_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                requirements.append(line)

setup(
    name="ultrathink-path-analyzer",
    version="1.0.0",
    description="Lightweight path-aware program for intelligent file pattern detection and analysis",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="UltraThink Development Team",
    author_email="dev@ultrathink.ai",
    url="https://github.com/ultrathink/path-analyzer",

    packages=find_packages(),
    py_modules=[
        'analyzer',  # Main entry point
    ],

    install_requires=requirements,

    extras_require={
        'rag': [
            'sentence-transformers>=2.2.0',
            'numpy>=1.21.0'
        ],
        'nlp': [
            'nltk>=3.8',
            'spacy>=3.4.0'
        ],
        'performance': [
            'numba>=0.56.0'
        ],
        'dev': [
            'pytest>=7.0.0',
            'pytest-cov>=4.0.0',
            'black>=22.0.0',
            'flake8>=5.0.0'
        ]
    },

    entry_points={
        'console_scripts': [
            'path-analyzer=cli:main',
            'path-indexer=indexer:main',
            'analyzer=analyzer:main',  # Legacy compatibility
            'module-analyzer=tools.module_analyzer:main',
            'tech-stack=tools.tech_stack:main',
        ],
    },

    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Tools",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Operating System :: OS Independent",
    ],

    python_requires=">=3.8",

    keywords="ai, analysis, path-detection, code-analysis, file-matching, rag, nlp",

    project_urls={
        "Bug Reports": "https://github.com/ultrathink/path-analyzer/issues",
        "Source": "https://github.com/ultrathink/path-analyzer",
        "Documentation": "https://github.com/ultrathink/path-analyzer/docs",
    },
)