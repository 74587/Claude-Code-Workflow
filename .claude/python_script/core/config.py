#!/usr/bin/env python3
"""
Configuration Management Module
Provides unified configuration management with gitignore integration.
"""

import os
import yaml
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from .gitignore_parser import get_all_gitignore_patterns


class Config:
    """Singleton configuration manager with hierarchical loading."""

    _instance = None
    _initialized = False

    def __new__(cls, config_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
        return cls._instance

    def __init__(self, config_path: Optional[str] = None):
        if self._initialized:
            return

        self.config_path = config_path
        self.config = {}
        self.logger = logging.getLogger(__name__)

        self._load_config()
        self._add_gitignore_patterns()
        self._apply_env_overrides()
        self._validate_config()

        self._initialized = True

    def _load_config(self):
        """Load configuration from file with fallback hierarchy."""
        config_paths = self._get_config_paths()

        for config_file in config_paths:
            if config_file.exists():
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        loaded_config = yaml.safe_load(f)
                        if loaded_config:
                            self.config = self._merge_configs(self.config, loaded_config)
                            self.logger.info(f"Loaded config from {config_file}")
                except Exception as e:
                    self.logger.warning(f"Failed to load config from {config_file}: {e}")

        # Apply default config if no config loaded
        if not self.config:
            self.config = self._get_default_config()
            self.logger.info("Using default configuration")

    def _get_config_paths(self) -> List[Path]:
        """Get ordered list of config file paths to check."""
        paths = []

        # 1. Explicitly provided config path
        if self.config_path:
            paths.append(Path(self.config_path))

        # 2. Current directory config.yaml
        paths.append(Path('config.yaml'))

        # 3. Script directory config.yaml
        script_dir = Path(__file__).parent.parent
        paths.append(script_dir / 'config.yaml')

        # 4. Default config in script directory
        paths.append(script_dir / 'default_config.yaml')

        return paths

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration."""
        return {
            'token_limits': {
                'small_project': 500000,
                'medium_project': 2000000,
                'large_project': 10000000,
                'max_files': 1000
            },
            'exclude_patterns': [
                "*/node_modules/*",
                "*/.git/*",
                "*/build/*",
                "*/dist/*",
                "*/.next/*",
                "*/.nuxt/*",
                "*/target/*",
                "*/vendor/*",
                "*/__pycache__/*",
                "*.pyc",
                "*.pyo",
                "*.log",
                "*.tmp",
                "*.temp",
                "*.history"
            ],
            'file_extensions': {
                'code': ['.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.rs', '.go', '.php', '.rb', '.sh', '.bash'],
                'docs': ['.md', '.txt', '.rst', '.adoc'],
                'config': ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'],
                'web': ['.html', '.css', '.scss', '.sass', '.xml']
            },
            'embedding': {
                'enabled': True,
                'model': 'all-MiniLM-L6-v2',
                'cache_dir': 'cache',
                'similarity_threshold': 0.3,
                'max_context_length': 512,
                'batch_size': 32
            },
            'context_analysis': {
                'domain_keywords': {
                    'auth': ['auth', 'login', 'user', 'password', 'jwt', 'token', 'session'],
                    'database': ['db', 'database', 'sql', 'query', 'model', 'schema', 'migration'],
                    'api': ['api', 'endpoint', 'route', 'controller', 'service', 'handler'],
                    'frontend': ['ui', 'component', 'view', 'template', 'style', 'css'],
                    'backend': ['server', 'service', 'logic', 'business', 'core'],
                    'test': ['test', 'spec', 'unit', 'integration', 'mock'],
                    'config': ['config', 'setting', 'environment', 'env'],
                    'util': ['util', 'helper', 'common', 'shared', 'lib']
                },
                'language_indicators': {
                    'python': ['.py', 'python', 'pip', 'requirements.txt', 'setup.py'],
                    'javascript': ['.js', '.ts', 'npm', 'package.json', 'node'],
                    'java': ['.java', 'maven', 'gradle', 'pom.xml'],
                    'go': ['.go', 'go.mod', 'go.sum'],
                    'rust': ['.rs', 'cargo', 'Cargo.toml']
                }
            },
            'path_matching': {
                'weights': {
                    'keyword_match': 0.4,
                    'extension_match': 0.2,
                    'directory_context': 0.2,
                    'file_size_penalty': 0.1,
                    'recency_bonus': 0.1
                },
                'max_files_per_category': 20,
                'min_relevance_score': 0.1
            },
            'output': {
                'pattern_format': '@{{{path}}}',
                'always_include': [
                    'CLAUDE.md',
                    '**/CLAUDE.md',
                    'README.md',
                    'docs/**/*.md'
                ],
                'max_total_files': 50
            },
            'performance': {
                'cache_enabled': True,
                'cache_ttl': 3600,
                'max_file_size': 10485760,
                'max_workers': 4
            },
            'logging': {
                'level': 'INFO',
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            }
        }

    def _merge_configs(self, base: Dict, override: Dict) -> Dict:
        """Recursively merge configuration dictionaries."""
        result = base.copy()

        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value

        return result

    def _add_gitignore_patterns(self):
        """Add patterns from .gitignore files to exclude_patterns."""
        try:
            # Find root directory (current working directory or script parent)
            root_dir = Path.cwd()

            gitignore_patterns = get_all_gitignore_patterns(str(root_dir))

            if gitignore_patterns:
                # Ensure exclude_patterns exists
                if 'exclude_patterns' not in self.config:
                    self.config['exclude_patterns'] = []

                # Add gitignore patterns, avoiding duplicates
                existing_patterns = set(self.config['exclude_patterns'])
                new_patterns = [p for p in gitignore_patterns if p not in existing_patterns]

                self.config['exclude_patterns'].extend(new_patterns)

                self.logger.info(f"Added {len(new_patterns)} patterns from .gitignore files")

        except Exception as e:
            self.logger.warning(f"Failed to load .gitignore patterns: {e}")

    def _apply_env_overrides(self):
        """Apply environment variable overrides."""
        env_mappings = {
            'ANALYZER_CACHE_DIR': ('embedding', 'cache_dir'),
            'ANALYZER_LOG_LEVEL': ('logging', 'level'),
            'ANALYZER_MAX_FILES': ('token_limits', 'max_files'),
            'ANALYZER_EMBEDDING_MODEL': ('embedding', 'model')
        }

        for env_var, config_path in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value:
                self._set_nested_value(config_path, env_value)
                self.logger.info(f"Applied environment override: {env_var} = {env_value}")

    def _set_nested_value(self, path: tuple, value: str):
        """Set a nested configuration value."""
        current = self.config
        for key in path[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]

        # Try to convert value to appropriate type
        if isinstance(current.get(path[-1]), int):
            try:
                value = int(value)
            except ValueError:
                pass
        elif isinstance(current.get(path[-1]), bool):
            value = value.lower() in ('true', '1', 'yes', 'on')

        current[path[-1]] = value

    def _validate_config(self):
        """Validate configuration values."""
        required_sections = ['exclude_patterns', 'file_extensions', 'token_limits']

        for section in required_sections:
            if section not in self.config:
                self.logger.warning(f"Missing required config section: {section}")

        # Validate token limits
        if 'token_limits' in self.config:
            limits = self.config['token_limits']
            if limits.get('small_project', 0) >= limits.get('medium_project', 0):
                self.logger.warning("Token limit configuration may be incorrect")

    def get(self, path: str, default: Any = None) -> Any:
        """Get configuration value using dot notation."""
        keys = path.split('.')
        current = self.config

        try:
            for key in keys:
                current = current[key]
            return current
        except (KeyError, TypeError):
            return default

    def set(self, path: str, value: Any):
        """Set configuration value using dot notation."""
        keys = path.split('.')
        current = self.config

        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]

        current[keys[-1]] = value

    def get_exclude_patterns(self) -> List[str]:
        """Get all exclude patterns including gitignore patterns."""
        return self.config.get('exclude_patterns', [])

    def get_file_extensions(self) -> Dict[str, List[str]]:
        """Get file extension mappings."""
        return self.config.get('file_extensions', {})

    def is_embedding_enabled(self) -> bool:
        """Check if embedding functionality is enabled."""
        return self.config.get('embedding', {}).get('enabled', False)

    def get_cache_dir(self) -> str:
        """Get cache directory path."""
        return self.config.get('embedding', {}).get('cache_dir', 'cache')

    def to_dict(self) -> Dict[str, Any]:
        """Return configuration as dictionary."""
        return self.config.copy()

    def reload(self, config_path: Optional[str] = None):
        """Reload configuration from file."""
        self._initialized = False
        if config_path:
            self.config_path = config_path
        self.__init__(self.config_path)


# Global configuration instance
_global_config = None


def get_config(config_path: Optional[str] = None) -> Config:
    """Get global configuration instance."""
    global _global_config
    if _global_config is None:
        _global_config = Config(config_path)
    return _global_config


if __name__ == "__main__":
    # Test configuration loading
    config = Config()
    print("Configuration loaded successfully!")
    print(f"Cache dir: {config.get_cache_dir()}")
    print(f"Exclude patterns: {len(config.get_exclude_patterns())}")
    print(f"Embedding enabled: {config.is_embedding_enabled()}")