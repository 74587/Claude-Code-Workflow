"""Rotational embedder for multi-endpoint API load balancing.

Provides intelligent load balancing across multiple LiteLLM embedding endpoints
to maximize throughput while respecting rate limits.
"""

from __future__ import annotations

import logging
import random
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional

import numpy as np

from .base import BaseEmbedder

logger = logging.getLogger(__name__)


class EndpointStatus(Enum):
    """Status of an API endpoint."""
    AVAILABLE = "available"
    COOLING = "cooling"  # Rate limited, temporarily unavailable
    FAILED = "failed"    # Permanent failure (auth error, etc.)


class SelectionStrategy(Enum):
    """Strategy for selecting endpoints."""
    ROUND_ROBIN = "round_robin"
    LATENCY_AWARE = "latency_aware"
    WEIGHTED_RANDOM = "weighted_random"


@dataclass
class EndpointConfig:
    """Configuration for a single API endpoint."""
    model: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    weight: float = 1.0  # Higher weight = more requests
    max_concurrent: int = 4  # Max concurrent requests to this endpoint


@dataclass
class EndpointState:
    """Runtime state for an endpoint."""
    config: EndpointConfig
    embedder: Any = None  # LiteLLMEmbedderWrapper instance
    
    # Health metrics
    status: EndpointStatus = EndpointStatus.AVAILABLE
    cooldown_until: float = 0.0  # Unix timestamp when cooldown ends
    
    # Performance metrics
    total_requests: int = 0
    total_failures: int = 0
    avg_latency_ms: float = 0.0
    last_latency_ms: float = 0.0
    
    # Concurrency tracking
    active_requests: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)
    
    def is_available(self) -> bool:
        """Check if endpoint is available for requests."""
        if self.status == EndpointStatus.FAILED:
            return False
        if self.status == EndpointStatus.COOLING:
            if time.time() >= self.cooldown_until:
                self.status = EndpointStatus.AVAILABLE
                return True
            return False
        return True
    
    def set_cooldown(self, seconds: float) -> None:
        """Put endpoint in cooldown state."""
        self.status = EndpointStatus.COOLING
        self.cooldown_until = time.time() + seconds
        logger.warning(f"Endpoint {self.config.model} cooling down for {seconds:.1f}s")
    
    def mark_failed(self) -> None:
        """Mark endpoint as permanently failed."""
        self.status = EndpointStatus.FAILED
        logger.error(f"Endpoint {self.config.model} marked as failed")
    
    def record_success(self, latency_ms: float) -> None:
        """Record successful request."""
        self.total_requests += 1
        self.last_latency_ms = latency_ms
        # Exponential moving average for latency
        alpha = 0.3
        if self.avg_latency_ms == 0:
            self.avg_latency_ms = latency_ms
        else:
            self.avg_latency_ms = alpha * latency_ms + (1 - alpha) * self.avg_latency_ms
    
    def record_failure(self) -> None:
        """Record failed request."""
        self.total_requests += 1
        self.total_failures += 1
    
    @property
    def health_score(self) -> float:
        """Calculate health score (0-1) based on metrics."""
        if not self.is_available():
            return 0.0
        
        # Base score from success rate
        if self.total_requests > 0:
            success_rate = 1 - (self.total_failures / self.total_requests)
        else:
            success_rate = 1.0
        
        # Latency factor (faster = higher score)
        # Normalize: 100ms = 1.0, 1000ms = 0.1
        if self.avg_latency_ms > 0:
            latency_factor = min(1.0, 100 / self.avg_latency_ms)
        else:
            latency_factor = 1.0
        
        # Availability factor (less concurrent = more available)
        if self.config.max_concurrent > 0:
            availability = 1 - (self.active_requests / self.config.max_concurrent)
        else:
            availability = 1.0
        
        # Combined score with weights
        return (success_rate * 0.4 + latency_factor * 0.3 + availability * 0.3) * self.config.weight


