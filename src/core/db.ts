// Sinapse — SQLite Database Layer
// WAL mode, better-sqlite3, batch operations

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import type { MemoryRow, HealthSnapshotRow, ConsolidationRunRow, CodeGraphNodeRow, CodeGraphEdgeRow } from '../types/index.js';
import type { MemoryFilter } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_SCHEMA_PATH = join(__dirname, 'schema.sql');
const SRC_SCHEMA_PATH = join(__dirname, '..', '..', 'src', 'core', 'schema.sql');

let _db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (_db) return _db;
  return initDb(dbPath);
}

export function initDb(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Try dist/ first (npm linked), then src/ (dev)
  let schemaSQL: string;
  if (existsSync(DIST_SCHEMA_PATH)) {
    schemaSQL = readFileSync(DIST_SCHEMA_PATH, 'utf-8');
  } else if (existsSync(SRC_SCHEMA_PATH)) {
    schemaSQL = readFileSync(SRC_SCHEMA_PATH, 'utf-8');
  } else {
    throw new Error(`Schema file not found at ${DIST_SCHEMA_PATH} or ${SRC_SCHEMA_PATH}`);
  }

  db.exec(schemaSQL);
  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ─── Memory CRUD ────────────────────────────────────────────

export function upsertMemory(db: Database.Database, row: MemoryRow): void {
  const stmt = db.prepare(`
    INSERT INTO memories (id, importance, agent, project, tags, type, created, updated, accessed, access_count, decay_rate, effective_score, status, links, supersedes, title, content_hash, file_path)
    VALUES (@id, @importance, @agent, @project, @tags, @type, @created, @updated, @accessed, @access_count, @decay_rate, @effective_score, @status, @links, @supersedes, @title, @content_hash, @file_path)
    ON CONFLICT(id) DO UPDATE SET
      importance = @importance,
      agent = @agent,
      project = @project,
      tags = @tags,
      type = @type,
      updated = @updated,
      accessed = @accessed,
      access_count = @access_count,
      decay_rate = @decay_rate,
      effective_score = @effective_score,
      status = @status,
      links = @links,
      supersedes = @supersedes,
      title = @title,
      content_hash = @content_hash,
      file_path = @file_path
  `);
  stmt.run(row);
}

export function upsertMemoryBatch(db: Database.Database, rows: MemoryRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO memories (id, importance, agent, project, tags, type, created, updated, accessed, access_count, decay_rate, effective_score, status, links, supersedes, title, content_hash, file_path)
    VALUES (@id, @importance, @agent, @project, @tags, @type, @created, @updated, @accessed, @access_count, @decay_rate, @effective_score, @status, @links, @supersedes, @title, @content_hash, @file_path)
    ON CONFLICT(id) DO UPDATE SET
      importance = @importance,
      agent = @agent,
      project = @project,
      tags = @tags,
      type = @type,
      updated = @updated,
      accessed = @accessed,
      access_count = @access_count,
      decay_rate = @decay_rate,
      effective_score = @effective_score,
      status = @status,
      links = @links,
      supersedes = @supersedes,
      title = @title,
      content_hash = @content_hash,
      file_path = @file_path
  `);
  const transaction = db.transaction((rows: MemoryRow[]) => {
    for (const row of rows) {
      stmt.run(row);
    }
  });
  transaction(rows);
}

export function getMemory(db: Database.Database, id: string): MemoryRow | undefined {
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
}

export function deleteMemory(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
}

export function deleteMemoryBatch(db: Database.Database, ids: string[]): void {
  const transaction = db.transaction((ids: string[]) => {
    const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
    for (const id of ids) {
      stmt.run(id);
    }
  });
  transaction(ids);
}

export function queryMemories(db: Database.Database, filter: MemoryFilter): MemoryRow[] {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.agent) {
    conditions.push('agent = @agent');
    params['agent'] = filter.agent;
  }
  if (filter.project) {
    conditions.push('project = @project');
    params['project'] = filter.project;
  }
  if (filter.type) {
    conditions.push('type = @type');
    params['type'] = filter.type;
  }
  if (filter.status) {
    conditions.push('status = @status');
    params['status'] = filter.status;
  }
  if (filter.minScore !== undefined) {
    conditions.push('effective_score >= @minScore');
    params['minScore'] = filter.minScore;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit ? `LIMIT ${filter.limit}` : '';

  const sql = `SELECT * FROM memories ${where} ORDER BY effective_score DESC ${limit}`;
  return db.prepare(sql).all(params) as MemoryRow[];
}

export function getAllMemories(db: Database.Database): MemoryRow[] {
  return db.prepare('SELECT * FROM memories ORDER BY effective_score DESC').all() as MemoryRow[];
}

export function updateMemoryScore(db: Database.Database, id: string, effectiveScore: number, status: string): void {
  db.prepare('UPDATE memories SET effective_score = ?, status = ?, updated = ? WHERE id = ?')
    .run(effectiveScore, status, new Date().toISOString(), id);
}

export function updateMemoryAccess(db: Database.Database, id: string, decayRate: number): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE memories SET accessed = ?, access_count = access_count + 1, decay_rate = ?, updated = ? WHERE id = ?')
    .run(now, decayRate, now, id);
}

// ─── Health Snapshots ───────────────────────────────────────

export function insertHealthSnapshot(db: Database.Database, snapshot: Omit<HealthSnapshotRow, 'id'>): void {
  db.prepare(`
    INSERT INTO health_snapshots (score, range, breakdown, total_memories, agent, project, timestamp)
    VALUES (@score, @range, @breakdown, @total_memories, @agent, @project, @timestamp)
  `).run(snapshot);
}

export function getLatestHealthSnapshot(db: Database.Database): HealthSnapshotRow | undefined {
  return db.prepare('SELECT * FROM health_snapshots ORDER BY timestamp DESC LIMIT 1').get() as HealthSnapshotRow | undefined;
}

export function getHealthHistory(db: Database.Database, limit = 10): HealthSnapshotRow[] {
  return db.prepare('SELECT * FROM health_snapshots ORDER BY timestamp DESC LIMIT ?').all(limit) as HealthSnapshotRow[];
}

// ─── Consolidation Runs ─────────────────────────────────────

export function insertConsolidationRun(db: Database.Database, run: Omit<ConsolidationRunRow, 'id'>): void {
  db.prepare(`
    INSERT INTO consolidation_runs (steps, health_before, health_after, total_duration, timestamp)
    VALUES (@steps, @health_before, @health_after, @total_duration, @timestamp)
  `).run(run);
}

// ─── Code Graph ─────────────────────────────────────────────

export function upsertCodeGraphNode(db: Database.Database, row: CodeGraphNodeRow): void {
  db.prepare(`
    INSERT INTO code_graph_nodes (path, language, imports, exports, definitions, pagerank, project)
    VALUES (@path, @language, @imports, @exports, @definitions, @pagerank, @project)
    ON CONFLICT(path, project) DO UPDATE SET
      language = @language,
      imports = @imports,
      exports = @exports,
      definitions = @definitions,
      pagerank = @pagerank
  `).run(row);
}

export function upsertCodeGraphNodeBatch(db: Database.Database, rows: CodeGraphNodeRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO code_graph_nodes (path, language, imports, exports, definitions, pagerank, project)
    VALUES (@path, @language, @imports, @exports, @definitions, @pagerank, @project)
    ON CONFLICT(path, project) DO UPDATE SET
      language = @language, imports = @imports, exports = @exports,
      definitions = @definitions, pagerank = @pagerank
  `);
  const transaction = db.transaction((rows: CodeGraphNodeRow[]) => {
    for (const row of rows) stmt.run(row);
  });
  transaction(rows);
}

