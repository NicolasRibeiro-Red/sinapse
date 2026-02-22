// Sinapse — Core Types
// Covers all 4 layers: Ingestion, Memory, Intelligence, Consolidation

// ─── Enums ───────────────────────────────────────────────────

export enum MemoryStatus {
  Active = 'active',
  Decayed = 'decayed',
  Archived = 'archived',
  Pinned = 'pinned',
}

export enum MemoryType {
  Decision = 'decision',
  Pattern = 'pattern',
  Bug = 'bug',
  Insight = 'insight',
  Context = 'context',
  Fact = 'fact',
}

export enum HealthRange {
  Healthy = 'healthy',     // 80-100
  Attention = 'attention', // 60-79
  Alert = 'alert',         // 40-59
  Critical = 'critical',   // 0-39
}

export enum ConsolidationStep {
  Decay = 'decay',
  GC = 'gc',
  MergeDupes = 'merge_dupes',
  PromotePatterns = 'promote_patterns',
  Ingest = 'ingest',
  Graph = 'graph',
  Health = 'health',
}

// ─── Memory (Layer 2) ───────────────────────────────────────

export interface SinapseMemory {
  id: string;                        // mem-{timestamp}-{seq}
  importance: number;                // 0-10, Claude assigns
  agent: string;                     // jarvis|dev|qa|...
  project: string | null;           // project slug or null
  tags: string[];
  type: MemoryType;
  created: string;                   // ISO-8601
  updated: string;                   // ISO-8601
  accessed: string;                  // ISO-8601
  access_count: number;
  decay_rate: number;                // default 0.995
  effective_score: number;           // importance * decay factor
  status: MemoryStatus;
  links: string[];                   // mem-id references
  supersedes: string | null;         // mem-id replaced
  title: string;                     // heading from content
  content: string;                   // markdown body
  filePath: string;                  // absolute path to .md file
}

export interface MemoryCreateInput {
  importance: number;
  agent: string;
  project?: string | null;
  tags: string[];
  type: MemoryType;
  links?: string[];
  supersedes?: string | null;
  title: string;
  content: string;
}

export interface MemoryFilter {
  agent?: string;
  project?: string;
  type?: MemoryType;
  status?: MemoryStatus;
  minScore?: number;
  tags?: string[];
  limit?: number;
}

// ─── Health (Layer 2) ───────────────────────────────────────

export interface HealthBreakdown {
  staleCount: number;       // memories not accessed in 7d
  stalePenalty: number;
  dupeCount: number;        // potential duplicates
  dupePenalty: number;
  avgAgeDays: number;
  agePenalty: number;
  lowScoreCount: number;    // effective_score < 3
  lowScorePenalty: number;
  pinnedCount: number;
  pinnedBonus: number;
  linksCount: number;
  linksBonus: number;
}

export interface HealthReport {
  score: number;            // 0-100
  range: HealthRange;
  breakdown: HealthBreakdown;
  totalMemories: number;
  agent?: string;
  project?: string;
  timestamp: string;
}

// ─── Decay (Layer 2) ───────────────────────────────────────

export interface DecayConfig {
  defaultRate: number;      // 0.995
  accessBoost: number;      // 0.001
  maxRate: number;          // 0.999
  archiveThreshold: number; // 3.0
  gcThreshold: number;      // 1.0
}

export interface DecayResult {
  totalProcessed: number;
  updated: number;
  archived: number;
  gcEligible: number;
}

// ─── Code Graph (Layer 1 — Ingestion) ───────────────────────

export interface CodeGraphNode {
  id: string;              // relative file path
  path: string;            // absolute path
  language: string;        // ts | js
  imports: string[];       // resolved file paths
  exports: string[];       // export names
  definitions: string[];   // function/class names
  pagerank: number;        // 0-1 normalized
}

export interface CodeGraphEdge {
  source: string;          // file path (importer)
  target: string;          // file path (imported)
  type: 'static' | 'dynamic';
}

export interface ImportGraph {
  nodes: Map<string, CodeGraphNode>;
  edges: CodeGraphEdge[];
}

// ─── Project DNA (Layer 1) ──────────────────────────────────

export interface ProjectDNA {
  slug: string;
  name: string;
  stack: string[];           // detected technologies
  entrypoints: string[];     // main entry files
  topFiles: Array<{ path: string; pagerank: number }>;
  dependencies: Record<string, string>;  // critical deps
  recentDecisions: string[];  // from git log
  patterns: string[];         // detected patterns
  generatedAt: string;
  gitHead: string;            // cache key
  tokenEstimate: number;
}

// ─── Intelligence (Layer 3) ─────────────────────────────────

export interface ScoutResult {
  findings: MemoryCreateInput[];
  filesExplored: number;
  timeMs: number;
}

export interface CompressionCategory {
  name: string;                 // decisions, work_state, bugs, next_steps
  defaultImportance: number;
  promptTemplate: string;
}

export interface ContradictionPair {
  memoryA: string;  // mem-id
  memoryB: string;  // mem-id
  type: 'context-memory' | 'context-context';
  description: string;
}

export interface PromotionCandidate {
  memoryIds: string[];
  tags: string[];
  type: MemoryType;
  occurrences: number;
  currentLevel: 'insight' | 'pattern' | 'rule';
  suggestedLevel: 'pattern' | 'rule';
  importanceBoost: number;
}

// ─── Consolidation (Layer 4) ────────────────────────────────

export interface ConsolidationStepResult {
  step: ConsolidationStep;
  status: 'success' | 'skipped' | 'error';
  duration: number;         // ms
  details: Record<string, unknown>;
}

export interface ConsolidationReport {
  steps: ConsolidationStepResult[];
  healthBefore: number;
  healthAfter: number;
  totalDuration: number;    // ms
  timestamp: string;
}

// ─── Graph Index ────────────────────────────────────────────

export interface GraphIndex {
  nodes: Record<string, string[]>;  // id → [linked ids]
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

// ─── SQLite Row Types ───────────────────────────────────────

export interface MemoryRow {
  id: string;
  importance: number;
  agent: string;
  project: string | null;
  tags: string;              // JSON string
  type: string;
  created: string;
  updated: string;
  accessed: string;
  access_count: number;
  decay_rate: number;
  effective_score: number;
  status: string;
  links: string;             // JSON string
  supersedes: string | null;
  title: string;
  content_hash: string;
  file_path: string;
}

export interface CodeGraphNodeRow {
  path: string;
  language: string;
  imports: string;           // JSON string
  exports: string;           // JSON string
  definitions: string;       // JSON string
  pagerank: number;
  project: string;
}

export interface CodeGraphEdgeRow {
  source: string;
  target: string;
  type: string;
  project: string;
}

export interface HealthSnapshotRow {
  id: number;
  score: number;
  range: string;
  breakdown: string;         // JSON string
  total_memories: number;
  agent: string | null;
  project: string | null;
  timestamp: string;
}

export interface ConsolidationRunRow {
  id: number;
  steps: string;             // JSON string
  health_before: number;
  health_after: number;
  total_duration: number;
  timestamp: string;
}
