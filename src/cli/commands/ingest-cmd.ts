// sinapse ingest — Parse project, build code graph, generate DNA
// Placeholder — full implementation in Story 3.3

import { Command } from 'commander';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import { detectProject } from '../../core/namespace.js';

export const ingestCommand = new Command('ingest')
  .description('Parse project and generate Project DNA')
  .argument('[path]', 'Project path', process.cwd())
  .option('--force', 'Force re-parse even if cached')
  .action(async (projectPath, opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const project = detectProject(projectPath);

    if (!project) {
      console.error('No project detected. Run from a git repo or directory with package.json.');
      process.exit(1);
    }

    // TODO: Implement full pipeline in Story 3.1-3.3
    // 1. Scan files (file-scanner.ts)
    // 2. Parse imports/exports (parser.ts via tree-sitter)
    // 3. Build import graph (import-graph.ts)
    // 4. Calculate PageRank (pagerank.ts)
    // 5. Generate DNA (project-dna.ts)

    if (json) {
      console.log(JSON.stringify({
        project: project.name,
        slug: project.slug,
        status: 'not_implemented',
        message: 'Ingest pipeline pending tree-sitter integration',
      }));
    } else {
      console.log(`sinapse ingest: detected project "${project.name}" (${project.slug})`);
      console.log('Ingest pipeline pending tree-sitter integration (Story 3.x)');
    }
  });
