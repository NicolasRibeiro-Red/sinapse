// Sinapse — Import/Export Parser
// Uses regex-based parsing (simpler than tree-sitter WASM for v0.1)
// Extracts: static imports, dynamic imports, exports, definitions

import { readFileSync } from 'node:fs';

export interface ParsedFile {
  imports: ParsedImport[];
  exports: string[];
  definitions: string[];
}

export interface ParsedImport {
  source: string;        // the module specifier
  isRelative: boolean;
  isDynamic: boolean;
  names: string[];       // imported names
}

// Regex patterns for import extraction
const STATIC_IMPORT_RE = /import\s+(?:(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /(?:const|let|var)\s+(?:(\{[^}]+\})|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_DEFAULT_RE = /export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/g;
const EXPORT_NAMED_RE = /export\s+(?:const|let|var|function|class|enum|interface|type|abstract\s+class)\s+(\w+)/g;
const EXPORT_FROM_RE = /export\s+(?:\{[^}]+\}|\*)\s+from\s+['"]([^'"]+)['"]/g;
const FUNCTION_RE = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
const CLASS_RE = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;

export function parseFile(filePath: string): ParsedFile {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return { imports: [], exports: [], definitions: [] };
  }

  return parseContent(content);
}

export function parseContent(content: string): ParsedFile {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const definitions = extractDefinitions(content);

  return { imports, exports, definitions };
}

function extractImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const seen = new Set<string>();

  // Static imports
  let match;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(content)) !== null) {
    const source = match[4]!;
    if (seen.has(source)) continue;
    seen.add(source);

    const names: string[] = [];
    if (match[1]) {
      // Named imports: { a, b, c }
      names.push(...match[1].replace(/[{}]/g, '').split(',').map(n => n.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean));
    }
    if (match[2]) {
      // Namespace: * as foo
      names.push(match[2].replace('* as ', '').trim());
    }
    if (match[3]) {
      // Default: import foo
      names.push(match[3]);
    }

    imports.push({
      source,
      isRelative: source.startsWith('.') || source.startsWith('/'),
      isDynamic: false,
      names,
    });
  }

  // Dynamic imports
  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
    const source = match[1]!;
    if (seen.has(source)) continue;
    seen.add(source);

    imports.push({
      source,
      isRelative: source.startsWith('.') || source.startsWith('/'),
      isDynamic: true,
      names: [],
    });
  }

  // require() calls
  REQUIRE_RE.lastIndex = 0;
  while ((match = REQUIRE_RE.exec(content)) !== null) {
    const source = match[3]!;
    if (seen.has(source)) continue;
    seen.add(source);

    const names: string[] = [];
    if (match[1]) {
      names.push(...match[1].replace(/[{}]/g, '').split(',').map(n => n.trim()).filter(Boolean));
    }
    if (match[2]) {
      names.push(match[2]);
    }

    imports.push({
      source,
      isRelative: source.startsWith('.') || source.startsWith('/'),
      isDynamic: false,
      names,
    });
  }

  // Re-exports (export { ... } from '...')
  EXPORT_FROM_RE.lastIndex = 0;
  while ((match = EXPORT_FROM_RE.exec(content)) !== null) {
    const source = match[1]!;
    if (seen.has(source)) continue;
    seen.add(source);

    imports.push({
      source,
      isRelative: source.startsWith('.') || source.startsWith('/'),
      isDynamic: false,
      names: [],
    });
  }

  return imports;
}

const EXPORT_FROM_NAMES_RE = /export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g;

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const seen = new Set<string>();

  let match;

  EXPORT_NAMED_RE.lastIndex = 0;
  while ((match = EXPORT_NAMED_RE.exec(content)) !== null) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      exports.push(name);
    }
  }

  EXPORT_DEFAULT_RE.lastIndex = 0;
  while ((match = EXPORT_DEFAULT_RE.exec(content)) !== null) {
    const name = match[1] || 'default';
    if (!seen.has(name)) {
      seen.add(name);
      exports.push(name);
    }
  }

  // Re-exports: export { alpha, beta } from './source'
  EXPORT_FROM_NAMES_RE.lastIndex = 0;
  while ((match = EXPORT_FROM_NAMES_RE.exec(content)) !== null) {
    const names = match[1]!.split(',').map(n => n.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
    for (const name of names) {
      if (!seen.has(name)) {
        seen.add(name);
        exports.push(name);
      }
    }
  }

  return exports;
}

function extractDefinitions(content: string): string[] {
  const defs: string[] = [];
  const seen = new Set<string>();

  let match;

  FUNCTION_RE.lastIndex = 0;
  while ((match = FUNCTION_RE.exec(content)) !== null) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      defs.push(name);
    }
  }

  CLASS_RE.lastIndex = 0;
  while ((match = CLASS_RE.exec(content)) !== null) {
    const name = match[1]!;
    if (!seen.has(name)) {
      seen.add(name);
      defs.push(name);
    }
  }

  return defs;
}
