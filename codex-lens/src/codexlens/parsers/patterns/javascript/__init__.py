"""JavaScript ast-grep patterns for relationship extraction.

These patterns are used by CodexLens' optional ast-grep processors to extract:
- IMPORTS: ES module imports + CommonJS require()
- INHERITS: class extends relationships

Pattern Syntax (ast-grep-py 0.40+):
    $VAR       - Single metavariable (matches one AST node)
    $$$VAR     - Multiple metavariable (matches zero or more nodes)
"""

from __future__ import annotations

from typing import Dict, List


JAVASCRIPT_PATTERNS: Dict[str, str] = {
    # ES module imports
    # import React from "react"
    # import React, { useEffect } from "react"
    # import { useEffect } from "react"
    # import * as fs from "fs"
    "import_from": "import $$$IMPORTS from $MODULE",
    "import_named_only": "import {$$$NAMES} from $MODULE",
    "import_default_named": "import $DEFAULT, {$$$NAMES} from $MODULE",
    # Side-effect import: import "./styles.css"
    "import_side_effect": "import $MODULE",

    # CommonJS require(): const fs = require("fs")
    "require_call": "require($MODULE)",

    # Class inheritance: class Child extends Base {}
    "class_extends": "class $NAME extends $BASE $$$BODY",
}


METAVARS = {
    "module": "MODULE",
    "import_names": "NAMES",
    "import_default": "DEFAULT",
    "class_name": "NAME",
    "class_base": "BASE",
}


RELATIONSHIP_PATTERNS: Dict[str, List[str]] = {
    "imports": [
        "import_from",
        "import_named_only",
        "import_default_named",
        "import_side_effect",
        "require_call",
    ],
    "inheritance": ["class_extends"],
}


def get_pattern(pattern_name: str) -> str:
    if pattern_name not in JAVASCRIPT_PATTERNS:
        raise KeyError(
            f"Unknown JS pattern: {pattern_name}. Available: {list(JAVASCRIPT_PATTERNS.keys())}"
        )
    return JAVASCRIPT_PATTERNS[pattern_name]


def get_patterns_for_relationship(rel_type: str) -> List[str]:
    return RELATIONSHIP_PATTERNS.get(rel_type, [])


def get_metavar(name: str) -> str:
    return METAVARS.get(name, name.upper())


__all__ = [
    "JAVASCRIPT_PATTERNS",
    "METAVARS",
    "RELATIONSHIP_PATTERNS",
    "get_pattern",
    "get_patterns_for_relationship",
    "get_metavar",
]

