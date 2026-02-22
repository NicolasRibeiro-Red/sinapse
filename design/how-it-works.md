# Sinapse — Como Funciona (Mecanica Pratica)

**Data**: 2026-02-21

---

## Resumo em 1 paragrafo

Sinapse e um protocolo (frontmatter YAML em markdown) que da peso, tempo, dono e conexoes
pra cada memoria. Claude faz a parte inteligente (decidir o que e importante, comprimir,
detectar contradicoes). Um CLI faz a parte mecanica (calcular decay, gerar stats, health check).
Hooks automatizam (salvar antes de compaction, carregar ao iniciar, limpar ao sair).
O resultado: cada agente comeca a sessao com as memorias certas, no peso certo, sem lixo
— e o sistema se auto-limpa com o tempo.

---

## Fluxo Completo: Session de Trabalho

### 1. Inicio da sessao

```
  Nicolas: "bom dia" ou abre projeto
    │
    ▼
  Hook session-start dispara
    │
    ├─ Detecta projeto atual (pwd, git remote)
    ├─ CLI: sinapse health → score rapido
    ├─ Claude le memorias filtradas:
    │   - agent: "jarvis" ou "global"
    │   - project: projeto atual (se detectado)
    │   - status: "active" ou "pinned"
    │   - effective_score >= 5.0
    │   - ordena por effective_score DESC
    │   - limit: top 20 memorias
    │
    ▼
  Claude comeca sessao com contexto CURADO
  (nao tudo, nao nada — o sweet spot)
```

### 2. Durante o trabalho

```
  Claude descobre algo importante
  (decisao, bug, insight, padrao)
    │
    ▼
  Claude salva como memoria:
    - Atribui importance (0-10) baseado em:
      * Afeta arquitetura? +3
      * E um bug? +2
      * Cross-project? +1
      * Decisao irreversivel? +3
    - Escolhe tags, type, links
    - Escreve em memory/sinapse/hot/{agent}/
    │
    ▼
  Claude consulta memoria existente
    │
    ▼
  CLI atualiza accessed + access_count
  (memoria fica "fresca", decay reseta)
```

### 3. Pre-compaction (o momento critico)

```
  Contexto atinge ~95% do limite
    │
    ▼
  Hook pre-compact dispara
    │
    ├─ Claude identifica info critica no contexto atual:
    │   - Decisoes tomadas nesta sessao
    │   - Estado atual do trabalho
    │   - Bugs/problemas encontrados
    │   - Next steps
    │
    ├─ Claude salva cada item como memoria com frontmatter
    │   (importance alto, pois acabou de ser relevante)
    │
    ├─ CLI: sinapse health → loga score pre-compact
    │
    ▼
  Compaction roda normalmente
  MAS as informacoes criticas ja estao salvas em arquivos
  → Sobrevivem a compaction
```

### 4. Fim da sessao

```
  Nicolas: "boa noite" ou /wrap-up
    │
    ▼
  Hook session-stop dispara
    │
    ├─ Claude escreve resumo da sessao (como ja faz)
    │   mas agora com frontmatter padrao Sinapse
    │
    ├─ CLI: sinapse stats → metricas da sessao
    │
    ├─ CLI: sinapse decay → recalcula scores
    │   (memorias nao acessadas hoje perdem score)
    │
    ▼
  Proxima sessao: memorias certas ja estarao la
```

### 5. Consolidacao (background)

```
  Trigger: /sinapse clean ou cron diario
    │
    ▼
  Pipeline:
    1. sinapse decay
       → Recalcula effective_score de TODAS as memorias
       → Move score < 3.0 pra archived/
       → Deleta score < 1.0

    2. Claude merge duplicatas
       → Identifica memorias similares
       → Merge em uma, usa supersedes

    3. Claude promove padroes
       → Observado 2x → pattern (importance +2)
       → Observado 3x → rule (importance +3, pinned)

    4. sinapse health
       → Gera report de saude

    5. Atualiza code graph (se repo mudou)
       → Re-parseia com tree-sitter
       → Recalcula PageRank
```

