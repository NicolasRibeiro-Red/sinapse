// Sinapse — Decay Engine (Ebbinghaus Adaptive)
// Formula: effective_score = importance × (decay_rate ^ hours_since_access)

import type { SinapseMemory, DecayResult } from '../types/index.js';
import { MemoryStatus } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { updateMemoryFile, archiveMemory, deleteMemoryFile, scanAllMemoryFiles, readMemory } from './memory-store.js';

export function calculateEffectiveScore(
  importance: number,
  decayRate: number,
  hoursSinceAccess: number,
): number {
  return importance * Math.pow(decayRate, hoursSinceAccess);
}

export function hoursSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60);
}

export function runDecay(memories?: SinapseMemory[]): DecayResult {
  const config = DEFAULT_CONFIG.decay;
  const result: DecayResult = {
    totalProcessed: 0,
    updated: 0,
    archived: 0,
    gcEligible: 0,
  };

  // Load all memories if not provided
  const mems = memories ?? loadAllMemories();

  for (const memory of mems) {
    result.totalProcessed++;

    // Pinned memories never decay
    if (memory.status === MemoryStatus.Pinned) continue;

    const hours = hoursSince(memory.accessed);
    const newScore = calculateEffectiveScore(memory.importance, memory.decay_rate, hours);

    // Only update if score changed significantly
    if (Math.abs(newScore - memory.effective_score) < 0.001) continue;

    memory.effective_score = newScore;
    result.updated++;

    if (newScore < config.gcThreshold) {
      result.gcEligible++;
      memory.status = MemoryStatus.Decayed;
    } else if (newScore < config.archiveThreshold && memory.status === MemoryStatus.Active) {
      result.archived++;
      archiveMemory(memory);
      continue; // archiveMemory already saves
    }

    updateMemoryFile(memory);
  }

  return result;
}

export function runGC(dryRun = false): { deleted: number; ids: string[] } {
  const config = DEFAULT_CONFIG.decay;
  const mems = loadAllMemories();
  const toDelete: SinapseMemory[] = [];

  for (const memory of mems) {
    if (memory.status === MemoryStatus.Pinned) continue;

    const hours = hoursSince(memory.accessed);
    const score = calculateEffectiveScore(memory.importance, memory.decay_rate, hours);

    if (score < config.gcThreshold) {
      toDelete.push(memory);
    }
  }

  const ids = toDelete.map(m => m.id);

  if (!dryRun) {
    for (const memory of toDelete) {
      deleteMemoryFile(memory);
    }
  }

  return { deleted: toDelete.length, ids };
}

function loadAllMemories(): SinapseMemory[] {
  const files = scanAllMemoryFiles();
  const memories: SinapseMemory[] = [];

  for (const file of files) {
    const mem = readMemory(file);
    if (mem) memories.push(mem);
  }

  return memories;
}
