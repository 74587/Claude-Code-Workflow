#!/usr/bin/env python
"""Compare search results with and without reranker."""
import json
import subprocess
import sys
import os

os.chdir(r"D:\dongdiankaifa9\hydro_generator_module")

query = "热网络计算"

def run_search(method: str) -> dict:
    """Run search and return parsed JSON result."""
    cmd = [sys.executable, "-m", "codexlens", "search", query, "--method", method, "--limit", "10", "--json"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    # Find JSON in output (skip debug lines)
    for line in result.stdout.split("\n"):
        if line.strip().startswith("{"):
            try:
                return json.loads(line)
            except:
                pass
    # Try to find JSON object in stderr
    output = result.stdout + result.stderr
    start = output.find('{"success"')
    if start >= 0:
        # Find matching closing brace
        depth = 0
        for i, c in enumerate(output[start:]):
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(output[start:start+i+1])
                    except:
                        pass
                    break
    return {"success": False, "error": "Failed to parse JSON"}

print("=" * 60)
print("搜索对比: 有无 Reranker 效果")
print("查询:", query)
print("=" * 60)

# Run hybrid search (no reranker)
print("\n[1] Hybrid 搜索 (无 Reranker)")
print("-" * 40)
hybrid_result = run_search("hybrid")
if hybrid_result.get("success"):
    results = hybrid_result.get("result", {}).get("results", [])[:10]
    for i, r in enumerate(results, 1):
        path = r.get("path", "").split("\\")[-1]
        score = r.get("score", 0)
        print(f"{i:2}. {path[:45]:<45} score={score:.4f}")
else:
    print("搜索失败:", hybrid_result.get("error"))

# Run cascade search (with reranker)
print("\n[2] Cascade 搜索 (使用 Reranker)")
print("-" * 40)
cascade_result = run_search("cascade")
if cascade_result.get("success"):
    results = cascade_result.get("result", {}).get("results", [])[:10]
    for i, r in enumerate(results, 1):
        path = r.get("path", "").split("\\")[-1]
        score = r.get("score", 0)
        print(f"{i:2}. {path[:45]:<45} score={score:.4f}")
else:
    print("搜索失败:", cascade_result.get("error"))

print("\n" + "=" * 60)
print("对比说明:")
print("- Hybrid: FTS + Vector 融合，无二次重排序")
print("- Cascade: Vector 粗筛 + Reranker API 精排")
print("=" * 60)
