// Sinapse — Importance Scoring Constants
// Claude uses these criteria when assigning importance to memories

export const IMPORTANCE_CRITERIA = {
  ARCHITECTURE_IMPACT: { points: 3, description: 'Affects project architecture' },
  CRITICAL_BUG: { points: 2, description: 'Bug or critical problem' },
  CROSS_PROJECT: { points: 1, description: 'Affects more than one project' },
  IRREVERSIBLE_DECISION: { points: 3, description: 'Irreversible or high-cost decision' },
  REPEATED_PATTERN: { points: 2, description: 'Pattern observed 2+ times' },
  UNIQUE_INSIGHT: { points: 1, description: 'Unique valuable insight' },
} as const;

export const IMPORTANCE_SCALE = {
  MIN: 0,
  MAX: 10,
  TRIVIAL: 0,
  LOW: 3,
  MEDIUM: 5,
  HIGH: 7,
  CRITICAL: 9,
  ARCHITECTURAL: 10,
} as const;

export const PROMOTION_LEVELS = {
  INSIGHT: { occurrences: 1, importanceBoost: 0, pinned: false },
  PATTERN: { occurrences: 2, importanceBoost: 2, pinned: false },
  RULE: { occurrences: 3, importanceBoost: 3, pinned: true },
} as const;

export function getImportanceLabel(score: number): string {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 5) return 'medium';
  if (score >= 3) return 'low';
  return 'trivial';
}
