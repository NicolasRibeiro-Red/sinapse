# Sinapse v2 — Arquitetura Completa (4 Camadas)

**Data**: 2026-02-21
**Status**: Design aprovado, pre-implementacao
**Decisao arquitetural**: Protocolo + CLI + Hooks (nao MCP Server)
**DR**: `decisions/DR-2026-02-21-1500-sinapse-arquitetura.md`

---

## Visao Geral

Sinapse e um sistema de context management e memoria inteligente para agentes AI.
Nao e um server — e um **protocolo de organizacao** + **CLI tool** + **hooks** + **LLM nativo**.

```
╔══════════════════════════════════════════════════════════════════════╗
║  SINAPSE v2 — 4 CAMADAS                                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  CAMADA 1: INGESTAO (ETL automatico)                                ║
║  Auto-parseia projeto: code graph, deps, git log, config files      ║
║  Gera "project DNA" de ~1K tokens (PageRank/Aider-style)           ║
║                                                                      ║
║  CAMADA 2: MEMORIA (protocolo + storage)                            ║
║  Frontmatter YAML, importance scoring, decay, temporal graph,       ║
║  cross-agent namespaces, health check                               ║
║                                                                      ║
║  CAMADA 3: INTELIGENCIA (LLM-powered)                              ║
║  Pre-exploration, compression, contradiction detection,             ║
║  pattern promotion, context curation                                ║
║                                                                      ║
║  CAMADA 4: CONSOLIDACAO (sleep-time compute)                        ║
║  Background: merge dupes, decay stale, promove padroes,             ║
║  atualiza code graph, health report, reorganiza KG                  ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## Camada 1: Ingestao (ETL Automatico)

### O que faz
Ao entrar num projeto, Sinapse automaticamente extrai e indexa a estrutura:

### Pipeline de ingestao
```
  Projeto detectado (cd /path/to/project)
    │
    ├─ package.json / pyproject.toml / Cargo.toml → deps + scripts
    ├─ tsconfig.json / .eslintrc → config do projeto
    ├─ .env.example → variaveis de ambiente
    ├─ git log --oneline -20 → decisoes recentes
    ├─ tree-sitter AST → code graph (files, imports, exports)
    ├─ PageRank sobre code graph → top files rankeados
    ├─ CLAUDE.md / README → contexto explicito
    │
    ▼
  "Project DNA" (~1K tokens)
    - Stack: Next.js 14, Supabase, TypeScript
    - Entrypoints: src/app/page.tsx, src/lib/api.ts
    - Top files (PageRank): auth.ts (0.92), db.ts (0.87), ...
    - Deps criticas: @supabase/ssr, next-auth
    - Decisoes recentes: "migrate AssemblyAI V2→V3"
    - Padroes: server components, RLS auth, Edge functions
```

### Implementacao
- **tree-sitter**: Parser AST multi-linguagem (JS/TS/Python/Rust)
- **PageRank simplificado**: Nodes = files, edges = imports. Top 20 files = contexto essencial
- **Output**: `memory/sinapse/projects/{project-slug}/dna.md` com frontmatter
- **Refresh**: Ao detectar git changes (hook session-start)

### Referencia
- Aider repo map: 1K tokens = repo inteiro, 4-6% de utilizacao do context window
- Augment Code: "Context is the new compiler"

---

## Camada 2: Memoria (Protocolo + Storage)

### Protocolo Frontmatter YAML

Toda memoria segue este formato:

```yaml
---
id: mem-{timestamp}-{seq}
importance: 0-10           # Claude atribui ao criar
agent: jarvis|dev|qa|...   # namespace do agente criador
project: salesflow|null     # projeto associado
tags: [tag1, tag2]
type: decision|pattern|bug|insight|context|fact
created: ISO-8601
updated: ISO-8601
accessed: ISO-8601
access_count: 0
decay_rate: 0.995           # por hora (padrao Ebbinghaus)
effective_score: float      # importance × recency_factor (calculado)
status: active|decayed|archived|pinned
links: [mem-id-1, mem-id-2] # graph temporal
supersedes: mem-id|null     # se substitui uma memoria anterior
---

# Titulo descritivo

