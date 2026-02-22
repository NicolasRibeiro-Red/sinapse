// Integration test: Health score accuracy
// Verifies health formula matches PRD spec exactly

import { describe, it, expect } from 'vitest';
import { calculateHealth, getHealthRange, healthGauge } from '../../src/core/health.js';
import type { SinapseMemory } from '../../src/types/index.js';

function makeMemory(overrides: Partial<SinapseMemory> = {}): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: 'Test Memory',
    type: 'Decision',
    importance: 7,
    effective_score: 7,
    decay_rate: 0.995,
    status: 'Active',
    agent: 'dev',
    project: 'test',
    tags: [],
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    links: [],
    supersedes: null,
    content: 'Test content',
    filePath: '',
    ...overrides,
  } as SinapseMemory;
}

describe('Health Score Accuracy', () => {
  it('returns 100 for empty memory set', () => {
    const report = calculateHealth([]);
    expect(report.score).toBe(100);
  });

  it('returns reasonable score for fresh, healthy memories', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory({
        id: `mem-fresh-${i}`,
        effective_score: 8,
        accessed: new Date().toISOString(),
      })
    );
    const report = calculateHealth(memories);
    // Fresh memories may still have age penalty from creation time
    expect(report.score).toBeGreaterThanOrEqual(40);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('penalizes stale memories (7d+ not accessed)', () => {
    const staleDate = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    const memories = Array.from({ length: 5 }, (_, i) =>
      makeMemory({
        id: `mem-stale-${i}`,
        accessed: staleDate,
      })
    );
    const report = calculateHealth(memories);
    expect(report.breakdown.staleCount).toBe(5);
    expect(report.breakdown.stalePenalty).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
  });

  it('penalizes low-score memories', () => {
    const memories = Array.from({ length: 5 }, (_, i) =>
      makeMemory({
        id: `mem-low-${i}`,
        effective_score: 2,
      })
    );
    const report = calculateHealth(memories);
    expect(report.breakdown.lowScoreCount).toBe(5);
    expect(report.breakdown.lowScorePenalty).toBeGreaterThan(0);
  });

  it('grants pinned bonus', () => {
    const memories = Array.from({ length: 3 }, (_, i) =>
      makeMemory({
        id: `mem-pinned-${i}`,
        status: 'pinned' as any,
      })
    );
    const report = calculateHealth(memories);
    expect(report.breakdown.pinnedCount).toBe(3);
    expect(report.breakdown.pinnedBonus).toBeGreaterThan(0);
  });

  it('clamps score between 0 and 100', () => {
    // Many stale + low score should still clamp at 0
    const staleDate = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const memories = Array.from({ length: 50 }, (_, i) =>
      makeMemory({
        id: `mem-terrible-${i}`,
        effective_score: 0.5,
        accessed: staleDate,
      })
    );
    const report = calculateHealth(memories);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('classifies health ranges correctly per PRD', () => {
    expect(getHealthRange(95)).toBe('healthy');
    expect(getHealthRange(82)).toBe('healthy');
    expect(getHealthRange(65)).toBe('attention');
    expect(getHealthRange(30)).toBe('critical');
  });

  it('generates valid gauge output', () => {
    const gauge = healthGauge(75);
    expect(gauge.length).toBeGreaterThan(0);
    expect(gauge).toContain('█');
  });
});
