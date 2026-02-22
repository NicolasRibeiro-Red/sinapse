# Sinapse — Product Requirements Document

**Versao**: 1.0
**Data**: 2026-02-22
**Autor**: Nicolas Ribeiro
**Status**: Aprovado para implementacao

---

## 1. Visao do Produto

### O Problema

**Inteligencia nao e mais o gargalo — contexto e.**

Agentes AI degradam em sessoes longas. O contexto acumula informacao obsoleta, contradicoes, e ruido ate que o agente perde coerencia. Isso se chama **Context Rot** e causa:

- **34% de degradacao** em performance (Chroma Research, 18 modelos SOTA)
- **Lost in the Middle**: modelos ignoram o meio do contexto (Stanford 2023)
- **Attention Dilution**: 100K tokens = 10 bilhoes de relacoes pra processar
- **Hallucination Snowball**: erros iniciais propagam em cadeia

Nenhuma ferramenta atual resolve isso de forma integrada. Cada competidor ataca 1-2 pedacos do problema. Sinapse ataca todos.

### A Solucao

Sinapse e um **sistema de context management e memoria inteligente** para agentes AI. Nao e um server — e um **protocolo de organizacao** + **CLI tool** + **hooks de automacao** que usa o LLM nativo do Claude Code pra operacoes inteligentes.

O resultado: cada agente comeca a sessao com as memorias certas, no peso certo, sem lixo — e o sistema se auto-limpa com o tempo.

### Tese

> Curadoria supera acesso livre. Menos contexto de alta qualidade > mais contexto generico.
>
> — Confirmado por: Aider (1K tokens = repo inteiro), OpenSage (memorias irrelevantes PIORAM performance), Letta Context-Bench (filesystem 74% > vector stores)

---

## 2. Publico-Alvo

**Primario**: O ecossistema Synkra AIOS — Jarvis + todos os agentes (@dev, @qa, @architect, etc.) operando em projetos do Nicolas.

**Secundario**: Qualquer usuario avancado de Claude Code que queira memoria persistente e inteligente entre sessoes.

---

## 3. Arquitetura — 4 Camadas

A decisao arquitetural foi: **Protocolo + CLI + Hooks** (nao MCP Server).
Referencia completa: `decisions/DR-2026-02-21-1500-sinapse-arquitetura.md`

### Rationale
- 4 de 10 capabilities precisam de LLM (ja disponivel no Claude Code)
- MCP Server seria intermediario sem inteligencia propria
- Filesystem > vector stores (Letta Context-Bench: 74%)
- Reversivel: pode adicionar MCP como wrapper no futuro

### Diagrama das 4 Camadas

```
╔══════════════════════════════════════════════════════════════╗
║  CAMADA 1: INGESTAO (ETL automatico)                        ║
║  Parse de projeto: code graph, deps, git log, configs       ║
║  Gera "Project DNA" (~1K tokens via PageRank)               ║
╠══════════════════════════════════════════════════════════════╣
║  CAMADA 2: MEMORIA (protocolo + storage)                    ║
║  Frontmatter YAML, importance scoring, decay engine,        ║
║  temporal graph, cross-agent namespaces, health check       ║
╠══════════════════════════════════════════════════════════════╣
║  CAMADA 3: INTELIGENCIA (LLM-powered)                       ║
║  Pre-exploration, compression, contradiction detection,     ║
║  pattern promotion, context curation                        ║
╠══════════════════════════════════════════════════════════════╣
║  CAMADA 4: CONSOLIDACAO (sleep-time compute)                ║
║  Decay recalc, GC, merge duplicatas, promove padroes,       ║
║  atualiza code graph, health report                         ║
╚══════════════════════════════════════════════════════════════╝
```

### Divisao de Responsabilidades