Conteudo da memoria em markdown livre.
```

### Campos especiais
- **pinned**: status que impede decay (decisoes arquiteturais criticas)
- **supersedes**: quando uma memoria substitui outra (evita contradicoes)
- **type**: permite filtrar por natureza (ex: so decisions, so bugs)

### Estrutura de diretorios

```
memory/sinapse/
├── hot/                    # Memorias ativas, high-score
│   ├── global/             # Acessivel por todos os agentes
│   ├── jarvis/             # Namespace Jarvis
│   ├── dev/                # Namespace @dev
│   ├── qa/                 # Namespace @qa
│   ├── architect/          # Namespace @architect
│   └── {agent}/            # Qualquer agente futuro
├── projects/               # DNA de projetos
│   ├── salesflow/
│   │   ├── dna.md          # Project DNA (PageRank)
│   │   └── memories/       # Memorias especificas do projeto
│   └── {project}/
├── archived/               # Memorias decayed (consultaveis)
├── graph/                  # Indice de relacoes (links)
│   └── index.json          # {id: [links], ...}
└── meta.db                 # SQLite: indices, stats, decay tracking
```

### Decay Engine (Ebbinghaus Adaptativo)

```
effective_score = importance × (decay_rate ^ horas_desde_acesso)

Ao acessar uma memoria:
  - access_count += 1
  - accessed = now()
  - decay_rate ajusta: min(0.999, decay_rate + 0.001)
    (quanto mais acessa, mais lento o decay — como cerebro humano)

Thresholds:
  - effective_score < 3.0 → status: decayed, move pra archived/
  - effective_score < 1.0 → elegivel pra GC (delete)
  - status: pinned → nunca decai
```

### Health Score (0-100)

```
health = 100
  - (memorias_sem_acesso_7d × 2)      # stale content penalty
  - (duplicatas_detectadas × 5)         # contradiction risk
  - (idade_media_dias × 0.5)           # freshness bonus inverso
  - (memorias_low_score × 1)           # noise penalty
  + (memorias_pinned × 2)              # stability bonus
  + (links_count × 0.5)                # connectivity bonus

Ranges:
  80-100: Saudavel
  60-79:  Atencao (limpeza recomendada)
  40-59:  Alerta (consolidacao urgente)
  0-39:   Critico (contexto comprometido)
```

---

## Camada 3: Inteligencia (LLM-Powered)

### Pre-Exploration (OpenSage pattern)
Antes de um agente agir num task complexo:
1. Sub-agente scout explora codebase relevante
2. Scout popula memoria com findings (com frontmatter, scored)
3. Agente principal comeca com contexto ja curado

### Compression (pre-compact)
Antes da compaction do Claude Code:
1. Hook pre-compact dispara
2. Claude analisa contexto atual
3. Extrai: decisoes, estado, variaveis criticas, next steps
4. Salva como memorias com importance alto
5. Descarta: tool outputs, tentativas falhadas, ruido

### Contradiction Detection
Ao carregar memorias pra um agente:
1. Claude verifica se memorias carregadas se contradizem
2. Se sim: flagga, resolve (supersedes), ou pergunta ao usuario
3. Tipos: context-memory (memoria vs realidade) e context-context (memorias entre si)

### Pattern Promotion
```
Observado 1x → insight (importance base)
Observado 2x → pattern (importance +2)
Observado 3x → rule (importance +3, pinned)
```

---

## Camada 4: Consolidacao (Sleep-Time Compute)

### Trigger
- Manual: `/sinapse clean` ou `/wrap-up`
- Automatico: cron daily ou hook session-stop

### Pipeline de consolidacao
```
  1. sinapse decay          → Recalcula effective_scores
  2. sinapse gc             → Move decayed pra archived, deleta <1.0
  3. Merge duplicatas       → Claude identifica, merge, supersedes
  4. Promove padroes        → 2+ ocorrencias → pattern, 3+ → rule
  5. Atualiza code graph    → Se repo mudou, re-parseia tree-sitter
  6. Atualiza graph/index   → Reconstroi indice de links
  7. sinapse health         → Gera health report
  8. sinapse stats          → Metricas atualizadas
