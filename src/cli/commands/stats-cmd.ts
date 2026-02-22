// sinapse stats — Aggregate metrics

import { Command } from 'commander';
import { initDb, getMemoryStats, closeDb } from '../../core/db.js';
import { getMetaDbPath } from '../../core/paths.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import { listMemories } from '../../core/memory-store.js';

export const statsCommand = new Command('stats')
  .description('Show aggregate memory statistics')
  .option('--agent <agent>', 'Filter by agent')
  .option('--project <project>', 'Filter by project')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();

    // Get stats from files (more accurate than SQLite which might be stale)
    const memories = listMemories({
      agent: opts.agent,
      project: opts.project,
    });

    const total = memories.length;
    const byAgent = new Map<string, number>();
    const byType = new Map<string, number>();
    const byStatus = new Map<string, number>();
    let scoreSum = 0;
    let decaySum = 0;

    for (const mem of memories) {
      byAgent.set(mem.agent, (byAgent.get(mem.agent) ?? 0) + 1);
      byType.set(mem.type, (byType.get(mem.type) ?? 0) + 1);
      byStatus.set(mem.status, (byStatus.get(mem.status) ?? 0) + 1);
      scoreSum += mem.effective_score;
      decaySum += mem.decay_rate;
    }

    const avgScore = total > 0 ? Math.round((scoreSum / total) * 100) / 100 : 0;
    const avgDecay = total > 0 ? Math.round((decaySum / total) * 1000) / 1000 : 0;

    if (json) {
      console.log(JSON.stringify({
        total,
        avgScore,
        avgDecayRate: avgDecay,
        byAgent: Object.fromEntries(byAgent),
        byType: Object.fromEntries(byType),
        byStatus: Object.fromEntries(byStatus),
      }));
    } else {
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║  SINAPSE STATS                       ║`);
      console.log(`╠══════════════════════════════════════╣`);
      console.log(`║  Total: ${String(total).padStart(6)}                       ║`);
      console.log(`║  Avg Score: ${String(avgScore).padStart(6)}                   ║`);
      console.log(`║  Avg Decay Rate: ${String(avgDecay).padStart(5)}              ║`);
      console.log(`╠══════════════════════════════════════╣`);

      if (byAgent.size > 0) {
        console.log(`║  By Agent:                           ║`);
        for (const [agent, count] of byAgent) {
          console.log(`║    ${agent.padEnd(18)} ${String(count).padStart(4)}         ║`);
        }
      }
      if (byType.size > 0) {
        console.log(`║  By Type:                            ║`);
        for (const [type, count] of byType) {
          console.log(`║    ${type.padEnd(18)} ${String(count).padStart(4)}         ║`);
        }
      }
      if (byStatus.size > 0) {
        console.log(`║  By Status:                          ║`);
        for (const [status, count] of byStatus) {
          console.log(`║    ${status.padEnd(18)} ${String(count).padStart(4)}         ║`);
        }
      }
      console.log(`╚══════════════════════════════════════╝\n`);
    }
  });
