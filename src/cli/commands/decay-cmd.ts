// sinapse decay — Recalculate effective scores, move decayed to archived

import { Command } from 'commander';
import { runDecay } from '../../core/decay.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const decayCommand = new Command('decay')
  .description('Recalculate effective scores and archive decayed memories')
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const result = runDecay();

    if (json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`sinapse decay: ${result.totalProcessed} processed, ${result.updated} updated, ${result.archived} archived, ${result.gcEligible} gc-eligible`);
    }
  });
