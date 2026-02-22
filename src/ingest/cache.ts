// Sinapse — Ingest Cache
// Caches by git HEAD hash, --force flag bypasses

import { existsSync, readFileSync } from 'node:fs';
import { getProjectDnaPath } from '../core/paths.js';
import { getGitHead } from '../core/namespace.js';

export function isCacheValid(projectSlug: string, projectPath: string): boolean {
  const dnaPath = getProjectDnaPath(projectSlug);
  if (!existsSync(dnaPath)) return false;

  const currentHead = getGitHead(projectPath);
  if (!currentHead) return false;

  try {
    const content = readFileSync(dnaPath, 'utf-8');
    return content.includes(`git_head: ${currentHead}`);
  } catch {
    return false;
  }
}

export function getCacheKey(projectPath: string): string | null {
  return getGitHead(projectPath);
}
