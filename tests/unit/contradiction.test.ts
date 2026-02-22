import { describe, it, expect } from 'vitest';
import { detectPotentialContradictions } from '../../src/intelligence/contradiction.js';
import { MemoryStatus, MemoryType } from '../../src/types/index.js';
import type { SinapseMemory } from '../../src/types/index.js';

function makeMem(overrides: Partial<SinapseMemory> = {}): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id: `mem-${Date.now()}-${Math.random()}`,
    importance: 7,
    agent: 'dev',
    project: 'test',
    tags: ['architecture'],
    type: MemoryType.Decision,
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    decay_rate: 0.995,
    effective_score: 7,
    status: MemoryStatus.Active,
    links: [],
    supersedes: null,
    title: 'Test',
    content: 'Content',
    filePath: '/tmp/test.md',
    ...overrides,
  };
}

describe('Contradiction Detection', () => {
  it('finds contradictions between different agents on same project with overlapping tags', () => {
    const memories = [
      makeMem({ agent: 'dev', project: 'app', tags: ['auth'], type: MemoryType.Decision, title: 'Use JWT' }),
      makeMem({ agent: 'architect', project: 'app', tags: ['auth'], type: MemoryType.Decision, title: 'Use sessions' }),
    ];

    const pairs = detectPotentialContradictions(memories);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.type).toBe('context-context');
  });

  it('ignores same agent (unlikely to contradict itself)', () => {
    const memories = [
      makeMem({ agent: 'dev', project: 'app', tags: ['auth'], type: MemoryType.Decision }),
      makeMem({ agent: 'dev', project: 'app', tags: ['auth'], type: MemoryType.Decision }),
    ];

    const pairs = detectPotentialContradictions(memories);
    expect(pairs).toHaveLength(0);
  });

  it('ignores different projects', () => {
    const memories = [
      makeMem({ agent: 'dev', project: 'app-a', tags: ['auth'], type: MemoryType.Decision }),
      makeMem({ agent: 'architect', project: 'app-b', tags: ['auth'], type: MemoryType.Decision }),
    ];

    const pairs = detectPotentialContradictions(memories);
    expect(pairs).toHaveLength(0);
  });

  it('ignores non-overlapping tags', () => {
    const memories = [
      makeMem({ agent: 'dev', project: 'app', tags: ['auth'], type: MemoryType.Decision }),
      makeMem({ agent: 'architect', project: 'app', tags: ['database'], type: MemoryType.Decision }),
    ];

    const pairs = detectPotentialContradictions(memories);
    expect(pairs).toHaveLength(0);
  });

  it('ignores different types', () => {
    const memories = [
      makeMem({ agent: 'dev', project: 'app', tags: ['auth'], type: MemoryType.Decision }),
      makeMem({ agent: 'architect', project: 'app', tags: ['auth'], type: MemoryType.Bug }),
    ];

    const pairs = detectPotentialContradictions(memories);
    expect(pairs).toHaveLength(0);
  });

  it('returns empty for no memories', () => {
    expect(detectPotentialContradictions([])).toHaveLength(0);
  });
});
