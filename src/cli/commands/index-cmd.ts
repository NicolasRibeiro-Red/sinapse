// sinapse index — Scan markdown files, parse frontmatter, upsert to SQLite

import { Command } from 'commander';
import { initDb, upsertMemoryBatch, closeDb } from '../../core/db.js';
import { scanAllMemoryFiles, readMemory } from '../../core/memory-store.js';
import { memoryToRow, contentHash } from '../../core/frontmatter.js';
import { getMetaDbPath } from '../../core/paths.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const indexCommand = new Command('index')
  .description('Rebuild SQLite index from memory files')
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const verbose = globalOpts.verbose ?? false;
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const db = initDb(getMetaDbPath());

    try {
      const files = scanAllMemoryFiles();

      if (verbose) {
        console.log(`Scanning ${files.length} memory files...`);
      }

      const rows = [];
      let parsed = 0;
      let errors = 0;

      for (const file of files) {
        try {
          const memory = readMemory(file);
          if (!memory) {
            errors++;
            continue;
          }
          rows.push(memoryToRow(memory));
          parsed++;
        } catch (e) {
          errors++;
          if (verbose) {
            console.error(`Error parsing ${file}: ${(e as Error).message}`);
          }
        }
      }

      if (rows.length > 0) {
        upsertMemoryBatch(db, rows);
      }

      if (json) {
        console.log(JSON.stringify({ indexed: parsed, errors, total: files.length }));
      } else {
        console.log(`sinapse index: ${parsed} memories indexed, ${errors} errors`);
      }
    } finally {
      closeDb();
    }
  });
