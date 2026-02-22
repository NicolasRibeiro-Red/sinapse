// Sinapse — File Scanner
// Finds TS/JS files in a project, respects .gitignore

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { DEFAULT_CONFIG } from '../types/config.js';

const TS_JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  language: 'typescript' | 'javascript';
  size: number;
}

export function scanProject(projectPath: string, _options?: { force?: boolean }): ScannedFile[] {
  const excludePatterns = DEFAULT_CONFIG.ingest.excludePatterns;
  const gitignorePatterns = loadGitignore(projectPath);
  const allExclude = [...excludePatterns, ...gitignorePatterns];

  const files: ScannedFile[] = [];
  scanDir(projectPath, projectPath, allExclude, files);

  return files;
}

function scanDir(rootPath: string, dirPath: string, excludePatterns: string[], files: ScannedFile[]): void {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const name = entry.name;

    // Skip hidden files/dirs and excluded patterns
    if (name.startsWith('.')) continue;
    if (excludePatterns.some(p => name === p || name.includes(p))) continue;

    const fullPath = join(dirPath, name);

    if (entry.isDirectory()) {
      scanDir(rootPath, fullPath, excludePatterns, files);
    } else if (entry.isFile()) {
      const ext = extname(name);
      if (!TS_JS_EXTENSIONS.has(ext)) continue;

      const relPath = relative(rootPath, fullPath).replace(/\\/g, '/');
      const language = ext.startsWith('.ts') || ext === '.mts' || ext === '.cts'
        ? 'typescript' as const
        : 'javascript' as const;

      try {
        const stats = statSync(fullPath);
        files.push({
          absolutePath: fullPath,
          relativePath: relPath,
          language,
          size: stats.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }
}

function loadGitignore(projectPath: string): string[] {
  const gitignorePath = join(projectPath, '.gitignore');
  if (!existsSync(gitignorePath)) return [];

  try {
    const content = readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.replace(/\/$/, '')); // remove trailing /
  } catch {
    return [];
  }
}
