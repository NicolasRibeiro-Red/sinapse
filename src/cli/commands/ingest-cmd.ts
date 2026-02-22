// sinapse ingest — Full pipeline: scan → parse → graph → pagerank → DNA

import { Command } from 'commander';
import { resolve } from 'node:path';
import { ensureDirectoryStructure, detectProject, ensureProjectNamespace } from '../../core/namespace.js';
import { scanProject } from '../../ingest/file-scanner.js';
import { buildImportGraph } from '../../ingest/import-graph.js';
import { calculatePageRank } from '../../ingest/pagerank.js';
import { gatherProjectMetadata, generateDNATemplate, saveDNA } from '../../ingest/project-dna.js';
import { isCacheValid } from '../../ingest/cache.js';
import { initDb, upsertCodeGraphNodeBatch, upsertCodeGraphEdgeBatch, clearCodeGraph, closeDb } from '../../core/db.js';
import { getMetaDbPath } from '../../core/paths.js';

export const ingestCommand = new Command('ingest')
  .description('Parse project and generate Project DNA')
  .argument('[path]', 'Project path', process.cwd())
  .option('--force', 'Force re-parse even if cached')
  .action(async (rawPath, opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;
    const verbose = globalOpts.verbose ?? false;
    const force = opts.force ?? false;
    const projectPath = resolve(rawPath);

    ensureDirectoryStructure();
    const project = detectProject(projectPath);

    if (!project) {
      console.error('No project detected. Run from a git repo or directory with package.json.');
      process.exit(1);
    }

    // Check cache
    if (!force && isCacheValid(project.slug, projectPath)) {
      if (json) {
        console.log(JSON.stringify({ project: project.name, slug: project.slug, cached: true }));
      } else {
        console.log(`sinapse ingest: "${project.name}" cached (use --force to re-parse)`);
      }
      return;
    }

    ensureProjectNamespace(project.slug);
    const startTime = Date.now();

    // Step 1: Scan files
    if (verbose) console.log('Scanning files...');
    const files = scanProject(projectPath);
    if (verbose) console.log(`Found ${files.length} TS/JS files`);

    // Step 2-3: Build import graph
    if (verbose) console.log('Building import graph...');
    const graph = buildImportGraph(projectPath, files);

    // Step 4: Calculate PageRank
    if (verbose) console.log('Calculating PageRank...');
    const prResult = calculatePageRank(graph);
    if (verbose) console.log(`PageRank: ${prResult.iterations} iterations, converged: ${prResult.converged}`);

    // Step 5: Generate DNA
    if (verbose) console.log('Generating Project DNA...');
    const metadata = gatherProjectMetadata(projectPath);
    const dnaContent = generateDNATemplate(metadata, prResult.topFiles.map(f => ({ path: f.path, pagerank: f.score })));
    const dnaPath = saveDNA(project.slug, dnaContent);

    // Save to SQLite
    try {
      const db = initDb(getMetaDbPath());
      clearCodeGraph(db, project.slug);

      const nodeRows = Array.from(graph.nodes.values()).map(n => ({
        path: n.id,
        language: n.language,
        imports: JSON.stringify(n.imports),
        exports: JSON.stringify(n.exports),
        definitions: JSON.stringify(n.definitions),
        pagerank: n.pagerank,
        project: project.slug,
      }));

      const edgeRows = graph.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        project: project.slug,
      }));

      if (nodeRows.length > 0) upsertCodeGraphNodeBatch(db, nodeRows);
      if (edgeRows.length > 0) upsertCodeGraphEdgeBatch(db, edgeRows);
      closeDb();
    } catch (e) {
      if (verbose) console.error('SQLite save error:', (e as Error).message);
    }

    const duration = Date.now() - startTime;
    const tokenEstimate = Math.round(dnaContent.length / 4); // rough

    if (json) {
      console.log(JSON.stringify({
        project: project.name,
        slug: project.slug,
        files: files.length,
        nodes: graph.nodes.size,
        edges: graph.edges.length,
        pagerankIterations: prResult.iterations,
        converged: prResult.converged,
        topFiles: prResult.topFiles.slice(0, 5),
        dnaPath,
        tokenEstimate,
        durationMs: duration,
      }));
    } else {
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║  SINAPSE INGEST                      ║`);
      console.log(`╠══════════════════════════════════════╣`);
      console.log(`║  Project: ${project.name.padEnd(25).slice(0, 25)} ║`);
      console.log(`║  Files: ${String(files.length).padStart(6)}                       ║`);
      console.log(`║  Nodes: ${String(graph.nodes.size).padStart(6)}  Edges: ${String(graph.edges.length).padStart(5)}        ║`);
      console.log(`║  PageRank: ${String(prResult.iterations).padStart(3)} iter (${prResult.converged ? 'converged' : 'max iter'})  ║`);
      console.log(`║  DNA: ~${String(tokenEstimate).padStart(5)} tokens              ║`);
      console.log(`║  Time: ${String(duration).padStart(6)}ms                    ║`);
      console.log(`╠══════════════════════════════════════╣`);
      console.log(`║  Top Files:                          ║`);
      for (const file of prResult.topFiles.slice(0, 5)) {
        const shortPath = file.path.length > 30 ? '...' + file.path.slice(-27) : file.path;
        console.log(`║  ${file.score.toFixed(3)} ${shortPath.padEnd(30).slice(0, 30)} ║`);
      }
      console.log(`╚══════════════════════════════════════╝\n`);
    }
  });
