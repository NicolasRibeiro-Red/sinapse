// sinapse save — Create a new memory from CLI args

import { Command } from 'commander';
import { saveMemory } from '../../core/memory-store.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import { getDb, upsertMemory } from '../../core/db.js';
import { getMetaDbPath } from '../../core/paths.js';
import { createHash } from 'node:crypto';
import { MemoryType } from '../../types/index.js';

const VALID_TYPES = Object.values(MemoryType);

export const saveCommand = new Command('save')
  .description('Create a new memory')
  .requiredOption('--title <title>', 'Memory title')
  .requiredOption('--content <content>', 'Memory content (markdown)')
  .requiredOption('--type <type>', `Memory type: ${VALID_TYPES.join(', ')}`)
  .requiredOption('--importance <n>', 'Importance score (0-10)', parseFloat)
  .option('--agent <agent>', 'Agent namespace', 'pandora')
  .option('--tags <tags>', 'Comma-separated tags', '')
  .option('--project <project>', 'Project slug')
  .option('--status <status>', 'Memory status', 'active')
  .option('--links <links>', 'Comma-separated memory IDs to link')
  .option('--supersedes <id>', 'Memory ID this supersedes')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    // Validate type
    if (!VALID_TYPES.includes(opts.type as MemoryType)) {
      console.error(`Invalid type "${opts.type}". Valid: ${VALID_TYPES.join(', ')}`);
      process.exit(1);
    }

    // Validate importance
    if (isNaN(opts.importance) || opts.importance < 0 || opts.importance > 10) {
      console.error('Importance must be a number between 0 and 10');
      process.exit(1);
    }

    ensureDirectoryStructure();

    const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const links = opts.links ? opts.links.split(',').map((l: string) => l.trim()).filter(Boolean) : [];

    // Save memory file
    const memory = saveMemory({
      title: opts.title,
      content: opts.content,
      type: opts.type as MemoryType,
      importance: opts.importance,
      agent: opts.agent,
      project: opts.project ?? null,
      tags,
      links,
      supersedes: opts.supersedes ?? null,
    });

    // Index in SQLite
    const db = getDb(getMetaDbPath());
    const contentHash = createHash('sha256').update(memory.content).digest('hex').slice(0, 16);

    upsertMemory(db, {
      id: memory.id,
      importance: memory.importance,
      agent: memory.agent,
      project: memory.project,
      tags: JSON.stringify(memory.tags),
      type: memory.type,
      created: memory.created,
      updated: memory.updated,
      accessed: memory.accessed,
      access_count: memory.access_count,
      decay_rate: memory.decay_rate,
      effective_score: memory.effective_score,
      status: memory.status,
      links: JSON.stringify(memory.links),
      supersedes: memory.supersedes,
      title: memory.title,
      content_hash: contentHash,
      file_path: memory.filePath,
    });

    if (json) {
      console.log(JSON.stringify({
        id: memory.id,
        title: memory.title,
        type: memory.type,
        importance: memory.importance,
        agent: memory.agent,
        filePath: memory.filePath,
      }));
    } else {
      console.log(`Memory saved: ${memory.id}`);
      console.log(`  Title: ${memory.title}`);
      console.log(`  Type: ${memory.type} | Importance: ${memory.importance}`);
      console.log(`  Agent: ${memory.agent}`);
      console.log(`  File: ${memory.filePath}`);
    }
  });
