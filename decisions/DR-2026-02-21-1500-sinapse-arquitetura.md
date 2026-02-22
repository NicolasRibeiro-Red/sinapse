# DR-2026-02-21-1500 — Sinapse: Protocolo + CLI vs MCP Server

## Trigger
ARCHITECTURE — escolha de arquitetura para sistema de context management compartilhado entre todos os agentes AIOS

## Classification
Level 2 (Complex) — multiplos caminhos validos, afeta todo ecossistema, dificil reverter

## Context
Sinapse = sistema de gestao de contexto e memoria para agentes AI. Precisa: persistir entre sessoes, ser acessivel por qualquer agente, escalar para futuros, integrar com infra existente (markdown, SQLite, hooks).

## Frameworks Consulted
- **Options Diamond**: Mapeou 5 opcoes em eixos Simplicidade × Poder. Opcao E domina.
- **Strangler Fig**: Migracao gradual do sistema de memoria atual sem quebrar nada.
- **Build-Measure-Learn**: MVP com protocolo primeiro, CLI depois, DB se necessario.

## Options Evaluated

| Opcao | Simplicidade | Poder | Veredicto |
|-------|-------------|-------|-----------|
| A) MCP Server dedicado | Baixa | Alto | Over-engineering: 4/10 capabilities precisam de LLM |
| B) So hooks/skills | Alta | Baixo | Insuficiente pra decay/scoring/health |
| C) MCP thin wrapper | Media | Medio | Server dumb, nao justifica o overhead |
| D) Files puros + script | Alta | Baixo | Sem queries estruturadas |
| E) Protocolo + CLI + Hooks | Alta | Alto | Melhor dos dois mundos |

## Second-Order Analysis
- **1st order**: Protocolo + CLI implementado, agentes seguem convencoes
- **2nd order**: Memorias ficam auditaveis (git), debugging trivial (cat file.md), qualquer agente futuro so precisa seguir frontmatter YAML
- **3rd order**: Se precisar de MCP no futuro, os files com frontmatter servem de base — MCP vira thin wrapper sobre o mesmo storage. Decisao e reversivel.

## Decision
**Escolhido**: Opcao E — Protocolo (frontmatter YAML) + CLI tool + Hooks + Claude Code LLM para operacoes inteligentes

**Rationale**:
1. 4/10 capabilities precisam de LLM que ja temos no Claude Code. MCP seria intermediario sem inteligencia
2. Letta Context-Bench provou: filesystem (74%) > vector stores
3. Strangler Fig permite migracao gradual sem quebrar sistema atual
4. Reversibilidade alta: MCP pode ser adicionado depois como wrapper

**Trade-off aceito**: Sem real-time event-driven updates (nao precisamos pra single-user)

## Reversibility: Alta
## Review date: Apos Fase 2 (CLI implementado), reavaliar necessidade de MCP