| Operacao | Quem faz | Por que |
|----------|----------|---------|
| Importance scoring | Claude (LLM) | Entende contexto semantico |
| Compression | Claude (LLM) | Distingue sinal de ruido |
| Contradiction detection | Claude (LLM) | Raciocinio semantico |
| Recall + ranking | Claude (LLM) | Relevancia contextual |
| Merge duplicatas | Claude (LLM) | Similaridade semantica |
| Pattern promotion | Claude (LLM) | Reconhece padroes |
| Decay calculation | CLI (script) | Matematica pura |
| Stats / metricas | CLI (script) | Agregacao numerica |
| Health score | CLI (script) | Formula fixa |
| GC / cleanup | CLI (script) | Rules-based |
| Index / rebuild | CLI (script) | Parse → SQLite |
| Code graph (tree-sitter) | CLI (script) | AST parsing |
| PageRank | CLI (script) | Algebra linear |
| Project DNA | CLI + Claude | CLI parseia, Claude sintetiza |

---

## 4. Stack Tecnico

| Componente | Tecnologia | Justificativa |
|------------|-----------|---------------|
| Runtime | Node.js (TypeScript) | Ecossistema do Nicolas, compativel com Claude Code |
| Parser AST | tree-sitter (multi-lang) | Standard da industria pra code analysis (Aider, GitHub) |
| Storage | Markdown com frontmatter YAML | Human-readable, git-friendly, auditavel |
| Index | SQLite (meta.db) | Queries rapidas sem servidor, embeddable |
| Graph | JSON index + markdown wiki-links | Leve, sem Neo4j, suficiente pra single-user |
| Hooks | Claude Code hooks API | Integracao nativa (pre-compact, session-start, session-stop) |
| Skill | `/sinapse` (Claude Code skill) | Interface interativa pro usuario |
| LLM | Claude Code nativo | Ja disponivel, sem custo extra |
| CLI | `sinapse` (global command ou npx) | Operacoes mecanicas/matematicas |

---

## 5. Camada 1 — Ingestao (ETL Automatico)

### Objetivo
Ao entrar num projeto, extrair e indexar automaticamente a estrutura do codebase pra gerar um "Project DNA" compacto (~1K tokens) que represente o repo inteiro.

### Pipeline

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
  - Stack detectada (ex: Next.js 14, Supabase, TypeScript)
  - Entrypoints principais
  - Top 20 files por PageRank
  - Dependencias criticas
  - Decisoes recentes do git log
  - Padroes detectados
```

### Detalhes de Implementacao

**tree-sitter**:
- Linguagens iniciais: TypeScript e JavaScript (tree-sitter-typescript, tree-sitter-javascript)
- Extrair: import/export declarations, function/class definitions, file-level structure
- Nodes = arquivos, Edges = imports entre arquivos
- Libs de referencia: Aider usa tree-sitter pra repo map. Verificar implementacao deles em `aider/repomap.py`

**PageRank simplificado**:
- Grafo dirigido: arquivo A importa arquivo B = edge A→B
- Damping factor: 0.85 (padrao Google)
- Iteracoes: 20-50 (converge rapido em repos < 10K files)
- Output: ranking normalizado 0-1, top 20 files = Project DNA

**Armazenamento**:
- Output em `memory/sinapse/projects/{project-slug}/dna.md`
- Refresh: ao detectar mudancas no git (hook session-start compara HEAD)
- Cache: nao re-parsear se HEAD nao mudou

### Referencia
- Aider repo map: 1K tokens = repo inteiro, 4-6% de utilizacao do context window
- Augment Code: "Context is the new compiler"

---

## 6. Camada 2 — Memoria (Protocolo + Storage)

### Protocolo Frontmatter YAML

Toda memoria segue este formato padrao:

```yaml
---
id: mem-{timestamp}-{seq}
importance: 0-10             # Claude atribui ao criar
agent: jarvis|dev|qa|...     # namespace do agente criador
project: salesflow|null       # projeto associado (slug)
tags: [tag1, tag2]
type: decision|pattern|bug|insight|context|fact
created: ISO-8601
updated: ISO-8601
accessed: ISO-8601
access_count: 0
decay_rate: 0.995             # por hora (padrao Ebbinghaus)
effective_score: float        # importance * recency_factor (calculado pelo CLI)
status: active|decayed|archived|pinned
links: [mem-id-1, mem-id-2]  # graph temporal
supersedes: mem-id|null       # se substitui uma memoria anterior
---

# Titulo descritivo

