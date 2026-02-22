// sinapse gc — Garbage collect memories with score < 1.0

import { Command } from 'commander';
import { runGC } from '../../core/decay.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const gcCommand = new Command('gc')
  .description('Delete memories with effective score below threshold')
  .option('--dry-run', 'Simulate without deleting')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;
    const dryRun = opts.dryRun ?? false;

    ensureDirectoryStructure();
    const result = runGC(dryRun);

    if (json) {
      console.log(JSON.stringify(result));
    } else {
      const prefix = dryRun ? '[DRY RUN] ' : '';
      console.log(`${prefix}sinapse gc: ${result.deleted} memories ${dryRun ? 'would be ' : ''}deleted`);
      if (result.ids.length > 0 && !json) {
        for (const id of result.ids) {
          console.log(`  - ${id}`);
        }
      }
    }
  });
