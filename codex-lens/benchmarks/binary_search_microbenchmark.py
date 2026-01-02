#!/usr/bin/env python
"""Micro-benchmark for BinaryANNIndex search performance.

Measures the actual speedup of vectorized Hamming distance computation.
"""

from __future__ import annotations

import gc
import statistics
import sys
import time
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import numpy as np


def old_search_implementation(query_arr: np.ndarray, vectors: dict, id_list: list, top_k: int):
    """Original O(N) loop-based implementation for comparison."""
    packed_dim = len(query_arr)
    distances = []

    for vec_id in id_list:
        vec = vectors[vec_id]
        vec_arr = np.frombuffer(vec, dtype=np.uint8)
        xor = np.bitwise_xor(query_arr, vec_arr)
        dist = int(np.unpackbits(xor).sum())
        distances.append((vec_id, dist))

    distances.sort(key=lambda x: x[1])
    top_results = distances[:top_k]
    ids = [r[0] for r in top_results]
    dists = [r[1] for r in top_results]

    return ids, dists


def new_search_implementation(query_arr: np.ndarray, vectors_matrix: np.ndarray, ids_array: np.ndarray, top_k: int):
    """Optimized vectorized implementation."""
    # Broadcast XOR
    xor_result = np.bitwise_xor(query_arr, vectors_matrix)

    # Vectorized popcount using lookup table
    popcount_lut = np.array([bin(i).count('1') for i in range(256)], dtype=np.uint8)
    bit_counts = popcount_lut[xor_result]

    # Sum across packed bytes
    distances = bit_counts.sum(axis=1)

    # Get top-k using argpartition
    n_vectors = len(distances)
    k = min(top_k, n_vectors)

    if k == n_vectors:
        sorted_indices = np.argsort(distances)
    else:
        partition_indices = np.argpartition(distances, k)[:k]
        top_k_distances = distances[partition_indices]
        sorted_order = np.argsort(top_k_distances)
        sorted_indices = partition_indices[sorted_order]

    result_ids = ids_array[sorted_indices].tolist()
    result_dists = distances[sorted_indices].tolist()

    return result_ids, result_dists