Conteudo da memoria em markdown livre.
```

### Campos especiais
- **pinned**: status que impede decay (pra decisoes arquiteturais criticas)
- **supersedes**: quando uma memoria substitui outra (evita contradicoes)
- **type**: permite filtrar por natureza (ex: so decisions, so bugs)

### Criterios de Importance Scoring (Claude atribui)

| Criterio | Pontos |
|----------|--------|
| Afeta arquitetura do projeto | +3 |
| E um bug ou problema critico | +2 |
| Afeta mais de um projeto (cross-project) | +1 |
| Decisao irreversivel ou de alto custo | +3 |
| Padrao repetido (2+ ocorrencias) | +2 |
| Insight unico valioso | +1 |

Escala: 0 (trivial) a 10 (arquiteturalmente critico e irreversivel).

### Estrutura de Diretorios

```
memory/sinapse/
├── hot/                      # Memorias ativas, high-score
│   ├── global/               # Acessivel por todos os agentes
│   ├── jarvis/               # Namespace Jarvis
│   ├── dev/                  # Namespace @dev
│   ├── qa/                   # Namespace @qa
│   ├── architect/            # Namespace @architect
│   └── {agent}/              # Qualquer agente futuro
├── projects/                 # DNA e memorias por projeto
│   ├── {project-slug}/
│   │   ├── dna.md            # Project DNA (PageRank)
│   │   └── memories/         # Memorias especificas do projeto
│   └── ...
├── archived/                 # Memorias decayed (ainda consultaveis)
├── graph/
│   └── index.json            # Indice de relacoes {id: [links]}
└── meta.db                   # SQLite: indices, stats, decay tracking
```

### Decay Engine (Ebbinghaus Adaptativo)

**Formula**:
```
effective_score = importance × (decay_rate ^ horas_desde_ultimo_acesso)
```

**Ao acessar uma memoria**:
- `access_count += 1`
- `accessed = now()`
- `decay_rate = min(0.999, decay_rate + 0.001)` — quanto mais acessa, mais lento o decay

**Thresholds**:
| effective_score | Acao |
|-----------------|------|
| >= 3.0 | `status: active` — permanece em hot/ |
| < 3.0 | `status: decayed` — move pra archived/ |
| < 1.0 | Elegivel pra GC (delete) |
| pinned | Nunca decai, independente do score |

### Health Score (0-100)

**Formula**:
```
health = 100
  - (memorias_sem_acesso_7d × 2)        # stale penalty
  - (duplicatas_detectadas × 5)           # contradiction risk
  - (idade_media_dias × 0.5)             # freshness inverso
  - (memorias_low_score × 1)             # noise penalty
  + (memorias_pinned × 2)                # stability bonus
  + (links_count × 0.5)                  # connectivity bonus
```

**Ranges**:
| Score | Estado | Acao |
|-------|--------|------|
| 80-100 | Saudavel | Nenhuma |
| 60-79 | Atencao | Limpeza recomendada |
| 40-59 | Alerta | Consolidacao urgente |
| 0-39 | Critico | Contexto comprometido, intervencao necessaria |

---

## 7. Camada 3 — Inteligencia (LLM-Powered)

Estas operacoes sao feitas pelo Claude Code (LLM nativo), nao pelo CLI.

### 7.1 Pre-Exploration (OpenSage pattern)

Antes de um agente agir num task complexo:
1. Sub-agente scout (Task tool, tipo Explore) percorre codebase relevante
2. Scout popula memoria com findings (com frontmatter, scored)
3. Agente principal comeca com contexto ja curado

**Trigger**: Tarefas que afetam >3 arquivos ou envolvem partes desconhecidas do codebase.

### 7.2 Compression (pre-compact)

Antes da compaction do Claude Code (hook pre-compact):
1. Claude analisa contexto atual
2. Extrai itens criticos: decisoes, estado do trabalho, bugs, next steps
3. Salva cada item como memoria com frontmatter (importance alto)
4. Descarta: tool outputs verbosos, tentativas falhadas, ruido

**Resultado**: Informacoes criticas sobrevivem a compaction.

### 7.3 Contradiction Detection

Ao carregar memorias pra um agente:
1. Claude verifica se memorias carregadas se contradizem
2. Dois tipos:
   - **context-memory**: memoria diz X, realidade atual e Y
   - **context-context**: memoria A diz X, memoria B diz Y
3. Se detecta: flagga, resolve com `supersedes`, ou pergunta ao usuario

### 7.4 Pattern Promotion

```
Observado 1x → insight (importance base)
Observado 2x → pattern (importance + 2, type: pattern)
Observado 3x → rule (importance + 3, status: pinned, type: pattern)
```

Padroes pinned ficam permanentes e informam todos os agentes.

---

## 8. Camada 4 — Consolidacao (Sleep-Time Compute)

### Triggers
- Manual: `/sinapse clean` ou `/wrap-up`
- Automatico: hook session-stop
- Futuro: cron diario (se implementado)

### Pipeline de Consolidacao

```
1. sinapse decay
   → Recalcula effective_score de TODAS as memorias
   → Move score < 3.0 pra archived/
   → Flag score < 1.0 pra GC