```

### Metricas rastreadas
- Total memorias (por agent, por project, por type)
- Decay rate medio
- Health score historico (trend)
- Top entities (mais linkadas)
- Coverage gaps (projetos sem memorias recentes)

---

## Stack Tecnico

```
Runtime:        Node.js (TypeScript) — CLI tool
Parser:         tree-sitter (code graph, AST)
Storage:        Markdown files (human-readable, git-friendly)
Index:          SQLite (meta.db) — so pra queries rapidas
Graph:          JSON index + markdown links (nao precisa Neo4j)
Hooks:          Claude Code hooks (pre-compact, session-start, session-stop)
Skill:          /sinapse (interativo)
LLM:            Claude Code nativo (scoring, compression, validation)
Localizacao:    memory/sinapse/ (dentro do memory path existente)
CLI:            sinapse (global command ou npx)
```

---

## Integracao com Ecossistema Existente

```
┌─────────────────────────┬──────────────────────────────────────────┐
│ Componente existente    │ Como Sinapse integra                     │
├─────────────────────────┼──────────────────────────────────────────┤
│ memory/MEMORY.md        │ Continua existindo. Sinapse e adicional  │
│ memory/signals/         │ Sinapse consome como input de metricas   │
│ memory/learnings/       │ Promovidos automaticamente pelo Sinapse  │
│ memory/knowledge/       │ Migra pra sinapse/graph/ gradualmente    │
│ memory/agents/          │ Namespaces em sinapse/hot/{agent}/       │
│ jarvis-context.md       │ Sinapse atualiza via hooks               │
│ Hooks existentes        │ Sinapse adiciona logica nos hooks        │
│ Darkness MCP            │ Coexistem: Darkness=decisao, Sinapse=ctx │
│ CLAUDE.md               │ Instrucoes de quando/como usar Sinapse   │
│ Skills                  │ Nova skill /sinapse                      │
│ AIOS agents             │ Cada agente tem namespace em sinapse/    │
└─────────────────────────┴──────────────────────────────────────────┘
```

---

## Fases de Implementacao

### Fase 1: Protocolo + Skill (1-2 dias)
- Definir frontmatter YAML spec
- Criar estrutura de diretorios sinapse/
- Skill /sinapse com comandos basicos
- Regras no CLAUDE.md pra agentes seguirem protocolo
- Claude comeca a salvar memorias com frontmatter

### Fase 2: CLI + Hooks (2-3 dias)
- sinapse CLI: decay, health, stats, gc
- Hook pre-compact: Claude comprime + CLI health
- Hook session-start: Claude carrega memorias relevantes
- Hook session-stop: Claude salva resumo
- SQLite meta.db pra indices

### Fase 3: Ingestao + Code Graph (2-3 dias)
- tree-sitter parser (JS/TS inicialmente)
- PageRank simplificado sobre grafo de imports
- Project DNA generator
- Auto-refresh em session-start

### Fase 4: Inteligencia + Consolidacao (2-3 dias)
- Pre-exploration (sub-agente scout)
- Contradiction detection
- Pattern promotion automatica
- Consolidation pipeline completo
- Sleep-time compute (cron ou wrap-up trigger)

### Fase 5: Dashboard + Polish (1-2 dias)
- Health trends visuais
- Stats historicos
- Integration test end-to-end

**Total estimado: ~10 dias de trabalho focado**

---

## Diferenciais vs Competidores

| Nos (Sinapse v2) | Pedro/Alan/Finch AIOS | Mercado (Mem0, Letta, etc) |
|---|---|---|
| 4 camadas integradas | ETL + plugin | 1-2 capabilities cada |
| Code graph (PageRank) | ? | So Aider tem (separado) |
| Research-backed (80+ fontes) | Experiencia propria | Papers individuais |
| Decay Ebbinghaus | ? | So FadeMem/Mem0 |
| Pre-exploration (OpenSage) | ? | So SWE-Bench research |
| Sleep-time compute | ? | So Letta |
| Health monitoring | ? | So context-rot-detection |
| Filesystem-first (Letta-proven) | APIs/ETL | Vector stores |
| Zero infra (CLI + hooks) | Server + APIs | Servers dedicados |
| Temporal graph (Graphiti-lite) | ? | So Zep (precisa Neo4j) |