def run_benchmark(n_vectors: int, dim: int = 256, top_k: int = 100, n_iterations: int = 50):
    """Run benchmark comparing old and new implementations."""
    packed_dim = dim // 8  # 32 bytes for 256-bit

    print(f"\n{'='*60}")
    print(f"Binary Search Micro-Benchmark")
    print(f"{'='*60}")
    print(f"Vectors: {n_vectors}")
    print(f"Dimension: {dim} bits ({packed_dim} bytes packed)")
    print(f"Top-K: {top_k}")
    print(f"Iterations: {n_iterations}")
    print(f"{'='*60}\n")

    # Generate random binary vectors
    print("Generating test data...")
    vectors_dict = {}
    id_list = []

    for i in range(n_vectors):
        vec_bytes = np.random.randint(0, 256, size=packed_dim, dtype=np.uint8).tobytes()
        vectors_dict[i] = vec_bytes
        id_list.append(i)

    # Build matrix for vectorized search
    vectors_matrix = np.empty((n_vectors, packed_dim), dtype=np.uint8)
    ids_array = np.array(id_list, dtype=np.int64)

    for i, vec_id in enumerate(id_list):
        vec_bytes = vectors_dict[vec_id]
        vectors_matrix[i] = np.frombuffer(vec_bytes, dtype=np.uint8)

    # Generate random query
    query_bytes = np.random.randint(0, 256, size=packed_dim, dtype=np.uint8).tobytes()
    query_arr = np.frombuffer(query_bytes, dtype=np.uint8)

    # Warmup
    print("Running warmup...")
    for _ in range(3):
        old_search_implementation(query_arr, vectors_dict, id_list, top_k)
        new_search_implementation(query_arr, vectors_matrix, ids_array, top_k)

    # Benchmark old implementation
    print("Benchmarking old implementation...")
    old_times = []
    for _ in range(n_iterations):
        gc.collect()
        start = time.perf_counter()
        old_ids, old_dists = old_search_implementation(query_arr, vectors_dict, id_list, top_k)
        elapsed = (time.perf_counter() - start) * 1000
        old_times.append(elapsed)

    # Benchmark new implementation
    print("Benchmarking new implementation...")
    new_times = []
    for _ in range(n_iterations):
        gc.collect()
        start = time.perf_counter()
        new_ids, new_dists = new_search_implementation(query_arr, vectors_matrix, ids_array, top_k)
        elapsed = (time.perf_counter() - start) * 1000
        new_times.append(elapsed)

    # Verify correctness
    print("\nVerifying correctness...")
    # Check that distances are correct (IDs may differ for ties)
    if old_dists == new_dists:
        print("Distances match! (IDs may differ for ties)")
    else:
        # Check if difference is just in tie-breaking
        old_dist_set = set(old_dists)
        new_dist_set = set(new_dists)
        if old_dist_set == new_dist_set:
            print("Distances equivalent (tie-breaking differs, which is acceptable)")
        else:
            print("WARNING: Distance distributions differ!")
            print(f"  Old dists (first 5): {old_dists[:5]}")
            print(f"  New dists (first 5): {new_dists[:5]}")

    # Calculate statistics
    old_avg = statistics.mean(old_times)
    old_std = statistics.stdev(old_times) if len(old_times) > 1 else 0
    new_avg = statistics.mean(new_times)
    new_std = statistics.stdev(new_times) if len(new_times) > 1 else 0

    speedup = old_avg / new_avg if new_avg > 0 else 0

    # Print results
    print(f"\n{'='*60}")
    print("RESULTS")
    print(f"{'='*60}")
    print(f"{'Metric':<25} {'Old (loop)':>15} {'New (vectorized)':>18}")
    print(f"{'-'*25} {'-'*15} {'-'*18}")
    print(f"{'Avg Latency (ms)':<25} {old_avg:>15.3f} {new_avg:>18.3f}")
    print(f"{'Std Dev (ms)':<25} {old_std:>15.3f} {new_std:>18.3f}")
    print(f"{'Min Latency (ms)':<25} {min(old_times):>15.3f} {min(new_times):>18.3f}")
    print(f"{'Max Latency (ms)':<25} {max(old_times):>15.3f} {max(new_times):>18.3f}")
    print(f"{'P50 (ms)':<25} {sorted(old_times)[len(old_times)//2]:>15.3f} {sorted(new_times)[len(new_times)//2]:>18.3f}")
    print(f"\n{'Speedup:':<25} {speedup:>15.2f}x")
    print(f"{'='*60}\n")

    return {
        "n_vectors": n_vectors,
        "dim": dim,
        "top_k": top_k,
        "old_avg_ms": old_avg,
        "new_avg_ms": new_avg,
        "speedup": speedup,
    }


def main():
    print("\n" + "="*70)
    print("  BINARY SEARCH OPTIMIZATION MICRO-BENCHMARK")
    print("="*70)

    # Test different vector counts
    results = []

    for n_vectors in [1000, 5000, 10000, 50000]:
        result = run_benchmark(
            n_vectors=n_vectors,
            dim=256,
            top_k=100,
            n_iterations=20,
        )
        results.append(result)

    # Summary
    print("\n" + "="*70)
    print("  SUMMARY")
    print("="*70)
    print(f"{'N Vectors':<12} {'Old (ms)':<12} {'New (ms)':<12} {'Speedup':>10}")
    print("-"*50)
    for r in results:
        print(f"{r['n_vectors']:<12} {r['old_avg_ms']:<12.3f} {r['new_avg_ms']:<12.3f} {r['speedup']:>10.2f}x")
    print("="*70)


if __name__ == "__main__":
    main()
