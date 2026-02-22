import { describe, it, expect } from 'vitest';
import { findPromotionCandidates, promoteMemory } from '../../src/intelligence/promotion.js';
import { MemoryStatus, MemoryType } from '../../src/types/index.js';
import type { SinapseMemory } from '../../src/types/index.js';

function makeMem(overrides: Partial<SinapseMemory> = {}): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id: `mem-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    importance: 5,
    agent: 'dev',
    project: 'test',
    tags: ['patterns', 'typescript'],
    type: MemoryType.Insight,
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    decay_rate: 0.995,
    effective_score: 5,
    status: MemoryStatus.Active,
    links: [],
    supersedes: null,
    title: 'Test',
    content: 'Content',
    filePath: '/tmp/test.md',
    ...overrides,
  };
}

describe('Pattern Promotion', () => {
  describe('findPromotionCandidates', () => {
    it('finds candidates with 2+ occurrences', () => {
      const memories = [
        makeMem({ tags: ['auth', 'pattern'] }),
        makeMem({ tags: ['auth', 'pattern'] }),
      ];

      const candidates = findPromotionCandidates(memories);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.suggestedLevel).toBe('pattern');
      expect(candidates[0]!.importanceBoost).toBe(2);
    });

    it('suggests rule for 3+ occurrences', () => {
      const memories = [
        makeMem({ tags: ['auth'] }),
        makeMem({ tags: ['auth'] }),
        makeMem({ tags: ['auth'] }),
      ];

      const candidates = findPromotionCandidates(memories);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.suggestedLevel).toBe('rule');
      expect(candidates[0]!.importanceBoost).toBe(3);
    });

    it('ignores single occurrences', () => {
      const memories = [
        makeMem({ tags: ['unique1'] }),
        makeMem({ tags: ['unique2'] }),
      ];

      const candidates = findPromotionCandidates(memories);
      expect(candidates).toHaveLength(0);
    });

    it('ignores already pinned memories', () => {
      const memories = [
        makeMem({ tags: ['auth'], status: MemoryStatus.Pinned }),
        makeMem({ tags: ['auth'], status: MemoryStatus.Pinned }),
      ];

      const candidates = findPromotionCandidates(memories);
      expect(candidates).toHaveLength(0);
    });

    it('groups by tags AND type', () => {
      const memories = [
        makeMem({ tags: ['auth'], type: MemoryType.Decision }),
        makeMem({ tags: ['auth'], type: MemoryType.Bug }),
        makeMem({ tags: ['auth'], type: MemoryType.Decision }),
      ];

      const candidates = findPromotionCandidates(memories);
      // Only decisions group has 2
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.type).toBe(MemoryType.Decision);
    });
  });

  describe('promoteMemory', () => {
    it('promotes to pattern (importance +2)', () => {
      const mem = makeMem({ importance: 5, effective_score: 5 });
      const promoted = promoteMemory(mem, 'pattern');

      expect(promoted.importance).toBe(7);
      expect(promoted.type).toBe(MemoryType.Pattern);
      expect(promoted.tags).toContain('promoted');
      expect(promoted.status).not.toBe(MemoryStatus.Pinned);
    });

    it('promotes to rule (importance +3, pinned)', () => {
      const mem = makeMem({ importance: 6, effective_score: 6 });
      const promoted = promoteMemory(mem, 'rule');

      expect(promoted.importance).toBe(9);
      expect(promoted.type).toBe(MemoryType.Pattern);
      expect(promoted.status).toBe(MemoryStatus.Pinned);
      expect(promoted.tags).toContain('promoted');
    });

    it('caps importance at 10', () => {
      const mem = makeMem({ importance: 9 });
      const promoted = promoteMemory(mem, 'rule');
      expect(promoted.importance).toBe(10);
    });
  });
});
