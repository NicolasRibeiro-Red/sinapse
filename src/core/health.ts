// Sinapse — Health Score Calculator
// Formula from PRD Section 6

import type { HealthReport, HealthBreakdown, SinapseMemory } from '../types/index.js';
import { HealthRange, MemoryStatus } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { listMemories } from './memory-store.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function calculateHealth(
  memories?: SinapseMemory[],
  options?: { agent?: string; project?: string },
): HealthReport {
  const config = DEFAULT_CONFIG.health;
  const mems = memories ?? listMemories({
    agent: options?.agent,
    project: options?.project,
  });

  const now = Date.now();

  // Calculate breakdown
  let staleCount = 0;
  let dupeCount = 0;
  let lowScoreCount = 0;
  let pinnedCount = 0;
  let linksCount = 0;
  let totalAgeDays = 0;

  const titleMap = new Map<string, number>();

  for (const mem of mems) {
    const accessedTime = new Date(mem.accessed).getTime();
    const createdTime = new Date(mem.created).getTime();
    const ageDays = (now - createdTime) / (1000 * 60 * 60 * 24);

    totalAgeDays += ageDays;

    // Stale: not accessed in 7 days
    if (now - accessedTime > SEVEN_DAYS_MS) {
      staleCount++;
    }

    // Duplicate detection (by similar title)
    const normalizedTitle = mem.title.toLowerCase().trim();
    titleMap.set(normalizedTitle, (titleMap.get(normalizedTitle) ?? 0) + 1);

    // Low score
    if (mem.effective_score < 3.0) {
      lowScoreCount++;
    }

    // Pinned
    if (mem.status === MemoryStatus.Pinned) {
      pinnedCount++;
    }

    // Links
    linksCount += mem.links.length;
  }

  // Count duplicates (titles appearing 2+ times)
  for (const [, count] of titleMap) {
    if (count > 1) {
      dupeCount += count - 1;
    }
  }

  const avgAgeDays = mems.length > 0 ? totalAgeDays / mems.length : 0;

  const breakdown: HealthBreakdown = {
    staleCount,
    stalePenalty: staleCount * config.stalePenaltyPerMemory,
    dupeCount,
    dupePenalty: dupeCount * config.dupePenalty,
    avgAgeDays: Math.round(avgAgeDays * 10) / 10,
    agePenalty: Math.round(avgAgeDays * config.agePenaltyFactor * 10) / 10,
    lowScoreCount,
    lowScorePenalty: lowScoreCount * config.lowScorePenalty,
    pinnedCount,
    pinnedBonus: pinnedCount * config.pinnedBonus,
    linksCount,
    linksBonus: Math.round(linksCount * config.linksBonus * 10) / 10,
  };

  // Calculate final score
  let score = 100
    - breakdown.stalePenalty
    - breakdown.dupePenalty
    - breakdown.agePenalty
    - breakdown.lowScorePenalty
    + breakdown.pinnedBonus
    + breakdown.linksBonus;

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  const range = getHealthRange(score);

  return {
    score,
    range,
    breakdown,
    totalMemories: mems.length,
    agent: options?.agent,
    project: options?.project,
    timestamp: new Date().toISOString(),
  };
}

export function getHealthRange(score: number): HealthRange {
  if (score >= 80) return HealthRange.Healthy;
  if (score >= 60) return HealthRange.Attention;
  if (score >= 40) return HealthRange.Alert;
  return HealthRange.Critical;
}

export function healthRangeLabel(range: HealthRange): string {
  switch (range) {
    case HealthRange.Healthy: return 'Saudavel';
    case HealthRange.Attention: return 'Atencao';
    case HealthRange.Alert: return 'Alerta';
    case HealthRange.Critical: return 'Critico';
  }
}

export function healthGauge(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const range = getHealthRange(score);
  const label = healthRangeLabel(range);

  return `${bar} ${score}/100 (${label})`;
}
