// Sinapse — Pattern Promotion Engine
// 1x → insight, 2x → pattern (+2 importance), 3x → rule (+3, pinned)

import type { SinapseMemory, PromotionCandidate } from '../types/index.js';
import { MemoryType, MemoryStatus } from '../types/index.js';
import { PROMOTION_LEVELS } from '../core/importance.js';

export function findPromotionCandidates(memories: SinapseMemory[]): PromotionCandidate[] {
  // Group by tags + type
  const groups = new Map<string, SinapseMemory[]>();

  for (const mem of memories) {
    // Skip already-pinned (already rules)
    if (mem.status === MemoryStatus.Pinned) continue;

    // Group key: sorted tags + type
    const key = `${mem.type}:${[...mem.tags].sort().join(',')}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(mem);
  }

  const candidates: PromotionCandidate[] = [];

  for (const [, mems] of groups) {
    if (mems.length < 2) continue; // Need at least 2 for pattern

    const occurrences = mems.length;
    let currentLevel: 'insight' | 'pattern' | 'rule' = 'insight';
    let suggestedLevel: 'pattern' | 'rule';
    let importanceBoost: number;

    if (occurrences >= PROMOTION_LEVELS.RULE.occurrences) {
      suggestedLevel = 'rule';
      importanceBoost = PROMOTION_LEVELS.RULE.importanceBoost;
      currentLevel = occurrences === 3 ? 'pattern' : 'insight';
    } else {
      suggestedLevel = 'pattern';
      importanceBoost = PROMOTION_LEVELS.PATTERN.importanceBoost;
      currentLevel = 'insight';
    }

    candidates.push({
      memoryIds: mems.map(m => m.id),
      tags: mems[0]!.tags,
      type: mems[0]!.type,
      occurrences,
      currentLevel,
      suggestedLevel,
      importanceBoost,
    });
  }

  return candidates;
}

export function generatePromotionCheckPrompt(candidate: PromotionCandidate, memories: SinapseMemory[]): string {
  const relevantMems = memories.filter(m => candidate.memoryIds.includes(m.id));

  return `## Pattern Promotion Check

${candidate.occurrences} memories share similar tags and type:

${relevantMems.map(m => `### ${m.title} (${m.agent}, ${m.created})\n${m.content.slice(0, 200)}...`).join('\n\n')}

### Question
Do these memories represent a genuine pattern or rule that should be promoted?

Current: ${candidate.currentLevel}
Suggested: ${candidate.suggestedLevel} (importance +${candidate.importanceBoost})
${candidate.suggestedLevel === 'rule' ? '(Will be PINNED — never decays)' : ''}

Output: promote: true/false, reason: brief explanation`;
}

export function promoteMemory(
  memory: SinapseMemory,
  toLevel: 'pattern' | 'rule',
): SinapseMemory {
  if (toLevel === 'rule') {
    memory.importance = Math.min(10, memory.importance + PROMOTION_LEVELS.RULE.importanceBoost);
    memory.effective_score = memory.importance;
    memory.status = MemoryStatus.Pinned;
    memory.type = MemoryType.Pattern;
  } else {
    memory.importance = Math.min(10, memory.importance + PROMOTION_LEVELS.PATTERN.importanceBoost);
    memory.effective_score = memory.importance;
    memory.type = MemoryType.Pattern;
  }

  memory.updated = new Date().toISOString();
  if (!memory.tags.includes('promoted')) {
    memory.tags.push('promoted');
  }

  return memory;
}
