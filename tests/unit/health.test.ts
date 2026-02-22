import { describe, it, expect } from 'vitest';
import { calculateHealth, getHealthRange, healthGauge, healthRangeLabel } from '../../src/core/health.js';
import { MemoryStatus, MemoryType, HealthRange } from '../../src/types/index.js';
import type { SinapseMemory } from '../../src/types/index.js';

function makeMemory(overrides: Partial<SinapseMemory> = {}): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id: `mem-${Date.now()}-${Math.random()}`,
    importance: 7,
    agent: 'dev',
    project: 'test',
    tags: ['test'],
    type: MemoryType.Context,
    created: now,
    updated: now,
    accessed: now,
    access_count: 1,
    decay_rate: 0.995,
    effective_score: 7,
    status: MemoryStatus.Active,
    links: [],
    supersedes: null,
    title: 'Test memory',
    content: 'Content',
    filePath: '/tmp/test.md',
    ...overrides,
  };
}

describe('Health Score', () => {
  describe('calculateHealth', () => {
    it('returns 100 for empty memory set', () => {
      const report = calculateHealth([]);
      expect(report.score).toBe(100);
      expect(report.range).toBe(HealthRange.Healthy);
      expect(report.totalMemories).toBe(0);
    });

    it('returns high score for fresh active memories', () => {
      const memories = [makeMemory(), makeMemory(), makeMemory()];
      const report = calculateHealth(memories);
      expect(report.score).toBeGreaterThanOrEqual(80);
      expect(report.range).toBe(HealthRange.Healthy);
    });

    it('penalizes stale memories (not accessed in 7d)', () => {
      const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const memories = [
        makeMemory({ accessed: staleDate }),
        makeMemory({ accessed: staleDate }),
      ];
      const report = calculateHealth(memories);
      // 2 stale × 2 penalty = -4
      expect(report.breakdown.staleCount).toBe(2);
      expect(report.breakdown.stalePenalty).toBe(4);
    });

    it('penalizes duplicates', () => {
      const memories = [
        makeMemory({ title: 'Same Title' }),
        makeMemory({ title: 'Same Title' }),
        makeMemory({ title: 'Same Title' }),
      ];
      const report = calculateHealth(memories);
      // 3 with same title = 2 duplicates
      expect(report.breakdown.dupeCount).toBe(2);
      expect(report.breakdown.dupePenalty).toBe(10);
    });

    it('gives bonus for pinned memories', () => {
      const memories = [
        makeMemory({ status: MemoryStatus.Pinned }),
        makeMemory({ status: MemoryStatus.Pinned }),
      ];
      const report = calculateHealth(memories);
      expect(report.breakdown.pinnedCount).toBe(2);
      expect(report.breakdown.pinnedBonus).toBe(4);
    });

    it('gives bonus for links', () => {
      const memories = [
        makeMemory({ links: ['mem-1', 'mem-2', 'mem-3'] }),
      ];
      const report = calculateHealth(memories);
      expect(report.breakdown.linksCount).toBe(3);
      expect(report.breakdown.linksBonus).toBe(1.5);
    });

    it('penalizes low score memories', () => {
      const memories = [
        makeMemory({ effective_score: 1.5 }),
        makeMemory({ effective_score: 2.0 }),
      ];
      const report = calculateHealth(memories);
      expect(report.breakdown.lowScoreCount).toBe(2);
      expect(report.breakdown.lowScorePenalty).toBe(2);
    });

    it('clamps score to 0-100 range', () => {
      // Many stale duplicates should not go below 0
      const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const memories = Array.from({ length: 50 }, () =>
        makeMemory({ accessed: staleDate, title: 'Dupe', effective_score: 0.5 })
      );
      const report = calculateHealth(memories);
      expect(report.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getHealthRange', () => {
    it('classifies correctly', () => {
      expect(getHealthRange(100)).toBe(HealthRange.Healthy);
      expect(getHealthRange(80)).toBe(HealthRange.Healthy);
      expect(getHealthRange(79)).toBe(HealthRange.Attention);
      expect(getHealthRange(60)).toBe(HealthRange.Attention);
      expect(getHealthRange(59)).toBe(HealthRange.Alert);
      expect(getHealthRange(40)).toBe(HealthRange.Alert);
      expect(getHealthRange(39)).toBe(HealthRange.Critical);
      expect(getHealthRange(0)).toBe(HealthRange.Critical);
    });
  });

  describe('healthGauge', () => {
    it('shows visual bar', () => {
      const gauge = healthGauge(85);
      expect(gauge).toContain('█');
      expect(gauge).toContain('░');
      expect(gauge).toContain('85');
      expect(gauge).toContain('Saudavel');
    });
  });

  describe('healthRangeLabel', () => {
    it('returns Portuguese labels', () => {
      expect(healthRangeLabel(HealthRange.Healthy)).toBe('Saudavel');
      expect(healthRangeLabel(HealthRange.Critical)).toBe('Critico');
    });
  });
});
