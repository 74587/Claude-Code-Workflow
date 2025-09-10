# Module: Analysis Prompts

## Overview

This module provides a collection of standardized prompt templates for conducting detailed analysis of software projects. Each template is designed to guide the language model in focusing on a specific area of concern, ensuring comprehensive and structured feedback.

## Component Documentation

The `analysis` module contains the following prompt templates:

-   **`architecture.txt`**: Guides the analysis of high-level system architecture, design patterns, module dependencies, and scalability.
-   **`pattern.txt`**: Focuses on identifying and evaluating implementation patterns, code structure, and adherence to conventions.
-   **`performance.txt`**: Directs the analysis towards performance bottlenecks, algorithm efficiency, and optimization opportunities.
-   **`quality.txt`**: Used for assessing code quality, maintainability, error handling, and test coverage.
-   **`security.txt`**: Concentrates on identifying security vulnerabilities, including issues with authentication, authorization, input validation, and data encryption.

## Usage Patterns

To use a template, its content should be prepended to a user's request for analysis. This primes the model with specific instructions and output requirements for the desired analysis type.

### Example: Requesting a Security Analysis

```
[Content of security.txt]

---

Analyze the following codebase for security vulnerabilities:
[Code or project context]
```

## Configuration

The prompt templates are plain text files and can be customized to adjust the focus or output requirements of the analysis. No special configuration is required to use them.
