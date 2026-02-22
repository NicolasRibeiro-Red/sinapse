import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  initDb, closeDb, upsertMemory, upsertMemoryBatch,
  getMemory, deleteMemory, queryMemories, getAllMemories,
  updateMemoryScore, getMemoryStats, insertHealthSnapshot,
  getLatestHealthSnapshot, getHealthHistory,
} from '../../src/core/db.js';
import type { MemoryRow } from '../../src/types/index.js';

function makeRow(id: string, overrides: Partial<MemoryRow> = {}): MemoryRow {
  return {
    id,
    importance: 7,
    agent: 'dev',
    project: 'test',
    tags: '["test"]',
    type: 'decision',
    created: '2026-02-22T00:00:00.000Z',
    updated: '2026-02-22T00:00:00.000Z',
    accessed: '2026-02-22T00:00:00.000Z',
    access_count: 0,
    decay_rate: 0.995,
    effective_score: 7,
    status: 'active',
    links: '[]',
    supersedes: null,
    title: `Memory ${id}`,
    content_hash: 'abc123',
    file_path: `/tmp/${id}.md`,
    ...overrides,
  };
}

describe('Database', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sinapse-test-'));
    dbPath = join(tmpDir, 'test.db');
    // Reset the singleton
    closeDb();
  });

  afterEach(() => {
    closeDb();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes database with schema', () => {
    const db = initDb(dbPath);
    // Check tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);
    expect(names).toContain('memories');
    expect(names).toContain('code_graph_nodes');
    expect(names).toContain('code_graph_edges');
    expect(names).toContain('health_snapshots');
    expect(names).toContain('consolidation_runs');
  });

  it('upserts and retrieves memory', () => {
    const db = initDb(dbPath);
    const row = makeRow('mem-1');
    upsertMemory(db, row);
    const result = getMemory(db, 'mem-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('mem-1');
    expect(result!.importance).toBe(7);
  });

  it('batch upserts memories', () => {
    const db = initDb(dbPath);
    const rows = [makeRow('mem-1'), makeRow('mem-2'), makeRow('mem-3')];
    upsertMemoryBatch(db, rows);
    const all = getAllMemories(db);
    expect(all).toHaveLength(3);
  });

  it('deletes memory', () => {
    const db = initDb(dbPath);
    upsertMemory(db, makeRow('mem-1'));
    deleteMemory(db, 'mem-1');
    expect(getMemory(db, 'mem-1')).toBeUndefined();
  });

  it('queries with filters', () => {
    const db = initDb(dbPath);
    upsertMemoryBatch(db, [
      makeRow('mem-1', { agent: 'dev', type: 'decision' }),
      makeRow('mem-2', { agent: 'qa', type: 'bug' }),
      makeRow('mem-3', { agent: 'dev', type: 'bug' }),
    ]);

    const devOnly = queryMemories(db, { agent: 'dev' });
    expect(devOnly).toHaveLength(2);

    const bugsOnly = queryMemories(db, { type: 'bug' as any });
    expect(bugsOnly).toHaveLength(2);

    const devBugs = queryMemories(db, { agent: 'dev', type: 'bug' as any });
    expect(devBugs).toHaveLength(1);
  });

  it('filters by minimum score', () => {
    const db = initDb(dbPath);
    upsertMemoryBatch(db, [
      makeRow('mem-1', { effective_score: 8 }),
      makeRow('mem-2', { effective_score: 3 }),
      makeRow('mem-3', { effective_score: 5 }),
    ]);

    const highScore = queryMemories(db, { minScore: 5 });
    expect(highScore).toHaveLength(2);
  });

  it('updates memory score', () => {
    const db = initDb(dbPath);
    upsertMemory(db, makeRow('mem-1', { effective_score: 7 }));
    updateMemoryScore(db, 'mem-1', 3.5, 'decayed');
    const result = getMemory(db, 'mem-1');
    expect(result!.effective_score).toBeCloseTo(3.5);
    expect(result!.status).toBe('decayed');
  });

  it('gets memory stats', () => {
    const db = initDb(dbPath);
    upsertMemoryBatch(db, [
      makeRow('mem-1', { agent: 'dev', type: 'decision' }),
      makeRow('mem-2', { agent: 'qa', type: 'bug' }),
    ]);

    const stats = getMemoryStats(db);
    expect(stats.total).toBe(2);
    expect(stats.byAgent).toHaveLength(2);
    expect(stats.byType).toHaveLength(2);
  });

  it('manages health snapshots', () => {
    const db = initDb(dbPath);

    insertHealthSnapshot(db, {
      score: 85,
      range: 'healthy',
      breakdown: '{}',
      total_memories: 10,
      agent: null,
      project: null,
      timestamp: '2026-02-22T00:00:00.000Z',
    });

    insertHealthSnapshot(db, {
      score: 72,
      range: 'attention',
      breakdown: '{}',
      total_memories: 15,
      agent: null,
      project: null,
      timestamp: '2026-02-22T01:00:00.000Z',
    });

    const latest = getLatestHealthSnapshot(db);
    expect(latest!.score).toBe(72);

    const history = getHealthHistory(db, 10);
    expect(history).toHaveLength(2);
    expect(history[0]!.score).toBe(72); // Most recent first
  });
});
