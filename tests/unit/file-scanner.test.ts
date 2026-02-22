// Tests for file-scanner module
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { scanProject } from '../../src/ingest/file-scanner.js';

const TMP = join(process.cwd(), 'tests', '_tmp_scanner');

beforeAll(() => {
  mkdirSync(join(TMP, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TMP, 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(join(TMP, 'dist'), { recursive: true });
  mkdirSync(join(TMP, '.git'), { recursive: true });
  mkdirSync(join(TMP, 'assets'), { recursive: true });

  // TS/JS source files
  writeFileSync(join(TMP, 'src', 'index.ts'), 'export const x = 1;');
  writeFileSync(join(TMP, 'src', 'app.tsx'), 'export default () => <div/>;');
  writeFileSync(join(TMP, 'src', 'utils', 'helper.js'), 'module.exports = {};');
  writeFileSync(join(TMP, 'src', 'utils', 'types.mts'), 'export type T = string;');

  // Should be excluded
  writeFileSync(join(TMP, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};');
  writeFileSync(join(TMP, 'dist', 'index.js'), 'compiled');
  writeFileSync(join(TMP, '.git', 'config'), 'git config');

  // Non-JS file
  writeFileSync(join(TMP, 'assets', 'logo.png'), 'binary');

  // .gitignore
  writeFileSync(join(TMP, '.gitignore'), 'build/\n*.log\n');
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('scanProject', () => {
  it('finds TS/JS files in src/', () => {
    const files = scanProject(TMP);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/app.tsx');
    expect(paths).toContain('src/utils/helper.js');
    expect(paths).toContain('src/utils/types.mts');
  });

  it('excludes node_modules', () => {
    const files = scanProject(TMP);
    const paths = files.map(f => f.relativePath);
    expect(paths.every(p => !p.includes('node_modules'))).toBe(true);
  });

  it('excludes dist', () => {
    const files = scanProject(TMP);
    const paths = files.map(f => f.relativePath);
    expect(paths.every(p => !p.startsWith('dist/'))).toBe(true);
  });

  it('excludes .git', () => {
    const files = scanProject(TMP);
    const paths = files.map(f => f.relativePath);
    expect(paths.every(p => !p.startsWith('.git/'))).toBe(true);
  });

  it('excludes non-JS files', () => {
    const files = scanProject(TMP);
    const paths = files.map(f => f.relativePath);
    expect(paths.every(p => !p.endsWith('.png'))).toBe(true);
  });

  it('detects correct language', () => {
    const files = scanProject(TMP);
    const tsFile = files.find(f => f.relativePath === 'src/index.ts');
    const jsFile = files.find(f => f.relativePath === 'src/utils/helper.js');
    expect(tsFile?.language).toBe('typescript');
    expect(jsFile?.language).toBe('javascript');
  });

  it('provides absolute paths', () => {
    const files = scanProject(TMP);
    const normalizedTmp = TMP.replace(/\\/g, '/').toLowerCase();
    for (const f of files) {
      const normalizedPath = f.absolutePath.replace(/\\/g, '/').toLowerCase();
      expect(normalizedPath.includes(normalizedTmp) || normalizedPath.includes('_tmp_scanner')).toBe(true);
    }
  });

  it('returns empty for empty project', () => {
    const emptyDir = join(TMP, 'assets'); // no JS/TS files
    const files = scanProject(emptyDir);
    expect(files.length).toBe(0);
  });
});
