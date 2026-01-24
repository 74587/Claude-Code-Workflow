"""Test script to verify embeddings improvements in init and status commands."""

import json
import subprocess
import sys
from pathlib import Path

def run_command(cmd):
    """Run a command and capture output."""
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
    )
    return result.stdout, result.stderr, result.returncode

def test_init_embeddings():
    """Test that init command reports embeddings statistics."""
    print("Testing init command with embeddings reporting...")
    
    # Create a temporary test directory
    test_dir = Path("test_temp_project")
    test_dir.mkdir(exist_ok=True)
    
    # Create a simple Python file
    test_file = test_dir / "test.py"
    test_file.write_text("""
def hello_world():
    print("Hello, World!")

def add_numbers(a, b):
    return a + b
""")
    
    # Run init with JSON output
    cmd = f"codexlens init {test_dir} --json --no-embeddings"
    stdout, stderr, returncode = run_command(cmd)
    
    if returncode != 0:
        print(f"❌ Init command failed: {stderr}")
        return False
    
    try:
        result = json.loads(stdout)
        
        # Check for embeddings field
        if "embeddings" not in result.get("result", {}):
            print("❌ Missing 'embeddings' field in result")
            return False
        
        embeddings = result["result"]["embeddings"]
        
        # Check required fields
        required_fields = ["generated", "error"]
        for field in required_fields:
            if field not in embeddings:
                print(f"❌ Missing required field '{field}' in embeddings")
                return False
        
        # Since we used --no-embeddings, it should show as not generated
        if embeddings["generated"]:
            print("❌ Expected embeddings to not be generated with --no-embeddings")
            return False
        
        print("✅ Init command embeddings reporting works correctly")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse JSON output: {e}")
        print(f"Output: {stdout}")
        return False
    finally:
        # Cleanup
        import shutil
        if test_dir.exists():
            shutil.rmtree(test_dir)

def test_status_embeddings():
    """Test that status command reports embeddings coverage."""
    print("\nTesting status command with embeddings coverage...")
    
    # Run status with JSON output
    cmd = "codexlens status --json"
    stdout, stderr, returncode = run_command(cmd)
    
    if returncode != 0:
        print(f"❌ Status command failed: {stderr}")
        return False
    
    try:
        result = json.loads(stdout)
        
        # Check for features field
        if "features" not in result.get("result", {}):
            print("❌ Missing 'features' field in result")
            return False
        
        features = result["result"]["features"]
        
        # Check that vector_search field exists (may be true or false)
        if "vector_search" not in features:
            print("❌ Missing 'vector_search' field in features")
            return False
        
        # Check if embeddings info is present (optional, depends on whether embeddings exist)
        embeddings = result["result"].get("embeddings")
        if embeddings:
            print(f"  Embeddings coverage: {embeddings.get('coverage_percent', 0):.1f}%")
            print(f"  Files with embeddings: {embeddings.get('files_with_embeddings', 0)}/{embeddings.get('total_files', 0)}")
            print(f"  Total chunks: {embeddings.get('total_chunks', 0)}")
        else:
            print("  No embeddings found (this is OK if none were generated)")
        
        print("✅ Status command embeddings reporting works correctly")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse JSON output: {e}")
        print(f"Output: {stdout}")
        return False

def main():
    """Run all tests."""
    print("=== Testing CodexLens Embeddings Improvements ===\n")
    
    results = []
    
    # Test init command
    results.append(("Init embeddings reporting", test_init_embeddings()))
    
    # Test status command
    results.append(("Status embeddings coverage", test_status_embeddings()))
    
    # Print summary
    print("\n=== Test Summary ===")
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    # Return exit code
    all_passed = all(passed for _, passed in results)
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
