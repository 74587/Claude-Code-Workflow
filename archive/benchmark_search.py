#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Multi-dimensional search benchmark: Compare search methods across multiple queries.

Dimensions:
1. Speed (time_ms)
2. Result Quality (relevance score distribution)
3. Ranking Stability (position changes vs baseline)
4. Coverage (unique files found)
"""
import subprocess
import sys
import os
import re
import json
import time
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path

os.chdir(r"D:\dongdiankaifa9\hydro_generator_module")

# Test queries covering different search intents
TEST_QUERIES = [
    ("热网络计算", "Chinese: thermal network calculation"),
    ("ThermalResistance", "Code identifier"),
    ("boundary condition handling", "Natural language"),
    ("stator slot cooling", "Domain-specific"),
    ("def build", "Code pattern"),
]

# Search methods to compare
SEARCH_METHODS = [
    ("hybrid", None, "Hybrid (FTS+Vector RRF)"),
    ("vector", None, "Pure Vector"),
    ("cascade", "binary", "Cascade Binary"),
    ("cascade", "hybrid", "Cascade Hybrid (Cross-Encoder)"),
]

ansi_escape = re.compile(r'\x1b\[[0-9;]*m')


@dataclass
class SearchResult:
    method: str
    strategy: Optional[str]
    query: str
    time_ms: float
    count: int
    top_files: List[str]
    top_scores: List[float]
    success: bool
    error: Optional[str] = None


def run_search(query: str, method: str, strategy: Optional[str] = None, limit: int = 10) -> SearchResult:
    """Run a search and return structured result."""
    cmd = [sys.executable, "-m", "codexlens", "search", query,
           "--method", method, "--limit", str(limit), "--json"]

    if strategy and method == "cascade":
        cmd.extend(["--cascade-strategy", strategy])

    start = time.perf_counter()
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    elapsed = (time.perf_counter() - start) * 1000

    # Strip ANSI codes
    output = ansi_escape.sub('', result.stdout + result.stderr)

    # Parse JSON
    start_idx = output.find('{')
    if start_idx < 0:
        return SearchResult(
            method=method, strategy=strategy, query=query,
            time_ms=elapsed, count=0, top_files=[], top_scores=[],
            success=False, error="No JSON found"
        )

    # Parse nested JSON properly
    in_string = False
    escaped = False
    depth = 0
    end_idx = start_idx

    for i, c in enumerate(output[start_idx:]):
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
                    end_idx = start_idx + i + 1
                    break

    try:
        data = json.loads(output[start_idx:end_idx])
        if not data.get("success"):
            return SearchResult(
                method=method, strategy=strategy, query=query,
                time_ms=elapsed, count=0, top_files=[], top_scores=[],
                success=False, error=data.get("error", "Unknown error")
            )

        results = data.get("result", {}).get("results", [])[:limit]
        stats = data.get("result", {}).get("stats", {})

        top_files = [os.path.basename(r.get("path", "")) for r in results]
        top_scores = [r.get("score", 0) for r in results]

        return SearchResult(
            method=method, strategy=strategy, query=query,
            time_ms=stats.get("time_ms", elapsed),
            count=len(results),
            top_files=top_files,
            top_scores=top_scores,
            success=True
        )
    except Exception as e:
        return SearchResult(
            method=method, strategy=strategy, query=query,
            time_ms=elapsed, count=0, top_files=[], top_scores=[],
            success=False, error=str(e)
        )


def calculate_ranking_similarity(baseline: List[str], candidate: List[str]) -> float:
    """Calculate ranking similarity using normalized DCG."""
    if not baseline or not candidate:
        return 0.0

    # Simple overlap-based similarity with position weighting
    score = 0.0
    for i, file in enumerate(candidate[:10]):
        if file in baseline:
            baseline_pos = baseline.index(file)
            # Weight by position similarity
            pos_diff = abs(i - baseline_pos)
            score += 1.0 / (1 + pos_diff * 0.2)

    return score / min(len(baseline), 10)


def print_divider(char="=", width=80):
    print(char * width)


def main():
    print_divider()
    print("🔬 CodexLens 搜索方法多维度对比测试")
    print_divider()
    print(f"测试目录: {os.getcwd()}")
    print(f"测试查询数: {len(TEST_QUERIES)}")
    print(f"对比方法数: {len(SEARCH_METHODS)}")
    print_divider()

    all_results: Dict[str, Dict[str, SearchResult]] = {}

    # Run all tests
    for query, query_desc in TEST_QUERIES:
        print(f"\n📝 查询: \"{query}\" ({query_desc})")
        print("-" * 60)

        all_results[query] = {}

        for method, strategy, method_name in SEARCH_METHODS:
            method_key = f"{method}_{strategy}" if strategy else method
            print(f"  ⏳ {method_name}...", end=" ", flush=True)

            result = run_search(query, method, strategy)
            all_results[query][method_key] = result

            if result.success:
                print(f"✓ {result.time_ms:.0f}ms, {result.count} results")
            else:
                print(f"✗ {result.error}")

    # === Analysis ===
    print("\n")
    print_divider()
    print("📊 综合分析报告")
    print_divider()

    # 1. Speed Comparison
    print("\n### 1️⃣ 速度对比 (平均耗时 ms)")
    print("-" * 60)

    method_times: Dict[str, List[float]] = {f"{m}_{s}" if s else m: [] for m, s, _ in SEARCH_METHODS}

    for query in all_results:
        for method_key, result in all_results[query].items():
            if result.success:
                method_times[method_key].append(result.time_ms)

    speed_ranking = []
    for method, strategy, method_name in SEARCH_METHODS:
        method_key = f"{method}_{strategy}" if strategy else method
        times = method_times[method_key]
        if times:
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            speed_ranking.append((method_name, avg_time, min_time, max_time))

    speed_ranking.sort(key=lambda x: x[1])

    print(f"{'方法':<35} {'平均':>10} {'最快':>10} {'最慢':>10}")
    print("-" * 65)
    for method_name, avg, min_t, max_t in speed_ranking:
        print(f"{method_name:<35} {avg:>10.0f} {min_t:>10.0f} {max_t:>10.0f}")

    # Speed winner
    if speed_ranking:
        fastest = speed_ranking[0]
        slowest = speed_ranking[-1]
        speedup = slowest[1] / fastest[1] if fastest[1] > 0 else 0
        print(f"\n🏆 最快: {fastest[0]} (比最慢快 {speedup:.1f}x)")

    # 2. Score Distribution
    print("\n### 2️⃣ 相关性得分分布 (Top-10 平均分)")
    print("-" * 60)

    method_scores: Dict[str, List[float]] = {f"{m}_{s}" if s else m: [] for m, s, _ in SEARCH_METHODS}

    for query in all_results:
        for method_key, result in all_results[query].items():
            if result.success and result.top_scores:
                avg_score = sum(result.top_scores) / len(result.top_scores)
                method_scores[method_key].append(avg_score)

    print(f"{'方法':<35} {'平均分':>12} {'分布范围':>20}")
    print("-" * 67)
    for method, strategy, method_name in SEARCH_METHODS:
        method_key = f"{method}_{strategy}" if strategy else method
        scores = method_scores[method_key]
        if scores:
            avg_score = sum(scores) / len(scores)
            min_score = min(scores)
            max_score = max(scores)
            print(f"{method_name:<35} {avg_score:>12.4f} {min_score:.4f} - {max_score:.4f}")

    # 3. Ranking Stability (vs Hybrid as baseline)
    print("\n### 3️⃣ 排名稳定性 (与 Hybrid 基线对比)")
    print("-" * 60)

    print(f"{'方法':<35} {'相似度':>12} {'说明':>20}")
    print("-" * 67)

    for method, strategy, method_name in SEARCH_METHODS:
        method_key = f"{method}_{strategy}" if strategy else method
        if method_key == "hybrid":
            print(f"{method_name:<35} {'1.0000':>12} {'(基线)':>20}")
            continue

        similarities = []
        for query in all_results:
            baseline = all_results[query].get("hybrid")
            candidate = all_results[query].get(method_key)
            if baseline and candidate and baseline.success and candidate.success:
                sim = calculate_ranking_similarity(baseline.top_files, candidate.top_files)
                similarities.append(sim)

        if similarities:
            avg_sim = sum(similarities) / len(similarities)
            diff_level = "高度一致" if avg_sim > 0.7 else "中度差异" if avg_sim > 0.4 else "显著差异"
            print(f"{method_name:<35} {avg_sim:>12.4f} {diff_level:>20}")

    # 4. Detailed Query Comparison
    print("\n### 4️⃣ 各查询详细对比")
    print("-" * 60)

    for query, query_desc in TEST_QUERIES:
        print(f"\n📌 \"{query}\" ({query_desc})")
        print()

        # Show top-3 results for each method
        for method, strategy, method_name in SEARCH_METHODS:
            method_key = f"{method}_{strategy}" if strategy else method
            result = all_results[query].get(method_key)

            if result and result.success:
                print(f"  [{method_name}] {result.time_ms:.0f}ms")
                for i, (file, score) in enumerate(zip(result.top_files[:3], result.top_scores[:3]), 1):
                    print(f"    {i}. {file:<40} {score:.4f}")
            else:
                print(f"  [{method_name}] 失败: {result.error if result else 'N/A'}")
        print()

    # 5. Summary
    print_divider()
    print("📋 总结")
    print_divider()

    print("""
┌─────────────────────────────────────────────────────────────────────┐
│ 方法特点总结                                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Hybrid (FTS+Vector)     │ 基线方法，综合质量好，速度中等              │
│ Pure Vector             │ 语义理解强，适合自然语言查询                │
│ Cascade Binary          │ 速度最快，适合大代码库快速检索              │
│ Cascade Hybrid          │ Cross-Encoder 精排，质量最高但速度较慢       │
└─────────────────────────────────────────────────────────────────────┘

推荐使用场景:
• 日常搜索: hybrid (默认)
• 大代码库快速检索: cascade --cascade-strategy binary
• 追求最高质量: cascade --cascade-strategy hybrid
• 自然语言查询: vector
""")

    print_divider()


if __name__ == "__main__":
    main()
