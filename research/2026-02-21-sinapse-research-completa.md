# Sinapse Research — Estado da Arte em Context Engineering & Agent Memory
**Data**: 2026-02-21 | **Fontes**: 80+ URLs, 4 agentes paralelos, 18 modelos analisados

---

## Tese Central

**Inteligencia nao e mais o gargalo — contexto e.** Modelos sao smart enough. O desafio agora e: como alimentar o contexto CERTO, na hora CERTA, no formato CERTO, pra que o agente mantenha coerencia e qualidade ao longo de sessoes longas. Pedro descreveu o Sinapse como "gestao de prompt injection para manter contexto saudavel" — e exatamente isso que o campo inteiro esta tentando resolver.

---

## 1. O PROBLEMA: Context Rot

### O que causa
- **Acumulo de info stale**: dados obsoletos permanecem no contexto, gerando contradicoes
- **Lost in the Middle** (Stanford 2023): modelos priorizam inicio e fim, meio e ignorado
- **Attention Dilution**: n tokens = n^2 relacoes. 100K tokens = 10 bilhoes de relacoes
- **Hallucination Snowball**: erros iniciais propagam em cadeia (Zhang & Press)
- **Distratores**: ate 1 distrator reduz performance. 4+ compoem degradacao exponencialmente

### Numeros reais (Chroma Research Jul/2025, 18 modelos SOTA)
- Prompts focados (~300 tokens) >> full context (~113K tokens)
- GPT-4: de 98.1% para 64.1% so mudando estrutura do contexto
- Claude: menor alucinacao, decay mais lento, mas recusa tarefas longas
- Gemini: palavras aleatorias a partir de 500-750 words
- **Maioria degrada severamente por volta de 1,000 tokens em certas tasks**

---

## 2. COMO OS MELHORES RESOLVEM — Mapa Completo

### 2.1 Tabela Comparativa

| Sistema | Abordagem | Inovacao-Chave | Anti-Context-Rot |
|---------|-----------|----------------|------------------|
| **Claude Code** | Server-side compaction + CLAUDE.md + hooks | PreCompact hooks + Auto Memory + Session Memory background | Handover notes pre-compaction |
| **Cursor** | Dynamic Context Discovery + sidecar memory | Lazy retrieval: -46.9% tokens | .cursorrules + flash model compaction |
| **Windsurf** | Cascade auto-memories + rules | Auto-generate memories + full codebase awareness | Summarization + visual indicator |
| **Cline** | Context budget via @mentions + /new | Model-agnostico + effective window tracking | Manual management + Memory Bank pattern |
| **OpenAI Codex** | Stateless full history + AGENTS.md | Compressed context items + JS REPL stateful | AGENTS.md como guia persistente |
| **Devin** | Knowledge Bank + DeepWiki | Auto-indexa repos a cada ~2h + knowledge triggers | MultiDevin (agentes isolados) |
| **Factory AI** | Lazy loading + deduplication | Delegator pattern (separa planejamento de execucao) | Stateless droids + TDD loop |
| **Cosine/Genie** | Prerequisite discovery + semantic indexing | Human Reasoning Compiler (treina com PRs reais) | Modelo fine-tuned pra raciocinar como dev |
| **Aider** | PageRank sobre grafo de dependencias | 1K tokens = repo inteiro (4-6% utilizacao) | Tree-sitter AST + repo map persistente |
| **OpenHands** | Event-sourcing + condensers composable | Context condensation O(n^2) → O(n) | 3 tipos de condenser + deterministic replay |
| **Letta/MemGPT** | LLM-as-OS: agente gerencia propria memoria | Self-editing memory + sleep-time compute | Git-backed context repositories |
| **Mem0** | Memory orchestration layer | Priority scoring + decay + graph-enhanced | 90% token savings, 26% accuracy boost |
| **Zep/Graphiti** | Temporal knowledge graph | Bi-temporal model (event time + ingest time) | Validity intervals + incremental updates |
| **Augment Code** | Real-time semantic knowledge graph | Full codebase graph 1M+ files | Semantic indexing elimina grep-based |

