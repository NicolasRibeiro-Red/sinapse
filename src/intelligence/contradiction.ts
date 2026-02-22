// Sinapse — Contradiction Detection
// Heuristic-based detection to minimize LLM calls

import type { SinapseMemory, ContradictionPair } from '../types/index.js';

export function detectPotentialContradictions(memories: SinapseMemory[]): ContradictionPair[] {
  const pairs: ContradictionPair[] = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i]!;
      const b = memories[j]!;

      // Same project, different agents, overlapping tags
      if (shouldCheckContradiction(a, b)) {
        pairs.push({
          memoryA: a.id,
          memoryB: b.id,
          type: 'context-context',
          description: `Potential contradiction: "${a.title}" vs "${b.title}" (same project: ${a.project}, agents: ${a.agent}/${b.agent})`,
        });
      }
    }
  }

  return pairs;
}

function shouldCheckContradiction(a: SinapseMemory, b: SinapseMemory): boolean {
  // Must be same project
  if (!a.project || !b.project || a.project !== b.project) return false;

  // Different agents (same agent unlikely to contradict itself)
  if (a.agent === b.agent) return false;

  // Must be same type (decisions can contradict decisions, not bugs)
  if (a.type !== b.type) return false;

  // Must have overlapping tags
  const overlap = a.tags.filter(t => b.tags.includes(t));
  if (overlap.length === 0) return false;

  return true;
}

export function generateContradictionCheckPrompt(a: SinapseMemory, b: SinapseMemory): string {
  return `## Contradiction Check

Compare these two memories and determine if they contradict each other:

### Memory A (${a.agent}, ${a.created})
**${a.title}**
${a.content}

### Memory B (${b.agent}, ${b.created})
**${b.title}**
${b.content}

### Instructions
1. Are these memories contradictory? (yes/no)
2. If yes: which one is more current/accurate?
3. If yes: the older/incorrect one should be superseded

Output format:
- contradicts: true/false
- winner: A or B (if contradicts)
- reason: brief explanation`;
}

export function resolveContradiction(
  winner: SinapseMemory,
  loser: SinapseMemory,
): { winner: SinapseMemory; loser: SinapseMemory } {
  winner.links = [...new Set([...winner.links, loser.id])];
  loser.supersedes = null; // loser doesn't supersede anything
  // The calling code should set winner as superseding loser
  return { winner, loser };
}
