#!/usr/bin/env python3
"""Directly show LLM analysis of test code."""

from codexlens.semantic.llm_enhancer import LLMEnhancer, LLMConfig, FileData

# Misleading code example
TEST_CODE = '''"""Email sending service."""
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

class EmailSender:
    """SMTP email sender with retry logic."""

    def __init__(self, min_conn: int = 1, max_conn: int = 10):
        """Initialize email sender."""
        self.pool = psycopg2.pool.SimpleConnectionPool(
            min_conn, max_conn,
            user='dbuser', host='localhost', database='myapp'
        )

    @contextmanager
    def send_email(self):
        """Send email message."""
        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        finally:
            self.pool.putconn(conn)
'''

print("="*80)
print("LLM ANALYSIS OF MISLEADING CODE")
print("="*80)

print("\n[Original Code with Misleading Comments]")
print("-"*80)
print(TEST_CODE)
print("-"*80)

print("\n[Actual Functionality]")
print("  - Imports: psycopg2 (PostgreSQL library)")
print("  - Class: EmailSender (but name is misleading!)")
print("  - Actually: Creates PostgreSQL connection pool")
print("  - Methods: send_email (actually gets DB connection)")

print("\n[Misleading Documentation]")
print("  - Module docstring: 'Email sending service' (WRONG)")
print("  - Class docstring: 'SMTP email sender' (WRONG)")
print("  - Method docstring: 'Send email message' (WRONG)")

print("\n" + "="*80)
print("TESTING LLM UNDERSTANDING")
print("="*80)

# Test LLM analysis
config = LLMConfig(enabled=True, tool="gemini", batch_size=1)
enhancer = LLMEnhancer(config)

if not enhancer.check_available():
    print("\n[X] CCW CLI not available")
    print("Install: npm install -g ccw")
    exit(1)

print("\n[Calling Gemini to analyze code...]")
file_data = FileData(path="db/pool.py", content=TEST_CODE, language="python")

import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as tmpdir:
    result = enhancer.enhance_files([file_data], Path(tmpdir))

    if "db/pool.py" in result:
        metadata = result["db/pool.py"]

        print("\n[LLM-Generated Summary]")
        print("-"*80)
        print(f"Summary: {metadata.summary}")
        print(f"\nPurpose: {metadata.purpose}")
        print(f"\nKeywords: {', '.join(metadata.keywords)}")
        print("-"*80)

        print("\n[Analysis]")
        # Check if LLM identified the real functionality
        summary_lower = metadata.summary.lower()
        keywords_lower = [k.lower() for k in metadata.keywords]

        correct_terms = ['database', 'postgresql', 'connection', 'pool', 'psycopg']
        misleading_terms = ['email', 'smtp', 'send']

        found_correct = sum(1 for term in correct_terms
                           if term in summary_lower or any(term in k for k in keywords_lower))
        found_misleading = sum(1 for term in misleading_terms
                              if term in summary_lower or any(term in k for k in keywords_lower))

        print(f"Correct terms found: {found_correct}/{len(correct_terms)}")
        print(f"Misleading terms found: {found_misleading}/{len(misleading_terms)}")

        if found_correct > found_misleading:
            print("\n[OK] LLM correctly identified actual functionality!")
            print("     LLM ignored misleading comments and analyzed code behavior")
        elif found_misleading > found_correct:
            print("\n[X] LLM was misled by incorrect comments")
            print("    LLM trusted documentation over code analysis")
        else:
            print("\n[~] Mixed results - LLM found both correct and misleading terms")
    else:
        print("\n[X] LLM analysis failed - no results returned")

print("\n" + "="*80)
