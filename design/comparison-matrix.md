# Sinapse — Matriz Comparativa Completa

**Data**: 2026-02-21

## Sinapse vs Competidores Diretos

```
╔══════════════════════╦═════════╦═════════╦═════════╦═════════╦═════════╦═════════╦═════════╗
║ Capability           ║ SINAPSE ║ Mem0    ║ Letta   ║ Graphiti║ Aider   ║ Devin   ║ Pedro/  ║
║                      ║ v2      ║         ║ /MemGPT ║ /Zep    ║         ║         ║ Alan    ║
╠══════════════════════╬═════════╬═════════╬═════════╬═════════╬═════════╬═════════╬═════════╣
║ Importance Scoring   ║ ✓       ║ ✓       ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Selective Forgetting ║ ✓       ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Temporal Graph       ║ ✓       ║ ✓(graf) ║ ✗       ║ ✓       ║ ✗       ║ ✗       ║ ?       ║
║ Context Health       ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Cross-Agent Memory   ║ ✓       ║ ✓       ║ ✓       ║ ✗       ║ ✗       ║ ✓       ║ ✓       ║
║ Code Graph/PageRank  ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✓       ║ ✗       ║ ?       ║
║ Auto Project ETL     ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✓(map)  ║ ✓(wiki) ║ ✓       ║
║ Pre-Exploration      ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Sleep-Time Compute   ║ ✓       ║ ✗       ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Compression          ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Contradiction Detect ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ✗       ║ ?       ║
║ Pattern Promotion    ║ ✓       ║ ✗       ║ ✓(skill)║ ✗       ║ ✗       ║ ✓(know) ║ ?       ║
║ Human-Readable Store ║ ✓       ║ ✗(API)  ║ ✓(git)  ║ ✗(Neo4j)║ ✓(.md)  ║ ✗       ║ ?       ║
║ Zero Infra (no srvr) ║ ✓       ║ ✗       ║ ✗       ║ ✗       ║ ✓       ║ ✗       ║ ✗       ║
║ Research-Backed      ║ ✓(80+)  ║ ✓(paper)║ ✓(paper)║ ✓(paper)║ ✗       ║ ✗       ║ ?       ║
╠══════════════════════╬═════════╬═════════╬═════════╬═════════╬═════════╬═════════╬═════════╣
║ TOTAL ✓              ║ 15/15   ║ 5/15    ║ 5/15    ║ 2/15    ║ 4/15    ║ 3/15    ║ 3+?/15  ║
╚══════════════════════╩═════════╩═════════╩═════════╩═════════╩═════════╩═════════╩═════════╝
```

## Tecnicas por Origem

| Tecnica no Sinapse | Inspirado em | Paper/Fonte |
|---|---|---|
| Importance scoring | Mem0, Generative Agents | arXiv:2504.19413 |
| Ebbinghaus decay | FadeMem (Alibaba) | arXiv:2601.18642 |
| Temporal graph | Zep/Graphiti | arXiv:2501.13956 |
| Code graph PageRank | Aider | aider.chat/docs/repomap |
| Pre-exploration | OpenSage (SWE-Bench) | arXiv:2602.16891 |
| Sleep-time compute | Letta/MemGPT | letta.com/blog |
| Context health | Chroma context-rot | research.trychroma.com |
| Filesystem > vectors | Letta Context-Bench | 74% > vector stores |
| Dynamic Context Discovery | Cursor | -46.9% tokens |
| Progressive disclosure | Anthropic Agent Skills | anthropic.com/engineering |
| Contradiction detection | RAG research | arXiv:2504.00180 |
| Pattern promotion | Claude Diary, Reflexion | NeurIPS 2023 |
| Event condensation | OpenHands | O(n²) → O(n) |
| Strangler Fig migration | Martin Fowler | Darkness vault |
| Options Diamond analysis | Project Zero Harvard | Darkness vault |
