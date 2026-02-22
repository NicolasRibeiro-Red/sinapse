import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseMemoryFile,
  serializeMemory,
  generateMemoryId,
  resetSeqCounter,
  contentHash,
  memoryFrontmatterSchema,
} from '../../src/core/frontmatter.js';
import { MemoryStatus, MemoryType } from '../../src/types/index.js';

describe('Frontmatter', () => {
  beforeEach(() => {
    resetSeqCounter();
  });

  describe('generateMemoryId', () => {
    it('generates unique IDs with correct format', () => {
      const id1 = generateMemoryId();
      const id2 = generateMemoryId();
      expect(id1).toMatch(/^mem-\d+-\d+$/);
      expect(id2).toMatch(/^mem-\d+-\d+$/);
      expect(id1).not.toBe(id2);
    });

    it('sequence increments', () => {
      const id1 = generateMemoryId();
      const id2 = generateMemoryId();
      const seq1 = parseInt(id1.split('-')[2]!);
      const seq2 = parseInt(id2.split('-')[2]!);
      expect(seq2).toBe(seq1 + 1);
    });
  });

  describe('parseMemoryFile', () => {
    it('parses valid frontmatter + content', () => {
      const content = `---
id: mem-1708000000000-0
importance: 8
agent: dev
project: sinapse
tags: [architecture, design]
type: decision
created: 2026-02-22T00:00:00.000Z
updated: 2026-02-22T00:00:00.000Z
accessed: 2026-02-22T00:00:00.000Z
access_count: 0
decay_rate: 0.995
effective_score: 8
status: active
links: []
supersedes: null
---

# Use SQLite for metadata

We decided to use SQLite for fast indexed queries.`;

      const result = parseMemoryFile(content);
      expect(result.frontmatter.id).toBe('mem-1708000000000-0');
      expect(result.frontmatter.importance).toBe(8);
      expect(result.frontmatter.agent).toBe('dev');
      expect(result.frontmatter.project).toBe('sinapse');
      expect(result.frontmatter.tags).toEqual(['architecture', 'design']);
      expect(result.frontmatter.type).toBe('decision');
      expect(result.title).toBe('Use SQLite for metadata');
      expect(result.content).toContain('We decided to use SQLite');
    });

    it('rejects invalid frontmatter', () => {
      const content = `---
id: invalid-id-format
importance: 15
---

# Bad`;

      expect(() => parseMemoryFile(content)).toThrow('Invalid frontmatter');
    });

    it('rejects importance out of range', () => {
      const content = `---
id: mem-1708000000000-0
importance: -1
agent: dev
type: decision
created: 2026-02-22T00:00:00.000Z
updated: 2026-02-22T00:00:00.000Z
accessed: 2026-02-22T00:00:00.000Z
---

# Test`;

      expect(() => parseMemoryFile(content)).toThrow();
    });

    it('rejects invalid type', () => {
      const content = `---
id: mem-1708000000000-0
importance: 5
agent: dev
type: invalid_type
created: 2026-02-22T00:00:00.000Z
updated: 2026-02-22T00:00:00.000Z
accessed: 2026-02-22T00:00:00.000Z
---

# Test`;

      expect(() => parseMemoryFile(content)).toThrow();
    });
  });

  describe('serializeMemory', () => {
    it('produces valid markdown with frontmatter', () => {
      const memory = {
        id: 'mem-1708000000000-0',
        importance: 7,
        agent: 'jarvis',
        project: null,
        tags: ['test'],
        type: MemoryType.Insight,
        created: '2026-02-22T00:00:00.000Z',
        updated: '2026-02-22T00:00:00.000Z',
        accessed: '2026-02-22T00:00:00.000Z',
        access_count: 0,
        decay_rate: 0.995,
        effective_score: 7,
        status: MemoryStatus.Active,
        links: [],
        supersedes: null,
        title: 'Test memory',
        content: 'Some content here.',
      };

      const result = serializeMemory(memory);
      expect(result).toContain('---');
      expect(result).toContain('id: mem-1708000000000-0');
      expect(result).toContain('importance: 7');
      expect(result).toContain('# Test memory');
      expect(result).toContain('Some content here.');
    });

    it('roundtrips correctly', () => {
      const memory = {
        id: 'mem-1708000000000-0',
        importance: 9,
        agent: 'qa',
        project: 'sinapse',
        tags: ['bug', 'critical'],
        type: MemoryType.Bug,
        created: '2026-02-22T00:00:00.000Z',
        updated: '2026-02-22T00:00:00.000Z',
        accessed: '2026-02-22T00:00:00.000Z',
        access_count: 3,
        decay_rate: 0.998,
        effective_score: 8.5,
        status: MemoryStatus.Active,
        links: ['mem-1708000000000-1'],
        supersedes: null,
        title: 'SQLite WAL lock issue',
        content: 'Under high concurrency, WAL mode can cause SQLITE_BUSY.',
      };

      const serialized = serializeMemory(memory);
      const parsed = parseMemoryFile(serialized);

      expect(parsed.frontmatter.id).toBe(memory.id);
      expect(parsed.frontmatter.importance).toBe(memory.importance);
      expect(parsed.frontmatter.agent).toBe(memory.agent);
      expect(parsed.frontmatter.tags).toEqual(memory.tags);
      expect(parsed.title).toBe(memory.title);
      expect(parsed.content).toContain('WAL mode');
    });
  });

  describe('contentHash', () => {
    it('produces consistent hashes', () => {
      const hash1 = contentHash('hello world');
      const hash2 = contentHash('hello world');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('different content produces different hashes', () => {
      const hash1 = contentHash('hello');
      const hash2 = contentHash('world');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Zod schema', () => {
    it('validates all memory types', () => {
      for (const type of Object.values(MemoryType)) {
        const result = memoryFrontmatterSchema.safeParse({
          id: 'mem-1708000000000-0',
          importance: 5,
          agent: 'dev',
          type,
          created: '2026-02-22T00:00:00.000Z',
          updated: '2026-02-22T00:00:00.000Z',
          accessed: '2026-02-22T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
      }
    });

    it('validates all memory statuses', () => {
      for (const status of Object.values(MemoryStatus)) {
        const result = memoryFrontmatterSchema.safeParse({
          id: 'mem-1708000000000-0',
          importance: 5,
          agent: 'dev',
          type: 'decision',
          status,
          created: '2026-02-22T00:00:00.000Z',
          updated: '2026-02-22T00:00:00.000Z',
          accessed: '2026-02-22T00:00:00.000Z',
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