### 2.2 Tecnicas Rankeadas por Impacto

**TIER 1 — Essencial**
1. **Tiered Memory (Hot/Warm/Cold)**: Consenso total do campo. Cada tier com retention policy + criterio de promocao/demovao
2. **Auto-compaction com Dual Write**: Sumario estruturado na memoria ativa + historico completo em storage externo
3. **Tool Result Offloading**: Resultados >20K tokens → filesystem, substituidos por referencia + preview
4. **Just-in-Time Retrieval**: NAO pre-carregar. Ponteiros leves + busca sob demanda via tools

**TIER 2 — Alto Impacto**
5. **Importance Scoring pre-storage**: LLM atribui score ANTES de salvar. So promove high-score para long-term
6. **Selective Forgetting (Ebbinghaus)**: Decay 0.995/hora, refresh no acesso, prune abaixo de threshold
7. **Multi-Agent Isolation**: Sub-agentes limpos → retornam so resumos condensados (1-2K tokens)
8. **Reflect Pattern**: 2+ ocorrencias = padrao, 3+ = forte. Banco de reflexoes pesquisavel

**TIER 3 — Avancado**
9. **Contradiction Detection**: LLM como context validator (conflitos context-memory e context-context)
10. **Temporal Knowledge Graphs**: Bi-temporal model (Graphiti-style) pra queries point-in-time
11. **Health Score Monitoring**: Sigmoid degradation modeling + auto-consciencia do agente
12. **Sleep-time Compute**: Agente reorganiza memoria durante idle (Letta: 5x reducao de tokens)

---

## 3. DEEP DIVES — Os Mais Relevantes

### 3.1 Letta/MemGPT — O mais sofisticado

**Filosofia**: LLM como OS. O agente decide autonomamente o que manter in-context, mover pra storage, ou buscar.

**4 Tiers de Memoria**:
- **Core Memory** (in-context): Memory Blocks (persona, human, system). Self-editing via 7 tools
- **Recall Storage**: Historico completo buscavel por relevancia/tempo
- **Archival Storage**: Vector DB ilimitado, busca semantica
- **Context Repositories** (2026): Git-backed filesystem. Versionado, auditavel, rollback, multi-agent via worktrees

**Inovacoes**:
- **Self-Editing Memory**: Agente reescreve propria memoria (core_memory_replace, memory_apply_patch)
- **Sleep-Time Compute**: Agente reorganiza memoria durante idle → 5x reducao de token budget
- **Context-Bench**: Filesystem puro (74%) BATE vector stores sofisticados
- **Skill Learning**: Agentes aprendem skills dinamicamente atraves de experiencia

### 3.2 Aider — PageRank para Code (elegancia maxima)

**Conceito**: Grafo de dependencias onde nodes = files, edges = import/call. PageRank ranqueia. Tree-sitter pra AST. Resultado: **1K tokens representam repo inteiro**.

**Numeros**: 4.3-6.5% de utilizacao do context window vs 54-70% de outros agentes. 10x mais eficiente.

**Por que importa**: Prova que MENOS contexto = MELHOR resultado quando a selecao e inteligente.

### 3.3 Cursor — Dynamic Context Discovery

**Mudanca de paradigma**: De "carregar tudo upfront" para "buscar sob demanda". Modelo flash menor faz compactacao.

**Resultado**: -46.9% tokens totais para runs com MCP tools.

**5 tecnicas**: Files como interface (tool responses salvas como files), summarization via chat history, agent skills como padrao aberto.

### 3.4 Devin — Knowledge Bank

**DeepWiki**: Indexa repos a cada ~2h, gera wikis com architecture diagrams e relationship mapping.

**Knowledge Triggers**: Entries com trigger descriptions → retrieval contextual automatico. O agente auto-gera e auto-atualiza knowledge. Sugere o que lembrar baseado em feedback.

### 3.5 OpenHands — Context Condensation

