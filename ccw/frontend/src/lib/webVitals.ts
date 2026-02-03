// ========================================
// Web Vitals Performance Monitoring
// ========================================
// Measures and logs Core Web Vitals metrics (LCP, INP, CLS)
// These are essential for measuring page performance and user experience

import {
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  type Metric,
} from 'web-vitals';

/**
 * Threshold values for Web Vitals (WCAG recommendations)
 * @see https://web.dev/metrics/
 */
export const VITALS_THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint - target < 2.5s
  INP: 200, // Interaction to Next Paint - target < 200ms (replaces FID)
  CLS: 0.1, // Cumulative Layout Shift - target < 0.1
  FCP: 1800, // First Contentful Paint - target < 1.8s
  TTFB: 600, // Time to First Byte - target < 600ms
} as const;

/**
 * Web Vitals metric entry
 */
export interface VitalsMetric extends Metric {
  vitalsName: string;
  isBad: boolean;
  rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Web Vitals callback function
 */
export type VitalsCallback = (metric: VitalsMetric) => void;

/**
 * Determine if a metric is within good range
 */
function isGoodMetric(name: string, value: number): boolean {
  switch (name) {
    case 'LCP':
      return value <= VITALS_THRESHOLDS.LCP;
    case 'INP':
      return value <= VITALS_THRESHOLDS.INP;
    case 'CLS':
      return value <= VITALS_THRESHOLDS.CLS;
    case 'FCP':
      return value <= VITALS_THRESHOLDS.FCP;
    case 'TTFB':
      return value <= VITALS_THRESHOLDS.TTFB;
    default:
      return true;
  }
}

/**
 * Get rating for a metric
 */
function getMetricRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const goodThreshold = VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS];
  if (!goodThreshold) return 'good';

  // Good threshold
  if (value <= goodThreshold) {
    return 'good';
  }

  // Poor threshold (typically 1.25x of good threshold)
  const poorThreshold = goodThreshold * 1.25;
  if (value <= poorThreshold) {
    return 'needs-improvement';
  }

  return 'poor';
}

/**
 * Initialize Web Vitals monitoring
 *
 * @param callback - Function to call when metrics are collected
 * @param reportAllMetrics - Include FCP and TTFB (optional, default false)
 *
 * @example
 * ```ts
 * initWebVitals((metric) => {
 *   console.log(`${metric.name}: ${metric.value}`);
 *   if (metric.isBad) {
 *     analytics.trackVitalsIssue(metric);
 *   }
 * });
 * ```
 */
export function initWebVitals(
  callback: VitalsCallback,
  reportAllMetrics = false
): void {
  // Core Web Vitals (always measured)
  onLCP((metric) => {
    const m: VitalsMetric = {
      ...metric,
      vitalsName: 'LCP',
      isBad: !isGoodMetric('LCP', metric.value),
      rating: getMetricRating('LCP', metric.value),
    };
    callback(m);
  });

  onINP((metric) => {
    const m: VitalsMetric = {
      ...metric,
      vitalsName: 'INP',
      isBad: !isGoodMetric('INP', metric.value),
      rating: getMetricRating('INP', metric.value),
    };
    callback(m);
  });

  onCLS((metric) => {
    const m: VitalsMetric = {
      ...metric,
      vitalsName: 'CLS',
      isBad: !isGoodMetric('CLS', metric.value),
      rating: getMetricRating('CLS', metric.value),
    };
    callback(m);
  });

  // Optional metrics
  if (reportAllMetrics) {
    onFCP((metric) => {
      const m: VitalsMetric = {
        ...metric,
        vitalsName: 'FCP',
        isBad: !isGoodMetric('FCP', metric.value),
        rating: getMetricRating('FCP', metric.value),
      };
      callback(m);
    });

    onTTFB((metric) => {
      const m: VitalsMetric = {
        ...metric,
        vitalsName: 'TTFB',
        isBad: !isGoodMetric('TTFB', metric.value),
        rating: getMetricRating('TTFB', metric.value),
      };
      callback(m);
    });
  }
}

/**
 * Log Web Vitals metrics to console
 * Useful for development and debugging
 */
export function logWebVitals(): void {
  initWebVitals((metric) => {
    const style = metric.isBad
      ? 'background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 3px;'
      : 'background: #51cf66; color: white; padding: 2px 6px; border-radius: 3px;';

    console.log(
      `%c${metric.vitalsName}%c ${metric.value.toFixed(2)}ms (${metric.rating})`,
      style,
      'background: none;'
    );
  });
}

/**
 * Send Web Vitals to analytics service
 *
 * @param endpoint - Analytics endpoint URL
 *
 * @example
 * ```ts
 * sendWebVitalsToAnalytics('/api/analytics/vitals');
 * ```
 */
export function sendWebVitalsToAnalytics(endpoint: string): void {
  initWebVitals((metric) => {
    // Only send bad metrics to reduce noise
    if (!metric.isBad) return;

    // Queue the metric and send in batches
    const data = {
      metric: metric.vitalsName,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Use sendBeacon for reliability (survives page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(data));
    } else {
      // Fallback to fetch
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {
        // Silently fail to avoid disrupting user experience
      });
    }
  });
}

export default initWebVitals;
