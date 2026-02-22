// Sinapse — Full Consolidation Pipeline (7 Steps)
// Step 3-4 generate prompts for Claude, don't execute LLM directly

import type { ConsolidationReport, ConsolidationStepResult, ConsolidationStep } from '../types/index.js';
import { runDecay, runGC } from './decay.js';
import { calculateHealth } from './health.js';
import { buildGraphIndex, saveGraphIndex } from './graph.js';
import { listMemories } from './memory-store.js';
import { detectPotentialContradictions } from '../intelligence/contradiction.js';
import { findPromotionCandidates } from '../intelligence/promotion.js';

export function runConsolidationPipeline(): ConsolidationReport {
  const startTime = Date.now();
  const steps: ConsolidationStepResult[] = [];

  // Health before
  const healthBefore = calculateHealth();

  // Step 1: Decay
  const decayStart = Date.now();
  try {
    const decayResult = runDecay();
    steps.push({
      step: 'decay' as ConsolidationStep,
      status: 'success',
      duration: Date.now() - decayStart,
      details: decayResult as unknown as Record<string, unknown>,
    });
  } catch (e) {
    steps.push({
      step: 'decay' as ConsolidationStep,
      status: 'error',
      duration: Date.now() - decayStart,
      details: { error: (e as Error).message },
    });
  }

  // Step 2: GC
  const gcStart = Date.now();
  try {
    const gcResult = runGC();
    steps.push({
      step: 'gc' as ConsolidationStep,
      status: 'success',
      duration: Date.now() - gcStart,
      details: gcResult as unknown as Record<string, unknown>,
    });
  } catch (e) {
    steps.push({
      step: 'gc' as ConsolidationStep,
      status: 'error',
      duration: Date.now() - gcStart,
      details: { error: (e as Error).message },
    });
  }

  // Step 3: Merge duplicates (generate prompts only)
  const mergeStart = Date.now();
  const allMemories = listMemories();
  const contradictions = detectPotentialContradictions(allMemories);
  steps.push({
    step: 'merge_dupes' as ConsolidationStep,
    status: contradictions.length > 0 ? 'success' : 'skipped',
    duration: Date.now() - mergeStart,
    details: { potentialContradictions: contradictions.length },
  });

  // Step 4: Promote patterns (generate prompts only)
  const promoteStart = Date.now();
  const candidates = findPromotionCandidates(allMemories);
  steps.push({
    step: 'promote_patterns' as ConsolidationStep,
    status: candidates.length > 0 ? 'success' : 'skipped',
    duration: Date.now() - promoteStart,
    details: { promotionCandidates: candidates.length },
  });

  // Step 5: Ingest (skip — requires project context)
  steps.push({
    step: 'ingest' as ConsolidationStep,
    status: 'skipped',
    duration: 0,
    details: { reason: 'Requires project context' },
  });

  // Step 6: Graph rebuild
  const graphStart = Date.now();
  try {
    const graphIndex = buildGraphIndex();
    saveGraphIndex(graphIndex);
    steps.push({
      step: 'graph' as ConsolidationStep,
      status: 'success',
      duration: Date.now() - graphStart,
      details: { nodes: graphIndex.nodeCount, edges: graphIndex.edgeCount },
    });
  } catch (e) {
    steps.push({
      step: 'graph' as ConsolidationStep,
      status: 'error',
      duration: Date.now() - graphStart,
      details: { error: (e as Error).message },
    });
  }

  // Step 7: Health after
  const healthAfter = calculateHealth();
  steps.push({
    step: 'health' as ConsolidationStep,
    status: 'success',
    duration: 0,
    details: { score: healthAfter.score, range: healthAfter.range },
  });

  return {
    steps,
    healthBefore: healthBefore.score,
    healthAfter: healthAfter.score,
    totalDuration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
