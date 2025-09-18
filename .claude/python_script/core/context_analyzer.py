#!/usr/bin/env python3
"""
Context Analyzer Module for UltraThink Path-Aware Analyzer
Analyzes user prompts to extract relevant context and keywords.
"""

import re
import logging
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from collections import Counter
import string

@dataclass
class AnalysisResult:
    """Results of context analysis."""
    keywords: List[str]
    domains: List[str]
    languages: List[str]
    file_patterns: List[str]
    confidence_scores: Dict[str, float]
    extracted_entities: Dict[str, List[str]]

class ContextAnalyzer:
    """Analyzes user prompts to understand context and intent."""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Load domain and language mappings from config
        self.domain_keywords = config.get('context_analysis', {}).get('domain_keywords', {})
        self.language_indicators = config.get('context_analysis', {}).get('language_indicators', {})

        # Common programming terms and patterns
        self.technical_terms = self._build_technical_terms()
        self.file_pattern_indicators = self._build_pattern_indicators()

        # Stop words to filter out
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'among', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
            'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
        }

    def _build_technical_terms(self) -> Dict[str, List[str]]:
        """Build comprehensive list of technical terms grouped by category."""
        return {
            'authentication': [
                'auth', 'authentication', 'login', 'logout', 'signin', 'signout',
                'user', 'password', 'token', 'jwt', 'oauth', 'session', 'cookie',
                'credential', 'authorize', 'permission', 'role', 'access'
            ],
            'database': [
                'database', 'db', 'sql', 'query', 'table', 'schema', 'migration',
                'model', 'orm', 'entity', 'relation', 'index', 'transaction',
                'crud', 'select', 'insert', 'update', 'delete', 'join'
            ],
            'api': [
                'api', 'rest', 'graphql', 'endpoint', 'route', 'controller',
                'handler', 'middleware', 'service', 'request', 'response',
                'http', 'get', 'post', 'put', 'delete', 'patch'
            ],
            'frontend': [
                'ui', 'component', 'view', 'template', 'page', 'layout',
                'style', 'css', 'html', 'javascript', 'react', 'vue',
                'angular', 'dom', 'event', 'state', 'props'
            ],
            'backend': [
                'server', 'service', 'business', 'logic', 'core', 'engine',
                'worker', 'job', 'queue', 'cache', 'redis', 'memcache'
            ],
            'testing': [
                'test', 'testing', 'spec', 'unit', 'integration', 'e2e',
                'mock', 'stub', 'fixture', 'assert', 'expect', 'should'
            ],
            'configuration': [
                'config', 'configuration', 'setting', 'environment', 'env',
                'variable', 'constant', 'parameter', 'option'
            ],
            'utility': [
                'util', 'utility', 'helper', 'common', 'shared', 'lib',
                'library', 'tool', 'function', 'method'
            ]
        }

    def _build_pattern_indicators(self) -> Dict[str, List[str]]:
        """Build indicators that suggest specific file patterns."""
        return {
            'source_code': ['implement', 'code', 'function', 'class', 'method'],
            'tests': ['test', 'testing', 'spec', 'unittest', 'pytest'],
            'documentation': ['doc', 'readme', 'guide', 'documentation', 'manual'],
            'configuration': ['config', 'setting', 'env', 'environment'],
            'build': ['build', 'compile', 'package', 'deploy', 'release'],
            'scripts': ['script', 'automation', 'tool', 'utility']
        }

    def extract_keywords(self, text: str) -> List[str]:
        """Extract meaningful keywords from text."""
        # Clean and normalize text
        text = text.lower()
        text = re.sub(r'[^\w\s-]', ' ', text)  # Remove punctuation except hyphens
        words = text.split()

        # Filter stop words and short words
        keywords = []
        for word in words:
            word = word.strip('-')  # Remove leading/trailing hyphens
            if (len(word) >= 2 and
                word not in self.stop_words and
                not word.isdigit()):
                keywords.append(word)

        # Count frequency and return top keywords
        word_counts = Counter(keywords)
        return [word for word, count in word_counts.most_common(20)]

    def identify_domains(self, keywords: List[str]) -> List[Tuple[str, float]]:
        """Identify relevant domains based on keywords."""
        domain_scores = {}

        for domain, domain_keywords in self.domain_keywords.items():
            score = 0.0
            matched_keywords = []

            for keyword in keywords:
                for domain_keyword in domain_keywords:
                    if keyword in domain_keyword or domain_keyword in keyword:
                        score += 1.0
                        matched_keywords.append(keyword)
                        break

            if score > 0:
                # Normalize score by number of domain keywords
                normalized_score = score / len(domain_keywords)
                domain_scores[domain] = normalized_score

        # Also check technical terms
        for category, terms in self.technical_terms.items():
            score = 0.0
            for keyword in keywords:
                for term in terms:
                    if keyword in term or term in keyword:
                        score += 1.0
                        break

            if score > 0:
                normalized_score = score / len(terms)
                if category not in domain_scores:
                    domain_scores[category] = normalized_score
                else:
                    domain_scores[category] = max(domain_scores[category], normalized_score)

        # Sort by score and return top domains
        sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_domains[:5]

    def identify_languages(self, keywords: List[str]) -> List[Tuple[str, float]]:
        """Identify programming languages based on keywords."""
        language_scores = {}

        for language, indicators in self.language_indicators.items():
            score = 0.0
            for keyword in keywords:
                for indicator in indicators:
                    if keyword in indicator or indicator in keyword:
                        score += 1.0
                        break

            if score > 0:
                normalized_score = score / len(indicators)
                language_scores[language] = normalized_score

        sorted_languages = sorted(language_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_languages[:3]

    def extract_file_patterns(self, text: str) -> List[str]:
        """Extract explicit file patterns from text."""
        patterns = []

        # Look for @{pattern} syntax
        at_patterns = re.findall(r'@\{([^}]+)\}', text)
        patterns.extend(at_patterns)

        # Look for file extensions
        extensions = re.findall(r'\*\.(\w+)', text)
        for ext in extensions:
            patterns.append(f"*.{ext}")

        # Look for directory patterns
        dir_patterns = re.findall(r'(\w+)/\*\*?', text)
        for dir_pattern in dir_patterns:
            patterns.append(f"{dir_pattern}/**/*")

        # Look for specific file names
        file_patterns = re.findall(r'\b(\w+\.\w+)\b', text)
        for file_pattern in file_patterns:
            if '.' in file_pattern:
                patterns.append(file_pattern)

        return list(set(patterns))  # Remove duplicates

    def suggest_patterns_from_domains(self, domains: List[str]) -> List[str]:
        """Suggest file patterns based on identified domains."""
        patterns = []

        domain_to_patterns = {
            'auth': ['**/auth/**/*', '**/login/**/*', '**/user/**/*'],
            'authentication': ['**/auth/**/*', '**/login/**/*', '**/user/**/*'],
            'database': ['**/db/**/*', '**/model/**/*', '**/migration/**/*', '**/*model*'],
            'api': ['**/api/**/*', '**/route/**/*', '**/controller/**/*', '**/handler/**/*'],
            'frontend': ['**/ui/**/*', '**/component/**/*', '**/view/**/*', '**/template/**/*'],
            'backend': ['**/service/**/*', '**/core/**/*', '**/server/**/*'],
            'test': ['**/test/**/*', '**/spec/**/*', '**/*test*', '**/*spec*'],
            'testing': ['**/test/**/*', '**/spec/**/*', '**/*test*', '**/*spec*'],
            'config': ['**/config/**/*', '**/*.config.*', '**/env/**/*'],
            'configuration': ['**/config/**/*', '**/*.config.*', '**/env/**/*'],
            'util': ['**/util/**/*', '**/helper/**/*', '**/common/**/*'],
            'utility': ['**/util/**/*', '**/helper/**/*', '**/common/**/*']
        }

        for domain in domains:
            if domain in domain_to_patterns:
                patterns.extend(domain_to_patterns[domain])

        return list(set(patterns))  # Remove duplicates

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract named entities from text."""
        entities = {
            'files': [],
            'functions': [],
            'classes': [],
            'variables': [],
            'technologies': []
        }

        # File patterns
        file_patterns = re.findall(r'\b(\w+\.\w+)\b', text)
        entities['files'] = list(set(file_patterns))

        # Function patterns (camelCase or snake_case followed by parentheses)
        function_patterns = re.findall(r'\b([a-z][a-zA-Z0-9_]*)\s*\(', text)
        entities['functions'] = list(set(function_patterns))

        # Class patterns (PascalCase)
        class_patterns = re.findall(r'\b([A-Z][a-zA-Z0-9]*)\b', text)
        entities['classes'] = list(set(class_patterns))

        # Technology mentions
        tech_keywords = [
            'react', 'vue', 'angular', 'node', 'express', 'django', 'flask',
            'spring', 'rails', 'laravel', 'docker', 'kubernetes', 'aws',
            'azure', 'gcp', 'postgresql', 'mysql', 'mongodb', 'redis'
        ]
        text_lower = text.lower()
        for tech in tech_keywords:
            if tech in text_lower:
                entities['technologies'].append(tech)

        return entities

    def analyze(self, prompt: str) -> AnalysisResult:
        """Perform comprehensive analysis of the user prompt."""
        self.logger.debug(f"Analyzing prompt: {prompt[:100]}...")

        # Extract keywords
        keywords = self.extract_keywords(prompt)

        # Identify domains and languages
        domains_with_scores = self.identify_domains(keywords)
        languages_with_scores = self.identify_languages(keywords)

        # Extract patterns and entities
        explicit_patterns = self.extract_file_patterns(prompt)
        entities = self.extract_entities(prompt)

        # Get top domains and languages
        domains = [domain for domain, score in domains_with_scores]
        languages = [lang for lang, score in languages_with_scores]

        # Suggest additional patterns based on domains
        suggested_patterns = self.suggest_patterns_from_domains(domains)

        # Combine explicit and suggested patterns
        all_patterns = list(set(explicit_patterns + suggested_patterns))

        # Build confidence scores
        confidence_scores = {
            'keywords': len(keywords) / 20,  # Normalize to 0-1
            'domain_match': max([score for _, score in domains_with_scores[:1]], default=0),
            'language_match': max([score for _, score in languages_with_scores[:1]], default=0),
            'pattern_extraction': len(explicit_patterns) / 5,  # Normalize to 0-1
        }

        result = AnalysisResult(
            keywords=keywords,
            domains=domains,
            languages=languages,
            file_patterns=all_patterns,
            confidence_scores=confidence_scores,
            extracted_entities=entities
        )

        self.logger.info(f"Analysis complete: {len(domains)} domains, {len(languages)} languages, {len(all_patterns)} patterns")
        return result

def main():
    """Command-line interface for context analyzer."""
    import yaml
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Context Analyzer for UltraThink")
    parser.add_argument("prompt", help="Prompt to analyze")
    parser.add_argument("--config", default="config.yaml", help="Configuration file path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Setup logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format='%(levelname)s: %(message)s')

    # Load configuration
    from pathlib import Path
    config_path = Path(__file__).parent / args.config
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # Create analyzer
    analyzer = ContextAnalyzer(config)

    # Analyze prompt
    result = analyzer.analyze(args.prompt)

    # Output results
    print(f"Keywords: {', '.join(result.keywords[:10])}")
    print(f"Domains: {', '.join(result.domains[:5])}")
    print(f"Languages: {', '.join(result.languages[:3])}")
    print(f"Patterns: {', '.join(result.file_patterns[:10])}")

    if args.verbose:
        print("\nDetailed Results:")
        print(json.dumps({
            'keywords': result.keywords,
            'domains': result.domains,
            'languages': result.languages,
            'file_patterns': result.file_patterns,
            'confidence_scores': result.confidence_scores,
            'extracted_entities': result.extracted_entities
        }, indent=2))

if __name__ == "__main__":
    main()