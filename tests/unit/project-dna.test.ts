// Tests for project-dna module
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gatherProjectMetadata, generateDNATemplate, saveDNA } from '../../src/ingest/project-dna.js';

const TMP = join(process.cwd(), 'tests', '_tmp_dna');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'package.json'), JSON.stringify({
    name: 'test-project',
    dependencies: {
      'react': '^18.2.0',
      'next': '^14.0.0',
      '@supabase/supabase-js': '^2.0.0',
    },
    devDependencies: {
      'typescript': '^5.0.0',
      'vitest': '^1.0.0',
    },
    scripts: {
      start: 'next start',
    },
  }));
  writeFileSync(join(TMP, 'tsconfig.json'), '{}');
  writeFileSync(join(TMP, 'README.md'), '# Test');
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('gatherProjectMetadata', () => {
  it('detects stack from package.json', () => {
    const meta = gatherProjectMetadata(TMP);
    expect(meta.stack).toBeDefined();
    expect(meta.stack!.some(s => s.includes('Next.js'))).toBe(true);
    expect(meta.stack!.some(s => s.includes('React'))).toBe(true);
    expect(meta.stack!.some(s => s.includes('TypeScript'))).toBe(true);
    expect(meta.stack!.some(s => s.includes('Supabase'))).toBe(true);
  });

  it('detects patterns', () => {
    const meta = gatherProjectMetadata(TMP);
    expect(meta.patterns).toContain('Next.js');
    expect(meta.patterns).toContain('TypeScript');
    expect(meta.patterns).toContain('Vitest');
    expect(meta.patterns).toContain('README');
  });

  it('extracts critical dependencies', () => {
    const meta = gatherProjectMetadata(TMP);
    expect(meta.dependencies).toBeDefined();
    expect(Object.keys(meta.dependencies!).length).toBeGreaterThan(0);
    expect(meta.dependencies!['react']).toBe('^18.2.0');
  });

  it('generates slug from directory name', () => {
    const meta = gatherProjectMetadata(TMP);
    expect(meta.slug).toBeDefined();
    expect(meta.slug!.length).toBeGreaterThan(0);
  });
});

describe('generateDNATemplate', () => {
  it('generates markdown with frontmatter', () => {
    const dna = generateDNATemplate(
      { slug: 'test', name: 'Test', stack: ['TypeScript'], gitHead: 'abc123' },
      [{ path: 'src/index.ts', pagerank: 0.95 }],
    );
    expect(dna).toContain('---');
    expect(dna).toContain('project: test');
    expect(dna).toContain('git_head: abc123');
    expect(dna).toContain('# Project DNA: Test');
  });

  it('includes stack section', () => {
    const dna = generateDNATemplate(
      { slug: 'x', name: 'X', stack: ['React', 'TypeScript'], gitHead: 'h' },
      [],
    );
    expect(dna).toContain('## Stack');
    expect(dna).toContain('React, TypeScript');
  });

  it('includes top files section', () => {
    const dna = generateDNATemplate(
      { slug: 'x', name: 'X', gitHead: 'h' },
      [{ path: 'src/main.ts', pagerank: 1.0 }, { path: 'src/utils.ts', pagerank: 0.5 }],
    );
    expect(dna).toContain('## Top Files');
    expect(dna).toContain('src/main.ts');
    expect(dna).toContain('src/utils.ts');
  });

  it('includes dependencies section', () => {
    const dna = generateDNATemplate(
      { slug: 'x', name: 'X', dependencies: { react: '^18' }, gitHead: 'h' },
      [],
    );
    expect(dna).toContain('## Critical Dependencies');
    expect(dna).toContain('react: ^18');
  });

  it('handles empty metadata gracefully', () => {
    const dna = generateDNATemplate({ slug: 'e', name: 'E', gitHead: 'h' }, []);
    expect(dna).toContain('# Project DNA: E');
    expect(dna).not.toContain('## Stack');
  });
});

describe('generateDNATemplate output', () => {
  it('generates content with expected length', () => {
    const content = generateDNATemplate(
      { slug: 't', name: 'Test Project', stack: ['TypeScript', 'React'], dependencies: { react: '^18' }, gitHead: 'abc' },
      [{ path: 'src/index.ts', pagerank: 1.0 }, { path: 'src/utils.ts', pagerank: 0.5 }],
    );
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('git_head: abc');
    expect(content).toContain('TypeScript, React');
  });
});