class RotationalEmbedder(BaseEmbedder):
    """Embedder that load balances across multiple API endpoints.
    
    Features:
    - Intelligent endpoint selection based on latency and health
    - Automatic failover on rate limits (429) and server errors
    - Cooldown management to respect rate limits
    - Thread-safe concurrent request handling
    
    Args:
        endpoints: List of endpoint configurations
        strategy: Selection strategy (default: latency_aware)
        default_cooldown: Default cooldown seconds for rate limits (default: 60)
        max_retries: Maximum retry attempts across all endpoints (default: 3)
    """
    
    def __init__(
        self,
        endpoints: List[EndpointConfig],
        strategy: SelectionStrategy = SelectionStrategy.LATENCY_AWARE,
        default_cooldown: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        if not endpoints:
            raise ValueError("At least one endpoint must be provided")
        
        self.strategy = strategy
        self.default_cooldown = default_cooldown
        self.max_retries = max_retries
        
        # Initialize endpoint states
        self._endpoints: List[EndpointState] = []
        self._lock = threading.Lock()
        self._round_robin_index = 0
        
        # Create embedder instances for each endpoint
        from .litellm_embedder import LiteLLMEmbedderWrapper
        
        for config in endpoints:
            # Build kwargs for LiteLLMEmbedderWrapper
            kwargs: Dict[str, Any] = {}
            if config.api_key:
                kwargs["api_key"] = config.api_key
            if config.api_base:
                kwargs["api_base"] = config.api_base
            
            try:
                embedder = LiteLLMEmbedderWrapper(model=config.model, **kwargs)
                state = EndpointState(config=config, embedder=embedder)
                self._endpoints.append(state)
                logger.info(f"Initialized endpoint: {config.model}")
            except Exception as e:
                logger.error(f"Failed to initialize endpoint {config.model}: {e}")
        
        if not self._endpoints:
            raise ValueError("Failed to initialize any endpoints")
        
        # Cache embedding properties from first endpoint
        self._embedding_dim = self._endpoints[0].embedder.embedding_dim
        self._model_name = f"rotational({len(self._endpoints)} endpoints)"
        self._max_tokens = self._endpoints[0].embedder.max_tokens
    
    @property
    def embedding_dim(self) -> int:
        """Return embedding dimensions."""
        return self._embedding_dim
    
    @property
    def model_name(self) -> str:
        """Return model name."""
        return self._model_name
    
    @property
    def max_tokens(self) -> int:
        """Return maximum token limit."""
        return self._max_tokens
    
    @property
    def endpoint_count(self) -> int:
        """Return number of configured endpoints."""
        return len(self._endpoints)
    
    @property
    def available_endpoint_count(self) -> int:
        """Return number of available endpoints."""
        return sum(1 for ep in self._endpoints if ep.is_available())
    
    def get_endpoint_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for all endpoints."""
        stats = []
        for ep in self._endpoints:
            stats.append({
                "model": ep.config.model,
                "status": ep.status.value,
                "total_requests": ep.total_requests,
                "total_failures": ep.total_failures,
                "avg_latency_ms": round(ep.avg_latency_ms, 2),
                "health_score": round(ep.health_score, 3),
                "active_requests": ep.active_requests,
            })
        return stats
    
    def _select_endpoint(self) -> Optional[EndpointState]:
        """Select best available endpoint based on strategy."""
        available = [ep for ep in self._endpoints if ep.is_available()]
        
        if not available:
            return None
        
        if self.strategy == SelectionStrategy.ROUND_ROBIN:
            with self._lock:
                self._round_robin_index = (self._round_robin_index + 1) % len(available)
                return available[self._round_robin_index]
        
        elif self.strategy == SelectionStrategy.LATENCY_AWARE:
            # Sort by health score (descending) and pick top candidate
            # Add small random factor to prevent thundering herd
            scored = [(ep, ep.health_score + random.uniform(0, 0.1)) for ep in available]
            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[0][0]
        
        elif self.strategy == SelectionStrategy.WEIGHTED_RANDOM:
            # Weighted random selection based on health scores
            scores = [ep.health_score for ep in available]
            total = sum(scores)
            if total == 0:
                return random.choice(available)
            
            weights = [s / total for s in scores]
            return random.choices(available, weights=weights, k=1)[0]
        
        return available[0]
    
    def _parse_retry_after(self, error: Exception) -> Optional[float]:
        """Extract Retry-After value from error if available."""
        error_str = str(error)
        
        # Try to find Retry-After in error message
        import re
        match = re.search(r'[Rr]etry[- ][Aa]fter[:\s]+(\d+)', error_str)
        if match:
            return float(match.group(1))
        
        return None
    
    def _is_rate_limit_error(self, error: Exception) -> bool:
        """Check if error is a rate limit error."""
        error_str = str(error).lower()
        return any(x in error_str for x in ["429", "rate limit", "too many requests"])
    
    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if error is retryable (not auth/config error)."""
        error_str = str(error).lower()
        # Retryable errors
        if any(x in error_str for x in ["429", "rate limit", "502", "503", "504", 
                                         "timeout", "connection", "service unavailable"]):
            return True
        # Non-retryable errors (auth, config)
        if any(x in error_str for x in ["401", "403", "invalid", "authentication", 
                                         "unauthorized", "api key"]):
            return False
        # Default to retryable for unknown errors
        return True
    
    def embed_to_numpy(self, texts: str | Iterable[str], **kwargs) -> np.ndarray:
        """Embed texts using load-balanced endpoint selection.
        
        Args:
            texts: Single text or iterable of texts to embed.
            **kwargs: Additional arguments passed to underlying embedder.
        
        Returns:
            numpy.ndarray: Array of shape (n_texts, embedding_dim) containing embeddings.
        
        Raises:
            RuntimeError: If all endpoints fail after retries.
        """
        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)
        
        last_error: Optional[Exception] = None
        tried_endpoints: set = set()
        
        for attempt in range(self.max_retries + 1):
            endpoint = self._select_endpoint()
            
            if endpoint is None:
                # All endpoints unavailable, wait for shortest cooldown
                min_cooldown = min(
                    (ep.cooldown_until - time.time() for ep in self._endpoints 
                     if ep.status == EndpointStatus.COOLING),
                    default=self.default_cooldown
                )
                if min_cooldown > 0 and attempt < self.max_retries:
                    wait_time = min(min_cooldown, 30)  # Cap wait at 30s
                    logger.warning(f"All endpoints busy, waiting {wait_time:.1f}s...")
                    time.sleep(wait_time)
                    continue
                break
            
            # Track tried endpoints to avoid infinite loops
            endpoint_id = id(endpoint)
            if endpoint_id in tried_endpoints and len(tried_endpoints) >= len(self._endpoints):
                # Already tried all endpoints
                break
            tried_endpoints.add(endpoint_id)
            
            # Acquire slot
            with endpoint.lock:
                endpoint.active_requests += 1
            
            try:
                start_time = time.time()
                result = endpoint.embedder.embed_to_numpy(texts, **kwargs)
                latency_ms = (time.time() - start_time) * 1000
                
                # Record success
                endpoint.record_success(latency_ms)
                
                return result
                
            except Exception as e:
                last_error = e
                endpoint.record_failure()
                
                if self._is_rate_limit_error(e):
                    # Rate limited - set cooldown
                    retry_after = self._parse_retry_after(e) or self.default_cooldown
                    endpoint.set_cooldown(retry_after)
                    logger.warning(f"Endpoint {endpoint.config.model} rate limited, "
                                   f"cooling for {retry_after}s")
                    
                elif not self._is_retryable_error(e):
                    # Permanent failure (auth error, etc.)
                    endpoint.mark_failed()
                    logger.error(f"Endpoint {endpoint.config.model} failed permanently: {e}")
                    
                else:
                    # Temporary error - short cooldown
                    endpoint.set_cooldown(5.0)
                    logger.warning(f"Endpoint {endpoint.config.model} error: {e}")
                
            finally:
                with endpoint.lock:
                    endpoint.active_requests -= 1
        
        # All retries exhausted
        available = self.available_endpoint_count
        raise RuntimeError(
            f"All embedding attempts failed after {self.max_retries + 1} tries. "
            f"Available endpoints: {available}/{len(self._endpoints)}. "
            f"Last error: {last_error}"
        )