**Event-sourcing**: Todas interacoes sao eventos imutaveis. Pipeline de condensers composable:
- LLMSummarizing, RecentEvents, NoOp + BrowserOutputCondenser
- Muda scaling de O(n^2) para O(n)
- Custo por turno cai pra menos da metade

### 3.6 SWE-Bench — OpenSage (hierarchical memory)

**Finding critico**: Sub-agente explora codebase e popula long-term memory ANTES de resolver o issue.

**Resultado**: Best resolved rate no SWE-Bench Pro.

**Insight bombástico**: Oracle summaries >> autonomous retrieval. Memorias irrelevantes PIORAM performance. **Curadoria supera acesso livre.**

---

## 4. PESQUISA ACADEMICA — Papers Fundamentais

| Paper | Achado-Chave | Fonte |
|-------|-------------|-------|
| Lost in the Middle (Stanford 2023) | Performance U-shaped: melhor no inicio/fim, pior no meio | arXiv:2307.03172 |
| FadeMem (Alibaba 2026) | Decay exponencial adaptativo, supera Mem0 com 45% menos storage | arXiv:2601.18642 |
| MemOS (EMNLP 2025) | Memory como recurso de OS, +49% F1, 5.691 stars | arXiv:2507.03724 |
| Mem0 (Abr 2025) | +26% accuracy, -91% latencia p95, -90% tokens | arXiv:2504.19413 |
| Zep/Graphiti (Jan 2025) | KG temporal bi-temporal, 94.8% DMR, -90% latencia | arXiv:2501.13956 |
| A-MEM (NeurIPS 2025) | Organizacao Zettelkasten dinamica | arXiv:2502.12110 |
| Memory Survey (Dez 2025) | Taxonomia: factual + experiencial + trabalho | arXiv:2512.13564 |
| InfiniRetri (Fev 2025) | 100% accuracy Needle-In-Haystack a 1M tokens, +288% | arXiv:2502.12962 |
| LLMLingua-2 (Microsoft) | 20x compressao, <5% loss, 3-6x mais rapido | — |
| Recursive LMs (MIT Dec 2025) | LLM chama sub-instancias recursivamente | arXiv:2512.24601 |

---

## 5. OPEN SOURCE — Ferramentas Prontas

### Plataformas de Memoria
| Projeto | Stars | O que faz |
|---------|-------|-----------|
| **Mem0** | 24K+ | Universal memory layer, graph-enhanced |
| **MemOS** | 5.6K | Memory OS, MemCube, predictive preload |
| **Letta** | — | Agent framework, self-editing memory, git-backed |
| **Memori** | 12K | SQL-native memory layer |
| **Graphiti/Zep** | 20K+ | Temporal knowledge graph |
| **claude-mem** | 24K | Memory para Claude Code, 5 lifecycle hooks |

### Tools de Context
| Projeto | O que faz |
|---------|-----------|
| **context-rot-detection** (MCP) | Health score 0-100, healing recommendations |
| **context-rot** (Chroma) | Toolkit de replicacao do estudo |
| **LLMLingua** (Microsoft) | Prompt compression 20x |
| **compact-memory** | Framework de compressao |

### Listas Curadas
- **Awesome-AI-Memory** (369 stars): github.com/IAAR-Shanghai/Awesome-AI-Memory
- **Agent-Memory-Paper-List**: companion do survey arXiv:2512.13564

---

## 6. CONTEXT ENGINEERING — A Disciplina

### Quem cunhou
- **Tobi Lutke** (CEO Shopify, Jun 2025): "the art of providing all the context for the task to be plausibly solvable"
- **Karpathy** (Jun 2025): "the delicate art of filling the context window with just the right information"
- **Harrison Chase** (LangChain): "building dynamic systems to provide the right information and tools in the right format"

