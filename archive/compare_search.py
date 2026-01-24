#!/usr/bin/env python
"""Compare search results: Hybrid vs Cascade with Reranker."""
import subprocess
import sys
import os
import re
import json

os.chdir(r"D:\dongdiankaifa9\hydro_generator_module")
query = "热网络计算"

ansi_escape = re.compile(r'\x1b\[[0-9;]*m')

def run_search(method: str) -> dict:
    """Run search and return parsed result dict."""
    cmd = [sys.executable, "-m", "codexlens", "search", query,
           "--method", method, "--limit", "10", "--json"]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    # Strip ANSI codes
    output = ansi_escape.sub('', result.stdout + result.stderr)

    # Find and parse JSON (properly handle nested structures)
    start = output.find('{')
    if start < 0:
        return {"success": False, "error": "No JSON found"}

    # Count braces properly, handling strings
    in_string = False
    escaped = False
    depth = 0
    end_idx = start

    for i, c in enumerate(output[start:]):
        if escaped:
            escaped = False
            continue
        if c == '\\':
            escaped = True
            continue
        if c == '"' and not escaped:
            in_string = not in_string
            continue
        if not in_string:
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end_idx = start + i + 1
                    break

    try:
        return json.loads(output[start:end_idx])
    except Exception as e:
        return {"success": False, "error": str(e)}

print("=" * 75)
print(f"搜索对比: Hybrid vs Cascade")
print(f"查询: {query}")
print("=" * 75)

# Hybrid search (no cross-encoder reranking)
print("\n[1] Hybrid 搜索 (无 Cross-Encoder Reranker):")
print("-" * 75)
hybrid_result = run_search("hybrid")
hybrid_files = []
if hybrid_result.get("success"):
    results = hybrid_result.get("result", {}).get("results", [])[:10]
    for i, r in enumerate(results, 1):
        name = os.path.basename(r.get("path", ""))
        score = r.get("score", 0)
        hybrid_files.append(name)
        print(f"{i:2}. {name:<45} score={score:.4f}")
else:
    print("搜索失败:", hybrid_result.get("error"))

# Cascade search (with cross-encoder reranking when strategy=hybrid)
print("\n[2] Cascade 搜索 (使用 Cross-Encoder Reranker):")
print("-" * 75)
cascade_result = run_search("cascade")
cascade_files = []
if cascade_result.get("success"):
    results = cascade_result.get("result", {}).get("results", [])[:10]
    for i, r in enumerate(results, 1):
        name = os.path.basename(r.get("path", ""))
        score = r.get("score", 0)
        cascade_files.append(name)
        print(f"{i:2}. {name:<45} score={score:.4f}")
else:
    print("搜索失败:", cascade_result.get("error"))

# Compare ranking changes
print("\n[3] 排名变化分析:")
print("-" * 75)
changes = []
for i, name in enumerate(cascade_files):
    if name in hybrid_files:
        old_pos = hybrid_files.index(name) + 1
        new_pos = i + 1
        if old_pos != new_pos:
            direction = "↑" if new_pos < old_pos else "↓"
            changes.append(f"  {name}: #{old_pos} → #{new_pos} {direction}")
    else:
        changes.append(f"  {name}: NEW (不在 Hybrid 前10)")

if changes:
    print("Reranker 排序变化:")
    for c in changes:
        print(c)
else:
    print("排序相同 (无变化)")

print("\n" + "=" * 75)
print("配置说明:")
print("- Hybrid: FTS + Vector 融合 (无二次精排)")
print("- Cascade: 粗筛 + Cross-Encoder Reranker 精排")
print("- Reranker: Qwen/Qwen3-Reranker-8B via SiliconFlow API")
print("=" * 75)
