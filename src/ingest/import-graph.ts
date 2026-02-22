// Sinapse — Import Graph Builder
// Builds directed graph: nodes=files, edges=imports

import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { ScannedFile } from './file-scanner.js';
import { parseFile } from './parser.js';
import type { CodeGraphNode, CodeGraphEdge, ImportGraph } from '../types/index.js';

const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

export function buildImportGraph(projectPath: string, files: ScannedFile[]): ImportGraph {
  const nodes = new Map<string, CodeGraphNode>();
  const edges: CodeGraphEdge[] = [];

  // Index files by relative path for quick lookup
  const filesByPath = new Map<string, ScannedFile>();
  for (const file of files) {
    filesByPath.set(file.relativePath, file);
  }

  // Parse each file
  for (const file of files) {
    const parsed = parseFile(file.absolutePath);

    const node: CodeGraphNode = {
      id: file.relativePath,
      path: file.absolutePath,
      language: file.language,
      imports: [],
      exports: parsed.exports,
      definitions: parsed.definitions,
      pagerank: 0,
    };

    // Resolve relative imports
    for (const imp of parsed.imports) {
      if (!imp.isRelative) continue;

      const resolved = resolveImport(
        imp.source,
        file.absolutePath,
        projectPath,
        filesByPath,
      );

      if (resolved) {
        node.imports.push(resolved);
        edges.push({
          source: file.relativePath,
          target: resolved,
          type: imp.isDynamic ? 'dynamic' : 'static',
        });
      }
    }

    nodes.set(file.relativePath, node);
  }

  return { nodes, edges };
}

function resolveImport(
  source: string,
  importerPath: string,
  projectPath: string,
  filesByPath: Map<string, unknown>,
): string | null {
  const importerDir = dirname(importerPath);
  const basePath = resolve(importerDir, source);

  // Try exact match with extensions
  for (const ext of EXTENSIONS) {
    const candidate = basePath + ext;
    const relCandidate = candidate
      .replace(projectPath, '')
      .replace(/\\/g, '/')
      .replace(/^\//, '');

    if (filesByPath.has(relCandidate)) {
      return relCandidate;
    }
  }

  // Try as directory (index files)
  for (const indexFile of INDEX_FILES) {
    const candidate = join(basePath, indexFile);
    const relCandidate = candidate
      .replace(projectPath, '')
      .replace(/\\/g, '/')
      .replace(/^\//, '');

    if (filesByPath.has(relCandidate)) {
      return relCandidate;
    }
  }

  // Try removing .js/.ts extension already in source
  const stripped = source.replace(/\.(js|ts|jsx|tsx|mjs|cjs|mts|cts)$/, '');
  if (stripped !== source) {
    return resolveImport(stripped, importerPath, projectPath, filesByPath);
  }

  return null;
}
