// sinapse consolidate — Full consolidation pipeline (decay + gc + health)

import { Command } from 'commander';
import { runDecay, runGC } from '../../core/decay.js';
import { calculateHealth } from '../../core/health.js';
import { buildGraphIndex, saveGraphIndex } from '../../core/graph.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import { initDb, insertConsolidationRun, insertHealthSnapshot, closeDb } from '../../core/db.js';
import { getMetaDbPath } from '../../core/paths.js';


export const consolidateCommand = new Command('consolidate')
  .description('Run full consolidation pipeline (decay + gc + graph + health)')
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const db = initDb(getMetaDbPath());
    const startTime = Date.now();

    const steps: Array<{ step: string; status: string; duration: number; details: Record<string, unknown> }> = [];

    try {
      // Step 1: Health before
      const healthBefore = calculateHealth();

      // Step 2: Decay
      const decayStart = Date.now();
      const decayResult = runDecay();
      steps.push({
        step: 'decay',
        status: 'success',
        duration: Date.now() - decayStart,
        details: decayResult as unknown as Record<string, unknown>,
      });

      // Step 3: GC
      const gcStart = Date.now();
      const gcResult = runGC();
      steps.push({
        step: 'gc',
        status: 'success',
        duration: Date.now() - gcStart,
        details: gcResult as unknown as Record<string, unknown>,
      });

      // Step 4: Graph rebuild
      const graphStart = Date.now();
      const graphIndex = buildGraphIndex();
      saveGraphIndex(graphIndex);
      steps.push({
        step: 'graph',
        status: 'success',
        duration: Date.now() - graphStart,
        details: { nodes: graphIndex.nodeCount, edges: graphIndex.edgeCount },
      });

      // Step 5: Health after
      const healthAfter = calculateHealth();
      steps.push({
        step: 'health',
        status: 'success',
        duration: 0,
        details: { score: healthAfter.score, range: healthAfter.range },
      });

      // Save health snapshot
      insertHealthSnapshot(db, {
        score: healthAfter.score,
        range: healthAfter.range,
        breakdown: JSON.stringify(healthAfter.breakdown),
        total_memories: healthAfter.totalMemories,
        agent: null,
        project: null,
        timestamp: healthAfter.timestamp,
      });

      // Save consolidation run
      const totalDuration = Date.now() - startTime;
      insertConsolidationRun(db, {
        steps: JSON.stringify(steps),
        health_before: healthBefore.score,
        health_after: healthAfter.score,
        total_duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      if (json) {
        console.log(JSON.stringify({
          steps,
          healthBefore: healthBefore.score,
          healthAfter: healthAfter.score,
          totalDuration,
        }));
      } else {
        console.log(`\n╔══════════════════════════════════════╗`);
        console.log(`║  SINAPSE CONSOLIDATION               ║`);
        console.log(`╠══════════════════════════════════════╣`);
        for (const step of steps) {
          const icon = step.status === 'success' ? '+' : 'x';
          console.log(`║  [${icon}] ${step.step.padEnd(15)} ${String(step.duration).padStart(5)}ms     ║`);
        }
        console.log(`╠══════════════════════════════════════╣`);
        console.log(`║  Health: ${String(healthBefore.score).padStart(5)} → ${String(healthAfter.score).padStart(5)}              ║`);
        console.log(`║  Total: ${String(totalDuration).padStart(6)}ms                    ║`);
        console.log(`╚══════════════════════════════════════╝\n`);
      }
    } finally {
      closeDb();
    }
  });