export function upsertCodeGraphEdgeBatch(db: Database.Database, rows: CodeGraphEdgeRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO code_graph_edges (source, target, type, project)
    VALUES (@source, @target, @type, @project)
    ON CONFLICT(source, target, project) DO UPDATE SET type = @type
  `);
  const transaction = db.transaction((rows: CodeGraphEdgeRow[]) => {
    for (const row of rows) stmt.run(row);
  });
  transaction(rows);
}

export function getCodeGraphNodes(db: Database.Database, project: string): CodeGraphNodeRow[] {
  return db.prepare('SELECT * FROM code_graph_nodes WHERE project = ? ORDER BY pagerank DESC').all(project) as CodeGraphNodeRow[];
}

export function clearCodeGraph(db: Database.Database, project: string): void {
  db.prepare('DELETE FROM code_graph_nodes WHERE project = ?').run(project);
  db.prepare('DELETE FROM code_graph_edges WHERE project = ?').run(project);
}

// ─── Stats ──────────────────────────────────────────────────

export function getMemoryStats(db: Database.Database) {
  const total = (db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }).count;
  const byAgent = db.prepare('SELECT agent, COUNT(*) as count FROM memories GROUP BY agent').all() as Array<{ agent: string; count: number }>;
  const byType = db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type').all() as Array<{ type: string; count: number }>;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM memories GROUP BY status').all() as Array<{ status: string; count: number }>;
  const byProject = db.prepare('SELECT project, COUNT(*) as count FROM memories WHERE project IS NOT NULL GROUP BY project').all() as Array<{ project: string; count: number }>;
  const avgScore = (db.prepare('SELECT AVG(effective_score) as avg FROM memories').get() as { avg: number | null }).avg ?? 0;
  const avgDecayRate = (db.prepare('SELECT AVG(decay_rate) as avg FROM memories').get() as { avg: number | null }).avg ?? 0;

  return { total, byAgent, byType, byStatus, byProject, avgScore, avgDecayRate };
}
