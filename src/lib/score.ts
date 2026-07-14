// Shared score → color-tier thresholds used by both ScoreBar (progress bar) and
// ScoreBadge (colored badge). The two components render differently but agree on
// the tier boundaries: ≤1 is "low" (red), ≤3 is "mid" (amber), else "high" (green).

export type ScoreTier = 'low' | 'mid' | 'high'

export function scoreTier(score: number): ScoreTier {
  if (score <= 1) return 'low'
  if (score <= 3) return 'mid'
  return 'high'
}
