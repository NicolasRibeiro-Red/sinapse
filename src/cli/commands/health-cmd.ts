// sinapse health — Health score with breakdown

import { Command } from 'commander';
import { calculateHealth, healthGauge, healthRangeLabel } from '../../core/health.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const healthCommand = new Command('health')
  .description('Calculate context health score (0-100)')
  .option('--agent <agent>', 'Filter by agent')
  .option('--project <project>', 'Filter by project')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const report = calculateHealth(undefined, {
      agent: opts.agent,
      project: opts.project,
    });

    if (json) {
      console.log(JSON.stringify(report));
    } else {
      const b = report.breakdown;
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║  SINAPSE HEALTH                      ║`);
      console.log(`╠══════════════════════════════════════╣`);
      console.log(`║  ${healthGauge(report.score).padEnd(36)} ║`);
      console.log(`╠══════════════════════════════════════╣`);
      console.log(`║  Memories: ${String(report.totalMemories).padStart(4)}                     ║`);
      console.log(`║  Stale (7d+): ${String(b.staleCount).padStart(3)} (-${b.stalePenalty})${' '.repeat(17 - String(b.stalePenalty).length)}║`);
      console.log(`║  Duplicates: ${String(b.dupeCount).padStart(4)} (-${b.dupePenalty})${' '.repeat(17 - String(b.dupePenalty).length)}║`);
      console.log(`║  Avg age: ${String(b.avgAgeDays).padStart(6)}d (-${b.agePenalty})${' '.repeat(15 - String(b.agePenalty).length)}║`);
      console.log(`║  Low score: ${String(b.lowScoreCount).padStart(4)} (-${b.lowScorePenalty})${' '.repeat(17 - String(b.lowScorePenalty).length)}║`);
      console.log(`║  Pinned: ${String(b.pinnedCount).padStart(7)} (+${b.pinnedBonus})${' '.repeat(17 - String(b.pinnedBonus).length)}║`);
      console.log(`║  Links: ${String(b.linksCount).padStart(8)} (+${b.linksBonus})${' '.repeat(17 - String(b.linksBonus).length)}║`);
      console.log(`╚══════════════════════════════════════╝\n`);
    }
  });
