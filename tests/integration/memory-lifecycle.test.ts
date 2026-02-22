// Integration test: Memory lifecycle
// Create → read → access → decay score → delete

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { parseMemoryFile, serializeMemory, generateMemoryId } from '../../src/core/frontmatter.js';
import { calculateEffectiveScore } from '../../src/core/decay.js';
import { MemoryStatus } from '../../src/types/index.js';
import type { SinapseMemory } from '../../src/types/index.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';

const TMP = join(process.cwd(), 'tests', '_tmp_e2e_lifecycle');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('Memory Lifecycle E2E', () => {
  let memory: SinapseMemory;
  let filePath: string;

  it('creates a memory with valid frontmatter', () => {
    const id = generateMemoryId();
    const now = new Date().toISOString();

    memory = {
      id,
      title: 'E2E Test Decision',
      type: 'decision',
      importance: 8,
      effective_score: 8,
      decay_rate: DEFAULT_CONFIG.decay.defaultRate,
      status: MemoryStatus.Active,
      agent: 'dev',
      project: 'test-project',
      tags: ['architecture', 'e2e'],
      created: now,
      updated: now,
      accessed: now,
      access_count: 0,
      links: [],
      supersedes: null,
      content: 'Decided to use SQLite for metadata storage.',
      filePath: '',
    };

    filePath = join(TMP, `${id}.md`);
    const serialized = serializeMemory(memory);
    writeFileSync(filePath, serialized, 'utf-8');

    expect(existsSync(filePath)).toBe(true);
    expect(id).toMatch(/^mem-/);
  });

  it('reads and parses saved memory correctly', () => {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseMemoryFile(content);

    expect(parsed.title).toBe('E2E Test Decision');
    expect(parsed.frontmatter.type).toBe('decision');
    expect(parsed.frontmatter.importance).toBe(8);
    expect(parsed.frontmatter.tags).toContain('architecture');
    expect(parsed.frontmatter.status).toBe('active');
  });

  it('simulates access and updates decay_rate', () => {
    memory.access_count += 1;
    memory.accessed = new Date().toISOString();
    memory.decay_rate = Math.min(
      DEFAULT_CONFIG.decay.maxRate,
      memory.decay_rate + DEFAULT_CONFIG.decay.accessBoost,
    );

    const serialized = serializeMemory(memory);
    writeFileSync(filePath, serialized, 'utf-8');

    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseMemoryFile(content);
    expect(parsed.frontmatter.access_count).toBe(1);
    expect(parsed.frontmatter.decay_rate).toBeGreaterThanOrEqual(0.995);
  });

  it('calculates effective score correctly', () => {
    const hoursSince = (Date.now() - new Date(memory.accessed).getTime()) / 3600000;
    const score = calculateEffectiveScore(
      memory.importance,
      memory.decay_rate,
      hoursSince,
    );
    // Fresh memory should have score close to importance
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThanOrEqual(memory.importance);
  });

  it('simulates archival by changing status', () => {
    memory.status = MemoryStatus.Archived;
    memory.updated = new Date().toISOString();

    const serialized = serializeMemory(memory);
    writeFileSync(filePath, serialized, 'utf-8');

    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseMemoryFile(content);
    expect(parsed.frontmatter.status).toBe('archived');
  });

  it('deletes memory file', () => {
    unlinkSync(filePath);
    expect(existsSync(filePath)).toBe(false);
  });
});
