#!/bin/bash
# CCW Loop System - Comprehensive Test Runner

echo "============================================"
echo "🧪 CCW LOOP SYSTEM - COMPREHENSIVE TESTS"
echo "============================================"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📁 Project Root: $PROJECT_ROOT"
echo ""

# Run the comprehensive test
node tests/loop-comprehensive-test.js "$@"

# Exit with the test's exit code
exit $?
