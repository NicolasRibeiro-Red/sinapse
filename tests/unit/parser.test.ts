// Tests for regex-based parser module
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile } from '../../src/ingest/parser.js';

const TMP = join(process.cwd(), 'tests', '_tmp_parser');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const p = join(TMP, name);
  writeFileSync(p, content);
  return p;
}

describe('parseFile', () => {
  it('extracts named imports', () => {
    const f = writeTmp('named.ts', `import { foo, bar } from './utils';`);
    const result = parseFile(f);
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source).toBe('./utils');
    expect(result.imports[0].isRelative).toBe(true);
    expect(result.imports[0].isDynamic).toBe(false);
    expect(result.imports[0].names).toContain('foo');
    expect(result.imports[0].names).toContain('bar');
  });

  it('extracts default imports', () => {
    const f = writeTmp('default.ts', `import React from 'react';`);
    const result = parseFile(f);
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source).toBe('react');
    expect(result.imports[0].isRelative).toBe(false);
    expect(result.imports[0].names).toContain('React');
  });

  it('extracts namespace imports', () => {
    const f = writeTmp('namespace.ts', `import * as path from 'node:path';`);
    const result = parseFile(f);
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source).toBe('node:path');
    // Parser extracts the alias name, not the full "* as X" syntax
    expect(result.imports[0].names).toContain('path');
  });

  it('extracts dynamic imports', () => {
    const f = writeTmp('dynamic.ts', `const mod = await import('./lazy-module');`);
    const result = parseFile(f);
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].isDynamic).toBe(true);
    expect(result.imports[0].source).toBe('./lazy-module');
  });

  it('extracts require calls', () => {
    const f = writeTmp('require.js', `const fs = require('node:fs');`);
    const result = parseFile(f);
    expect(result.imports.length).toBe(1);
    expect(result.imports[0].source).toBe('node:fs');
    expect(result.imports[0].isDynamic).toBe(false);
  });

  it('extracts export default', () => {
    const f = writeTmp('exp-default.ts', `export default function main() {}`);
    const result = parseFile(f);
    // Named default exports capture the function name
    expect(result.exports).toContain('main');
  });

  it('extracts named exports', () => {
    const f = writeTmp('exp-named.ts', `export const FOO = 1;\nexport function bar() {}`);
    const result = parseFile(f);
    expect(result.exports).toContain('FOO');
    expect(result.exports).toContain('bar');
  });

  it('extracts re-exports', () => {
    const f = writeTmp('reexport.ts', `export { alpha, beta } from './source';`);
    const result = parseFile(f);
    expect(result.exports).toContain('alpha');
    expect(result.exports).toContain('beta');
    // Re-export is also an import
    expect(result.imports.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts function definitions', () => {
    const f = writeTmp('defs.ts', `function doStuff() {}\nclass MyClass {}\nexport function exported() {}`);
    const result = parseFile(f);
    expect(result.definitions).toContain('doStuff');
    expect(result.definitions).toContain('MyClass');
    expect(result.definitions).toContain('exported');
  });

  it('handles empty file', () => {
    const f = writeTmp('empty.ts', '');
    const result = parseFile(f);
    expect(result.imports.length).toBe(0);
    expect(result.exports.length).toBe(0);
    expect(result.definitions.length).toBe(0);
  });

  it('handles file with only comments', () => {
    const f = writeTmp('comments.ts', '// just a comment\n/* block */');
    const result = parseFile(f);
    expect(result.imports.length).toBe(0);
  });

  it('deduplicates exports', () => {
    const f = writeTmp('dedup.ts', `export function foo() {}\nexport { foo } from './other';`);
    const result = parseFile(f);
    const fooCount = result.exports.filter(e => e === 'foo').length;
    expect(fooCount).toBe(1);
  });
});
