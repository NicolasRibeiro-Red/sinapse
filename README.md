# Sinapse

Context management and intelligent memory system for AI agents.

## Overview

Sinapse is a 4-layer system that gives AI agents persistent, intelligent memory:

1. **Ingestion** — Scans codebases, builds import graphs, runs PageRank, generates Project DNA (~1K token project representation)
2. **Memory** — Frontmatter YAML protocol with Ebbinghaus adaptive decay, importance scoring, and health monitoring
3. **Intelligence** — Pre-exploration scouting, compression prompts, contradiction detection, pattern promotion
4. **Consolidation** — 7-step pipeline: decay → gc → merge dupes → promote patterns → ingest → graph → health

## Architecture

Protocol + CLI + Hooks. Not an MCP server — Sinapse operates as a protocol that AI agents follow, backed by a CLI for maintenance and hooks for automation.

## Quick Start

```bash
npm install
npm run build

# Index existing memories
npx sinapse index

# Ingest a project (scan → parse → graph → pagerank → DNA)
npx sinapse ingest /path/to/project

# Check health
npx sinapse health

# Visual dashboard
npx sinapse dashboard

# Run consolidation (decay + gc + health + graph)
npx sinapse consolidate
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sinapse index` | Scan and index all memory files into SQLite |
| `sinapse ingest [path]` | Full pipeline: scan → parse → graph → pagerank → DNA |
| `sinapse dashboard` | Unified visual dashboard (health, stats, DNA status) |
| `sinapse health` | Calculate context health score (0-100) |
| `sinapse stats` | Aggregate memory statistics |
| `sinapse list` | List memories with filters |
| `sinapse decay` | Apply Ebbinghaus decay to all memories |
| `sinapse gc` | Garbage collect memories below threshold |
| `sinapse consolidate` | Run full 7-step consolidation pipeline |
| `sinapse graph` | Build and save memory graph index |
| `sinapse graph-viz` | Generate Mermaid diagram of memory graph |
| `sinapse export` | Export all memories to JSON |

### Global Flags

- `--verbose` — Detailed output
- `--json` — JSON output (for programmatic use)

### Common Filters

```bash
sinapse list --agent dev --type decision --min-score 5
sinapse health --project my-project
sinapse stats --agent qa
```

## Memory Protocol

Memories are Markdown files with YAML frontmatter:

```yaml
---
id: mem-1708000000000-0
importance: 8
agent: dev
project: my-project
tags: [architecture, database]
type: decision
created: 2026-02-22T10:00:00.000Z
updated: 2026-02-22T10:00:00.000Z
accessed: 2026-02-22T10:00:00.000Z
access_count: 3
decay_rate: 0.996
effective_score: 7.8
status: active
links: [mem-1707000000000-0]
supersedes: null
---

# Database Architecture Decision

Decided to use SQLite with WAL mode for metadata storage...
```

### Memory Types

| Type | When to save |
|------|-------------|
| `decision` | Architectural choices, technology selections |
| `pattern` | Recurring solutions, confirmed approaches |
| `bug` | Bugs found and their fixes |
| `insight` | Non-obvious learnings |
| `context` | Project state, work-in-progress |
| `fact` | Stable reference information |

### Importance Scale (0-10)

| Score | Level | Example |
|-------|-------|---------|
| 9-10 | Critical | Core architecture decisions |
| 7-8 | High | Significant patterns, important bugs |
| 5-6 | Medium | Useful insights, standard context |
| 3-4 | Low | Minor facts, temporary context |
| 0-2 | Minimal | Ephemeral notes |

## Decay System

Ebbinghaus-inspired adaptive decay:

```
effective_score = importance × (decay_rate ^ hours_since_access)
```

- Default decay rate: 0.995
- Each access boosts decay rate by 0.001 (max 0.999)
- Score < 3.0 → archived
- Score < 1.0 → garbage collected (except pinned)
- Pinned memories never decay

## Health Score

Formula: `100 - penalties + bonuses`

| Factor | Weight | Direction |
|--------|--------|-----------|
| Stale (7d+ not accessed) | ×2 per memory | Penalty |
| Duplicates | ×5 per dupe | Penalty |
| Average age | ×0.5 per day | Penalty |
| Low score (<3.0) | ×1 per memory | Penalty |
| Pinned | ×2 per memory | Bonus |
| Links | ×0.5 per link | Bonus |

Ranges: Healthy (80+), Attention (60-79), Alert (40-59), Critical (<40)

## Ingestion Pipeline

The `ingest` command runs a full analysis of a codebase:

1. **File Scanner** — Finds all TS/JS files, respects .gitignore
2. **Parser** — Extracts imports, exports, and definitions (regex-based)
3. **Import Graph** — Builds directed graph (nodes=files, edges=imports)
4. **PageRank** — Calculates centrality scores (damping 0.85, convergence 1e-6)
5. **Project DNA** — Generates ~1K token representation with stack, top files, dependencies

Results are cached by git HEAD hash. Use `--force` to re-parse.

## Intelligence Layer

The intelligence layer generates prompts for LLM-powered operations:

- **Scout** — Pre-exploration prompt for unfamiliar areas (>3 files)
- **Compression** — Categorized prompts for session compression (decisions, bugs, work state, next steps)
- **Contradiction** — Detects potential conflicts between memories (same project, different agents, overlapping tags)
- **Promotion** — Promotes recurring patterns: 1x→insight, 2x→pattern (+2 importance), 3x→rule (+3, pinned)

## Tech Stack

- TypeScript (strict, ESM)
- Commander (CLI)
- better-sqlite3 (WAL mode)
- gray-matter + Zod (frontmatter)
- Vitest (tests)

## Development

```bash
npm install
npm run build        # TypeScript compilation
npm run typecheck    # Type checking only
npm run lint         # ESLint
npm test             # Run all tests
```

## Project Structure

```
src/
├── cli/
│   ├── index.ts              # CLI entry point
│   └── commands/             # 12 CLI commands
├── core/
│   ├── db.ts                 # SQLite operations
│   ├── decay.ts              # Ebbinghaus decay engine
│   ├── frontmatter.ts        # YAML parse/serialize + Zod validation
│   ├── graph.ts              # Memory graph index
│   ├── health.ts             # Health score calculator
│   ├── importance.ts         # Importance criteria + promotion levels
│   ├── memory-store.ts       # High-level memory operations
│   ├── namespace.ts          # Directory structure + project detection
│   ├── paths.ts              # Path constants
│   ├── consolidation.ts      # 7-step pipeline
│   └── schema.sql            # SQLite schema
├── ingest/
│   ├── file-scanner.ts       # TS/JS file discovery
│   ├── parser.ts             # Import/export extraction
│   ├── import-graph.ts       # Directed import graph
│   ├── pagerank.ts           # PageRank calculator
│   ├── project-dna.ts        # Project DNA generator
│   └── cache.ts              # Git HEAD-based cache
├── intelligence/
│   ├── scout.ts              # Pre-exploration prompts
│   ├── compression.ts        # Session compression prompts
│   ├── contradiction.ts      # Contradiction detection
│   └── promotion.ts          # Pattern promotion engine
└── types/
    ├── index.ts              # All interfaces + enums
    └── config.ts             # Configuration types + defaults
```

## License

MIT
