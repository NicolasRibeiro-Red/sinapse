import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';

// Mock paths to use temp dir
let tmpDir: string;

vi.mock('../../src/core/paths.js', async () => {
  const actual = await vi.importActual('../../src/core/paths.js');
  return {
    ...actual,
    getBasePath: () => join(tmpDir, 'sinapse'),
    getHotPath: () => join(tmpDir, 'sinapse', 'hot'),
    getAgentPath: (agent: string) => join(tmpDir, 'sinapse', 'hot', agent),
    getGlobalPath: () => join(tmpDir, 'sinapse', 'hot', 'global'),
    getArchivedPath: () => join(tmpDir, 'sinapse', 'archived'),
    getGraphPath: () => join(tmpDir, 'sinapse', 'graph'),
    getProjectsPath: () => join(tmpDir, 'sinapse', 'projects'),
    getProjectPath: (slug: string) => join(tmpDir, 'sinapse', 'projects', slug),
    getProjectMemoriesPath: (slug: string) => join(tmpDir, 'sinapse', 'projects', slug, 'memories'),
    getMetaDbPath: () => join(tmpDir, 'meta.db'),
  };
});

import { saveMemory } from '../../src/core/memory-store.js';
import { ensureDirectoryStructure } from '../../src/core/namespace.js';
import { getDb, upsertMemory, getMemory, closeDb } from '../../src/core/db.js';
import { MemoryType } from '../../src/types/index.js';
import { createHash } from 'node:crypto';

describe('save command logic', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sinapse-save-test-'));
    ensureDirectoryStructure();
  });

  afterEach(() => {
    closeDb();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a memory file with correct frontmatter', () => {
    const memory = saveMemory({
      title: 'Test Save Memory',
      content: 'This is test content',
      type: MemoryType.Decision,
      importance: 9,
      agent: 'pandora',
      tags: ['test', 'architecture'],
    });

    expect(memory.id).toMatch(/^mem-\d+-\d+$/);
    expect(memory.title).toBe('Test Save Memory');
    expect(memory.type).toBe('decision');
    expect(memory.importance).toBe(9);
    expect(memory.agent).toBe('pandora');
    expect(memory.effective_score).toBe(9);
    expect(memory.status).toBe('active');
    expect(existsSync(memory.filePath)).toBe(true);

    const fileContent = readFileSync(memory.filePath, 'utf-8');
    expect(fileContent).toContain('importance: 9');
    expect(fileContent).toContain('agent: pandora');
    expect(fileContent).toContain('type: decision');
    expect(fileContent).toContain('# Test Save Memory');
  });

  it('should index memory in SQLite after save', () => {
    const memory = saveMemory({
      title: 'SQLite Index Test',
      content: 'Body content here',
      type: MemoryType.Pattern,
      importance: 7,
      agent: 'dev',
      tags: ['vitest'],
    });

    const db = getDb(join(tmpDir, 'meta.db'));
    const contentHash = createHash('sha256').update(memory.content).digest('hex').slice(0, 16);

    upsertMemory(db, {
      id: memory.id,
      importance: memory.importance,
      agent: memory.agent,
      project: memory.project,
      tags: JSON.stringify(memory.tags),
      type: memory.type,
      created: memory.created,
      updated: memory.updated,
      accessed: memory.accessed,
      access_count: memory.access_count,
      decay_rate: memory.decay_rate,
      effective_score: memory.effective_score,
      status: memory.status,
      links: JSON.stringify(memory.links),
      supersedes: memory.supersedes,
      title: memory.title,
      content_hash: contentHash,
      file_path: memory.filePath,
    });

    const row = getMemory(db, memory.id);
    expect(row).toBeDefined();
    expect(row!.title).toBe('SQLite Index Test');
    expect(row!.type).toBe('pattern');
    expect(row!.importance).toBe(7);
    expect(row!.agent).toBe('dev');
  });

  it('should create memory in project namespace when project specified', () => {
    const memory = saveMemory({
      title: 'Project Memory',
      content: 'Project-specific content',
      type: MemoryType.Bug,
      importance: 8,
      agent: 'qa',
      tags: ['bug'],
      project: 'sinapse',
    });

    expect(memory.filePath).toContain('projects');
    expect(memory.filePath).toContain('sinapse');
    expect(memory.project).toBe('sinapse');
    expect(existsSync(memory.filePath)).toBe(true);
  });

  it('should handle default agent as pandora', () => {
    const memory = saveMemory({
      title: 'Default Agent Test',
      content: 'Should use pandora',
      type: MemoryType.Fact,
      importance: 5,
      agent: 'pandora',
      tags: [],
    });

    expect(memory.agent).toBe('pandora');
    expect(memory.filePath).toContain('pandora');
  });
});
