// Tests for import-graph builder
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildImportGraph } from '../../src/ingest/import-graph.js';
import type { ScannedFile } from '../../src/ingest/file-scanner.js';

const TMP = join(process.cwd(), 'tests', '_tmp_graph_builder');

beforeAll(() => {
  mkdirSync(join(TMP, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TMP, 'src', 'components'), { recursive: true });

  writeFileSync(join(TMP, 'src', 'index.ts'), `
import { helper } from './utils/helper';
import { Button } from './components/Button';
export const app = true;
`);

  writeFileSync(join(TMP, 'src', 'utils', 'helper.ts'), `
export function helper() { return 'help'; }
`);

  writeFileSync(join(TMP, 'src', 'components', 'Button.tsx'), `
import { helper } from '../utils/helper';
export function Button() { return '<button/>'; }
`);

  writeFileSync(join(TMP, 'src', 'utils', 'index.ts'), `
export { helper } from './helper';
`);
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function makeFiles(): ScannedFile[] {
  const base = TMP.replace(/\\/g, '/');
  return [
    { relativePath: 'src/index.ts', absolutePath: `${base}/src/index.ts`, language: 'typescript' as const, size: 100 },
    { relativePath: 'src/utils/helper.ts', absolutePath: `${base}/src/utils/helper.ts`, language: 'typescript' as const, size: 50 },
    { relativePath: 'src/components/Button.tsx', absolutePath: `${base}/src/components/Button.tsx`, language: 'typescript' as const, size: 80 },
    { relativePath: 'src/utils/index.ts', absolutePath: `${base}/src/utils/index.ts`, language: 'typescript' as const, size: 40 },
  ];
}

describe('buildImportGraph', () => {
  it('creates nodes for all files', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    expect(graph.nodes.size).toBe(4);
    expect(graph.nodes.has('src/index.ts')).toBe(true);
    expect(graph.nodes.has('src/utils/helper.ts')).toBe(true);
  });

  it('creates edges for resolved imports', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    // index.ts → utils/helper.ts
    const helperEdge = graph.edges.find(
      e => e.source === 'src/index.ts' && e.target === 'src/utils/helper.ts',
    );
    expect(helperEdge).toBeDefined();
  });

  it('resolves Button import from index', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    const btnEdge = graph.edges.find(
      e => e.source === 'src/index.ts' && e.target === 'src/components/Button.tsx',
    );
    expect(btnEdge).toBeDefined();
  });

  it('resolves cross-directory imports', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    // Button.tsx → utils/helper.ts
    const crossEdge = graph.edges.find(
      e => e.source === 'src/components/Button.tsx' && e.target === 'src/utils/helper.ts',
    );
    expect(crossEdge).toBeDefined();
  });

  it('sets all edges as static type', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    for (const edge of graph.edges) {
      expect(edge.type).toBe('static');
    }
  });

  it('handles barrel file re-exports', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    // utils/index.ts → utils/helper.ts
    const barrelEdge = graph.edges.find(
      e => e.source === 'src/utils/index.ts' && e.target === 'src/utils/helper.ts',
    );
    expect(barrelEdge).toBeDefined();
  });

  it('initializes pagerank to 0', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    for (const node of graph.nodes.values()) {
      expect(node.pagerank).toBe(0);
    }
  });

  it('populates node imports list', () => {
    const graph = buildImportGraph(TMP, makeFiles());
    const indexNode = graph.nodes.get('src/index.ts');
    expect(indexNode!.imports.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty graph for empty files', () => {
    const graph = buildImportGraph(TMP, []);
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.length).toBe(0);
  });
});