### 7 Principios
1. **Orcamento Finito de Atencao**: Context = recurso escasso com retornos decrescentes
2. **Altitude Correta**: Especifico o bastante pra guiar, flexivel pra heuristicas
3. **Separar Storage de Apresentacao**: Estado duravel vs visualizacao por chamada
4. **6 Camadas de Input**: System rules + memory + retrieved docs + tool schemas + conversation + current task
5. **Menor Set de Tokens de Alto Sinal**: MINIMO que maximiza resultado
6. **Progressive Disclosure**: Carregar incrementalmente, nao tudo de uma vez
7. **Just-in-Time Loading**: Ponteiros leves, buscar on-demand

### Frameworks
- **12-Factor Agent** (HumanLayer): "reliable agent = well-engineered software + LLM only where probabilistic reasoning helps"
- **Manus AI**: Media 50 tool calls/tarefa. Compaction com schema, KV-Cache, sub-agents isolados
- **Claude Agent Skills**: Progressive disclosure como primitiva de primeira classe

---

## 7. JARVIS/AIOS vs ESTADO DA ARTE

### O que ja temos (vantagens)
1. **3-camada memoria** (hot/warm/cold) — mais sofisticado que a maioria
2. **Decision persistence** (Darkness MCP) — UNICO no mercado
3. **Knowledge graph com wiki-links** — alinhado com research
4. **Hooks extensiveis** (pre-compact, session start/stop)
5. **4-level memory hierarchy** — comparavel a Claude Code stock
6. **Multi-agent context** (AIOS agents com MEMORY.md por agente)

### Gaps criticos (o que falta)
1. **Code graph / PageRank** (Aider: 1K tokens = repo inteiro)
2. **Embeddings/RAG sobre codebase** (Continue, Windsurf, Cursor)
3. **Knowledge triggers semanticos** (Devin auto-retrieves)
4. **Sub-agent pre-exploration** (OpenSage: explora antes de agir)
5. **Importance scoring** (Mem0: priority scoring pre-storage)
6. **Selective forgetting** (FadeMem: decay exponencial adaptativo)
7. **Temporal tags** em knowledge entities (Graphiti: bi-temporal)
8. **Health score** do contexto (context-rot-detection MCP)
9. **Sleep-time compute** (Letta: reorganiza durante idle)
10. **Prompt compression** (LLMLingua: 20x compressao)

---

## 8. FONTES COMPLETAS

### Papers
- arXiv:2307.03172 — Lost in the Middle (Stanford)
- arXiv:2601.18642 — FadeMem (Alibaba)
- arXiv:2507.03724 — MemOS
- arXiv:2504.19413 — Mem0
- arXiv:2501.13956 — Zep/Graphiti
- arXiv:2502.12110 — A-MEM
- arXiv:2512.13564 — Memory Survey
- arXiv:2502.12962 — InfiniRetri
- arXiv:2512.24601 — Recursive LMs
- arXiv:2509.21361 — MECW
- arXiv:2509.18970 — Agent Hallucinations
- arXiv:2504.00180 — Contradiction Detection
- arXiv:2602.16891 — OpenSage
- arXiv:2602.08316 — SWE Context Bench

### Docs & Blogs
- anthropic.com/engineering/effective-context-engineering-for-ai-agents
- manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- blog.langchain.com/the-rise-of-context-engineering
- blog.langchain.com/context-management-for-deepagents
- research.trychroma.com/context-rot
- cognition.ai/blog/devin-annual-performance-review-2025
- factory.ai/news/factory-is-ga
- cosine.sh/blog/genie-technical-report
- aider.chat/docs/repomap.html
- code.claude.com/docs/en/memory
- openhands.dev/blog/openhands-context-condensensation
- letta.com/blog/context-repositories
- letta.com/blog/sleep-time-compute
- mem0.ai/blog/ai-memory-layer-guide
- augmentcode.com/context-engine

### GitHub
- github.com/mem0ai/mem0 (24K stars)
- github.com/MemTensor/MemOS (5.6K)
- github.com/getzep/graphiti (20K+)
- github.com/thedotmack/claude-mem (24K)
- github.com/chroma-core/context-rot
- github.com/microsoft/LLMLingua
- github.com/microsoft/graphrag
- github.com/IAAR-Shanghai/Awesome-AI-Memory
- github.com/humanlayer/12-factor-agents