---

## Exemplo Concreto: @dev no SalesFlow

### Antes do Sinapse
```
  @dev ativa
  → Le MEMORY.md (200 linhas, tudo misturado)
  → Nao sabe o que e importante vs trivial
  → Nao sabe o que mudou desde ultima sessao
  → Comeca do zero, pede pra ler arquivos
```

### Com Sinapse
```
  @dev ativa no SalesFlow
  → Hook carrega:
    [pinned] Arquitetura: Next.js 14 + Supabase + Edge Functions
    [score 9.2] Bug: RLS policy nao aplica em Edge (encontrado ontem)
    [score 8.5] Decisao: migrar AssemblyAI V2→V3 (commitado)
    [score 7.8] @qa encontrou: testes de auth falhando em staging
    [score 7.1] Pattern: useServerAction padrao pra mutations
    [score 6.3] Project DNA: top files por PageRank
  → @dev ja sabe EXATAMENTE o que importa
  → Comeca a trabalhar no que e prioridade
```

---

## Divisao de Responsabilidades

```
┌────────────────────────┬──────────────────┬──────────────────────┐
│ Operacao               │ Quem faz         │ Por que              │
├────────────────────────┼──────────────────┼──────────────────────┤
│ Importance scoring     │ Claude (LLM)     │ Entende contexto     │
│ Compression            │ Claude (LLM)     │ Entende sinal/ruido  │
│ Contradiction detect   │ Claude (LLM)     │ Raciocinio semantico │
│ Recall + ranking       │ Claude (LLM)     │ Relevancia contextual│
│ Context generation     │ Claude (LLM)     │ Sintese inteligente  │
│ Merge duplicatas       │ Claude (LLM)     │ Similaridade semantica│
│ Pattern promotion      │ Claude (LLM)     │ Reconhece padroes    │
├────────────────────────┼──────────────────┼──────────────────────┤
│ Decay calculation      │ CLI (script)     │ Matematica pura      │
│ Stats / metricas       │ CLI (script)     │ Aggregacao            │
│ Health score           │ CLI (script)     │ Formula fixa          │
│ GC / cleanup           │ CLI (script)     │ Rules-based           │
│ Index update           │ CLI (script)     │ Parse → SQLite       │
│ Code graph (tree-sit)  │ CLI (script)     │ AST parsing           │
│ PageRank               │ CLI (script)     │ Algebra linear        │
├────────────────────────┼──────────────────┼──────────────────────┤
│ Store / retrieve       │ Claude + Files   │ Read/Write nativo     │
│ Graph traversal        │ Claude + links   │ Segue [[wiki-links]]  │
│ Agent namespace        │ Convencao dirs   │ sinapse/hot/{agent}/  │
│ Project DNA            │ CLI + Claude     │ CLI parseia, Claude   │
│                        │                  │ sintetiza em 1K tokens│
└────────────────────────┴──────────────────┴──────────────────────┘
```

---

## CLI Commands

```bash
sinapse decay              # Recalcula effective_scores, move decayed
sinapse health             # Health score 0-100 com breakdown
sinapse stats              # Metricas agregadas
sinapse gc                 # Garbage collect (delete score < 1.0)
sinapse consolidate        # Pipeline completo (decay + gc + health)
sinapse index              # Rebuild SQLite index from frontmatter
sinapse graph              # Rebuild graph index from links
sinapse ingest [path]      # Parse projeto, gera Project DNA
sinapse list [--agent X]   # Lista memorias filtradas
sinapse export             # Export tudo pra JSON (backup)
```

---

## Skill /sinapse

```
/sinapse              # Status geral + health
/sinapse health       # Health score detalhado
/sinapse recall [q]   # Claude busca memorias por query
/sinapse stats        # Metricas + trends
/sinapse clean        # Consolidation pipeline
/sinapse graph        # Visualiza conexoes
/sinapse ingest       # Re-parseia projeto atual
```
