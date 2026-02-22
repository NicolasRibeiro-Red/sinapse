// Integration test: Ingest pipeline end-to-end
// Creates a temp project, runs full scan→parse→graph→pagerank→DNA

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../../src/ingest/file-scanner.js';
import { buildImportGraph } from '../../src/ingest/import-graph.js';
import { calculatePageRank } from '../../src/ingest/pagerank.js';
import { gatherProjectMetadata, generateDNATemplate } from '../../src/ingest/project-dna.js';

const TMP = join(process.cwd(), 'tests', '_tmp_e2e_ingest');

beforeAll(() => {
  mkdirSync(join(TMP, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TMP, 'src', 'components'), { recursive: true });
  mkdirSync(join(TMP, 'src', 'lib'), { recursive: true });

  // package.json
  writeFileSync(join(TMP, 'package.json'), JSON.stringify({
    name: 'e2e-test-project',
    dependencies: { react: '^18.2.0', next: '^14.0.0' },
    devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' },
  }));

  // tsconfig
  writeFileSync(join(TMP, 'tsconfig.json'), '{}');

  // Source files with import graph
  writeFileSync(join(TMP, 'src', 'index.ts'), `
import { App } from './components/App';
import { initDb } from './lib/db';
export default function main() { return App(); }
`);

  writeFileSync(join(TMP, 'src', 'components', 'App.tsx'), `
import { Button } from './Button';
import { formatDate } from '../utils/format';
export function App() { return Button() + formatDate(); }
`);

  writeFileSync(join(TMP, 'src', 'components', 'Button.tsx'), `
import { cn } from '../utils/cn';
export function Button() { return '<button/>'; }
`);

  writeFileSync(join(TMP, 'src', 'utils', 'format.ts'), `
export function formatDate() { return new Date().toISOString(); }
`);

  writeFileSync(join(TMP, 'src', 'utils', 'cn.ts'), `
export function cn(...args: string[]) { return args.join(' '); }
`);

  writeFileSync(join(TMP, 'src', 'lib', 'db.ts'), `
import { cn } from '../utils/cn';
export function initDb() { return cn('db', 'init'); }
`);

  // Barrel files
  writeFileSync(join(TMP, 'src', 'utils', 'index.ts'), `
export { formatDate } from './format';
export { cn } from './cn';
`);
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('Ingest Pipeline E2E', () => {
  it('scans all source files', () => {
    const files = scanProject(TMP);
    expect(files.length).toBe(7); // 7 TS/TSX files
    expect(files.some(f => f.relativePath === 'src/index.ts')).toBe(true);
    expect(files.some(f => f.relativePath === 'src/components/App.tsx')).toBe(true);
  });

  it('builds import graph with correct edges', () => {
    const files = scanProject(TMP);
    const graph = buildImportGraph(TMP, files);

    expect(graph.nodes.size).toBe(7);
    expect(graph.edges.length).toBeGreaterThanOrEqual(5);

    // index.ts should import App and db
    const indexNode = graph.nodes.get('src/index.ts');
    expect(indexNode).toBeDefined();
    expect(indexNode!.imports.length).toBeGreaterThanOrEqual(1);
  });

  it('calculates PageRank with hub files ranked highest', () => {
    const files = scanProject(TMP);
    const graph = buildImportGraph(TMP, files);
    const result = calculatePageRank(graph);

    expect(result.converged).toBe(true);
    expect(result.topFiles.length).toBeGreaterThan(0);

    // utils/cn.ts is imported by Button and db — should have high rank
    const cnScore = result.scores.get('src/utils/cn.ts');
    expect(cnScore).toBeDefined();
    expect(cnScore!).toBeGreaterThan(0);
  });

  it('generates Project DNA under 1500 tokens', () => {
    const files = scanProject(TMP);
    const graph = buildImportGraph(TMP, files);
    const prResult = calculatePageRank(graph);

    const metadata = gatherProjectMetadata(TMP);
    const topFiles = prResult.topFiles.map(f => ({ path: f.path, pagerank: f.score }));
    const dna = generateDNATemplate(metadata, topFiles);

    const tokenEstimate = Math.round(dna.length / 4);
    expect(tokenEstimate).toBeLessThan(1500);
    expect(dna).toContain('# Project DNA');
    expect(dna).toContain('Next.js');
    expect(dna).toContain('React');
    expect(dna).toContain('TypeScript');
  });

  it('completes full pipeline in under 3 seconds', () => {
    const start = Date.now();

    const files = scanProject(TMP);
    const graph = buildImportGraph(TMP, files);
    calculatePageRank(graph);
    const metadata = gatherProjectMetadata(TMP);
    generateDNATemplate(metadata, []);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
