// ========================================
// QualityBadge Component
// ========================================
// Badge component for displaying prompt quality score

import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/Badge';
import type { Prompt } from '@/types/store';

export interface QualityBadgeProps {
  /** Quality score (0-100) */
  qualityScore?: number;
  /** Optional className */
  className?: string;
}

/**
 * Get quality level from score
 */
function getQualityLevel(score?: number): 'high' | 'medium' | 'low' | 'none' {
  if (score === undefined || score === null) return 'none';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

/**
 * Get badge variant for quality level
 */
function getBadgeVariant(level: 'high' | 'medium' | 'low' | 'none'): 'success' | 'warning' | 'secondary' | 'outline' {
  switch (level) {
    case 'high':
      return 'success';
    case 'medium':
      return 'warning';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * QualityBadge component - displays prompt quality score with color coding
 *
 * Quality levels:
 * - High (>=80): Green badge
 * - Medium (>=60): Yellow badge
 * - Low (<60): Gray badge
 * - No score: Outline badge
 */
export function QualityBadge({ qualityScore, className }: QualityBadgeProps) {
  const { formatMessage } = useIntl();
  const level = getQualityLevel(qualityScore);
  const variant = getBadgeVariant(level);

  const labelKey = `prompts.quality.${level}`;
  const label = formatMessage({ id: labelKey });

  if (level === 'none') {
    return null;
  }

  return (
    <Badge variant={variant} className={className}>
      {qualityScore !== undefined && `${qualityScore} `}
      {label}
    </Badge>
  );
}

/**
 * Hook to get quality badge data for a prompt
 */
export function useQualityBadge(prompt: Prompt) {
  const qualityScore = prompt.quality_score;
  const level = getQualityLevel(qualityScore);
  const variant = getBadgeVariant(level);

  return {
    qualityScore,
    level,
    variant,
    hasQuality: qualityScore !== undefined && qualityScore !== null,
  };
}

export default QualityBadge;