def create_rotational_embedder(
    endpoints_config: List[Dict[str, Any]],
    strategy: str = "latency_aware",
    default_cooldown: float = 60.0,
) -> RotationalEmbedder:
    """Factory function to create RotationalEmbedder from config dicts.
    
    Args:
        endpoints_config: List of endpoint configuration dicts with keys:
            - model: Model identifier (required)
            - api_key: API key (optional)
            - api_base: API base URL (optional)
            - weight: Request weight (optional, default 1.0)
            - max_concurrent: Max concurrent requests (optional, default 4)
        strategy: Selection strategy name (round_robin, latency_aware, weighted_random)
        default_cooldown: Default cooldown seconds for rate limits
    
    Returns:
        Configured RotationalEmbedder instance
    
    Example config:
        endpoints_config = [
            {"model": "openai/text-embedding-3-small", "api_key": "sk-..."},
            {"model": "azure/my-embedding", "api_base": "https://...", "api_key": "..."},
        ]
    """
    endpoints = []
    for cfg in endpoints_config:
        endpoints.append(EndpointConfig(
            model=cfg["model"],
            api_key=cfg.get("api_key"),
            api_base=cfg.get("api_base"),
            weight=cfg.get("weight", 1.0),
            max_concurrent=cfg.get("max_concurrent", 4),
        ))
    
    strategy_enum = SelectionStrategy[strategy.upper()]
    
    return RotationalEmbedder(
        endpoints=endpoints,
        strategy=strategy_enum,
        default_cooldown=default_cooldown,
    )