2. sinapse gc
   → Deleta memorias com score < 1.0 (exceto pinned)

3. Claude merge duplicatas
   → Identifica memorias semanticamente similares
   → Merge em uma, preenche supersedes na antiga

4. Claude promove padroes
   → Varre memorias: 2+ ocorrencias → pattern, 3+ → rule (pinned)

5. sinapse ingest (se repo mudou)
   → Re-parseia code graph com tree-sitter
   → Recalcula PageRank
   → Atualiza Project DNA

6. sinapse graph
   → Reconstroi graph/index.json a partir dos links das memorias

7. sinapse health
   → Gera health report com score 0-100 e breakdown
```

---

## 9. CLI — Comandos

O CLI `sinapse` e uma ferramenta Node.js/TypeScript executavel via `npx` ou instalacao global.

| Comando | Descricao | Input | Output |
|---------|-----------|-------|--------|
| `sinapse decay` | Recalcula effective_scores, move decayed | — | N memorias atualizadas, M movidas |
| `sinapse health` | Health score 0-100 com breakdown | `--agent`, `--project` | Score + breakdown por fator |
| `sinapse stats` | Metricas agregadas | `--agent`, `--project` | Totais, medias, distribuicoes |
| `sinapse gc` | Garbage collect (delete score < 1.0) | `--dry-run` | N memorias deletadas |
| `sinapse consolidate` | Pipeline completo (decay+gc+health) | — | Report completo |
| `sinapse index` | Rebuild SQLite a partir dos frontmatters | — | N registros indexados |
| `sinapse graph` | Rebuild graph/index.json a partir dos links | — | N nodes, M edges |
| `sinapse ingest [path]` | Parse projeto, gera Project DNA | path (default: cwd) | DNA gerado em projects/{slug}/ |
| `sinapse list` | Lista memorias filtradas | `--agent`, `--project`, `--type`, `--min-score` | Lista formatada |
| `sinapse export` | Export tudo pra JSON (backup) | `--output` | Arquivo JSON |

### Flags Globais
- `--verbose`: Output detalhado
- `--json`: Output em JSON (pra integracao com scripts)
- `--dry-run`: Simula sem alterar (onde aplicavel)

---

## 10. Skill `/sinapse`

Interface interativa dentro do Claude Code.

| Subcomando | O que faz |
|------------|-----------|
| `/sinapse` | Status geral + health score |
| `/sinapse health` | Health score detalhado com breakdown |
| `/sinapse recall [query]` | Claude busca memorias por query semantica |
| `/sinapse stats` | Metricas + trends |
| `/sinapse clean` | Roda pipeline de consolidacao |
| `/sinapse graph` | Visualiza conexoes entre memorias |
| `/sinapse ingest` | Re-parseia projeto atual |

---

## 11. Hooks — Integracao com Claude Code

### session-start
- Detecta projeto atual (pwd, git remote)
- Roda `sinapse health` (score rapido)
- Carrega memorias relevantes:
  - Filtro: agent match (ou global), project match, status active/pinned, effective_score >= 5.0
  - Ordena: effective_score DESC
  - Limite: top 20 memorias
- Injeta no contexto do agente

### pre-compact
- Claude extrai info critica do contexto atual (decisoes, estado, bugs, next steps)
- Salva como memorias com frontmatter (importance alto)
- Roda `sinapse health` pra logar score pre-compact
- Compaction normal roda depois — info critica ja esta salva em arquivo

### session-stop
- Claude escreve resumo da sessao como memoria com frontmatter
- Roda `sinapse decay` (recalcula scores)
- Roda `sinapse stats` (metricas da sessao)

---

## 12. Integracao com Ecossistema Existente

| Componente atual | Como Sinapse integra |
|------------------|---------------------|
| `memory/MEMORY.md` | Continua existindo. Sinapse e adicional, nao substitui |
| `memory/signals/` | Sinapse consome como input de metricas |
| `memory/learnings/` | Promovidos automaticamente pelo pattern promotion |
| `memory/knowledge/entities/` | Migra gradualmente pra sinapse/graph/ (Strangler Fig) |
| `memory/agents/{name}/MEMORY.md` | Namespaces em sinapse/hot/{agent}/ |
| `jarvis-context.md` | Sinapse atualiza via hooks |
| Hooks existentes (4) | Sinapse adiciona logica aos hooks existentes |
| Darkness MCP | Coexistem: Darkness = decisao, Sinapse = contexto |
| CLAUDE.md | Adicionar instrucoes de quando/como usar Sinapse |
| Skills | Nova skill `/sinapse` |
| AIOS agents | Cada agente tem namespace proprio em sinapse/hot/{agent}/ |

### Migracao (Strangler Fig)
Nao migra tudo de uma vez. O sistema antigo continua funcionando. Sinapse opera em paralelo e absorve gradualmente:
1. **Fase 1**: Sinapse opera ao lado do sistema atual
2. **Fase 2**: Novos dados vao pro Sinapse, antigos permanecem
3. **Fase 3**: Dados antigos migrados conforme acessados
4. **Fase 4**: Sistema antigo desligado quando Sinapse cobre tudo

---

## 13. Fases de Implementacao

### Fase 1 — Protocolo + Skill (1-2 dias)

**Escopo**:
- Definir e implementar schema de frontmatter YAML (validacao)
- Criar estrutura de diretorios `memory/sinapse/`
- Skill `/sinapse` com comandos basicos (status, health simples, list)
- Regras no CLAUDE.md pra agentes seguirem o protocolo
- Claude comeca a salvar memorias com frontmatter

**Entregavel**: Agentes conseguem salvar e ler memorias com frontmatter padrao.

### Fase 2 — CLI + Hooks (2-3 dias)

**Escopo**:
- CLI `sinapse` com todos os comandos da secao 9
- SQLite meta.db com schema de indices
- Hooks: session-start, pre-compact, session-stop
- Decay engine completo (calculo, move, GC)
- Health score com formula e breakdown

**Entregavel**: Sistema de decay automatico, health monitoring, CLI funcional.

### Fase 3 — Ingestao + Code Graph (2-3 dias)

**Escopo**:
- tree-sitter parser para TypeScript e JavaScript
- Grafo de imports (files como nodes, imports como edges)
- PageRank simplificado sobre o grafo
- Project DNA generator (CLI parseia + Claude sintetiza)
- `sinapse ingest` funcional
- Auto-refresh via hook session-start (compara HEAD)

**Entregavel**: Qualquer projeto TS/JS gera Project DNA automaticamente.

### Fase 4 — Inteligencia + Consolidacao (2-3 dias)

**Escopo**:
- Pre-exploration pattern (sub-agente scout)
- Compression no pre-compact (Claude extrai e salva)
- Contradiction detection ao carregar memorias
- Pattern promotion automatica (1x→insight, 2x→pattern, 3x→rule)
- Pipeline de consolidacao completo (7 steps)
- Sleep-time compute no session-stop

**Entregavel**: Sistema inteligente que se auto-limpa e auto-organiza.

### Fase 5 — Dashboard + Polish (1-2 dias)

**Escopo**:
- `/sinapse` com dashboard visual (health trends, stats)
- Graph visualization (usar `/flow` como base)
- Integration tests end-to-end
- Documentacao final
- Performance tuning

**Entregavel**: Produto polido, testado, documentado.

**Total estimado: ~10 dias de trabalho focado.**

---

## 14. Diferenciais Competitivos

| Capability | Sinapse | Mem0 | Letta | Graphiti | Aider | Devin |
|------------|---------|------|-------|----------|-------|-------|
| Importance Scoring | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Selective Forgetting | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Temporal Graph | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Context Health | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cross-Agent Memory | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Code Graph/PageRank | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Auto Project ETL | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Pre-Exploration | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sleep-Time Compute | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Compression | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Contradiction Detect | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Pattern Promotion | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Human-Readable Store | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ |
| Zero Infra | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Research-Backed | ✓ (80+) | ✓ | ✓ | ✓ | ✗ | ✗ |
| **TOTAL** | **15/15** | **5** | **5** | **2** | **4** | **3** |

---

## 15. Restricoes e Trade-offs Aceitos

| Trade-off | Decisao | Razao |
|-----------|---------|-------|
| Sem real-time events | Aceito | Single-user, nao precisa pub/sub |
| Sem vector embeddings | Aceito | Filesystem > vectors (Letta Context-Bench: 74%) |
| Sem MCP Server | Aceito (reversivel) | LLM ja disponivel via Claude Code, MCP seria overhead |
| tree-sitter so TS/JS inicialmente | Aceito | Stack principal do Nicolas. Python/Rust depois |
| Sem UI web | Aceito | CLI + skill `/sinapse` + terminal e suficiente |
| SQLite local (nao distribuido) | Aceito | Single-user, sem necessidade de sync |

---

## 16. Criterios de Sucesso

| Metrica | Target |
|---------|--------|
| Agentes comecam sessao com contexto relevante | Top 20 memorias carregadas automaticamente |
| Informacao sobrevive a compaction | 100% das decisoes e bugs persistem |
| Contexto nao degrada em sessoes longas | Health score > 70 apos 8h+ de sessao |
| Project DNA e util | ~1K tokens representam repo inteiro |
| Decay funciona | Memorias stale somem apos ~7 dias sem acesso |
| Pattern promotion funciona | Padroes repetidos sao auto-detectados e pinned |
| Zero overhead pro usuario | Tudo automatico via hooks, interacao so quando quer |

---

## 17. Riscos

| Risco | Probabilidade | Mitigacao |
|-------|---------------|-----------|
| tree-sitter complexo de configurar | Media | Comecar so com TS/JS, usar libs prontas |
| Claude Code hooks API mudar | Baixa | Hooks sao simples (shell scripts), facil adaptar |
| Overhead de I/O (muitos .md files) | Baixa | SQLite index resolve queries, files sao lidos sob demanda |
| Frontmatter parse errado | Baixa | Validacao strict + fallback graceful |
| Conflito com sistema de memoria atual | Media | Strangler Fig: migra gradual, nao quebra nada |

---

## 18. Documentacao de Referencia

| Documento | Local | Conteudo |
|-----------|-------|---------|
| Arquitetura v2 | `design/architecture-v2.md` | Spec completa das 4 camadas |
| Como Funciona | `design/how-it-works.md` | Mecanica pratica, fluxos, exemplos |
| Matriz Comparativa | `design/comparison-matrix.md` | Sinapse vs 6 competidores |
| Decision Record | `decisions/DR-2026-02-21-1500-sinapse-arquitetura.md` | Decisao Protocol+CLI+Hooks |
| Research Completa | `research/2026-02-21-sinapse-research-completa.md` | 80+ fontes, 12 papers, 14 sistemas |

---

## 19. Glossario

| Termo | Definicao |
|-------|----------|
| **Context Rot** | Degradacao de performance do agente por contexto poluido/obsoleto |
| **Project DNA** | Representacao compacta (~1K tokens) de um repo inteiro via PageRank |
| **Decay Engine** | Sistema de esquecimento adaptativo baseado em Ebbinghaus |
| **effective_score** | Score calculado = importance × recency_factor |
| **Frontmatter** | Metadados YAML no inicio de um arquivo markdown |
| **Sleep-Time Compute** | Processamento de consolidacao durante idle (entre sessoes) |
| **Pattern Promotion** | Observacoes repetidas viram padroes e depois regras |
| **Strangler Fig** | Padrao de migracao gradual sem quebrar sistema existente |
| **PageRank** | Algoritmo que rankeia nodes de um grafo por importancia relativa |
| **tree-sitter** | Parser incremental de AST multi-linguagem |
