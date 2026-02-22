-- Sinapse SQLite Schema
-- WAL mode, FTS5 for future search

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  importance INTEGER NOT NULL DEFAULT 5,
  agent TEXT NOT NULL DEFAULT 'jarvis',
  project TEXT,
  tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  type TEXT NOT NULL DEFAULT 'context',
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  accessed TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  decay_rate REAL NOT NULL DEFAULT 0.995,
  effective_score REAL NOT NULL DEFAULT 5.0,
  status TEXT NOT NULL DEFAULT 'active',
  links TEXT NOT NULL DEFAULT '[]',          -- JSON array
  supersedes TEXT,
  title TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS code_graph_nodes (
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  imports TEXT NOT NULL DEFAULT '[]',         -- JSON array
  exports TEXT NOT NULL DEFAULT '[]',         -- JSON array
  definitions TEXT NOT NULL DEFAULT '[]',     -- JSON array
  pagerank REAL NOT NULL DEFAULT 0.0,
  project TEXT NOT NULL,
  PRIMARY KEY (path, project)
);

CREATE TABLE IF NOT EXISTS code_graph_edges (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'static',
  project TEXT NOT NULL,
  PRIMARY KEY (source, target, project)
);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score REAL NOT NULL,
  range TEXT NOT NULL,
  breakdown TEXT NOT NULL DEFAULT '{}',      -- JSON
  total_memories INTEGER NOT NULL DEFAULT 0,
  agent TEXT,
  project TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consolidation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  steps TEXT NOT NULL DEFAULT '[]',          -- JSON array
  health_before REAL NOT NULL DEFAULT 0,
  health_after REAL NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_effective_score ON memories(effective_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON memories(accessed);
CREATE INDEX IF NOT EXISTS idx_memories_agent_project ON memories(agent, project);
CREATE INDEX IF NOT EXISTS idx_memories_status_score ON memories(status, effective_score DESC);
CREATE INDEX IF NOT EXISTS idx_code_graph_nodes_project ON code_graph_nodes(project);
CREATE INDEX IF NOT EXISTS idx_code_graph_nodes_pagerank ON code_graph_nodes(pagerank DESC);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_project ON code_graph_edges(project);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON health_snapshots(timestamp);
