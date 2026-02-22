// Sinapse — Project DNA Generator
// Gathers metadata + top files to create ~1K token project representation

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import type { ProjectDNA } from '../types/index.js';
import { getProjectDnaPath } from '../core/paths.js';
import { slugify, getGitHead } from '../core/namespace.js';

export function gatherProjectMetadata(projectPath: string): Partial<ProjectDNA> {
  const name = basename(projectPath);
  const slug = slugify(name);
  const stack: string[] = [];
  const dependencies: Record<string, string> = {};
  const patterns: string[] = [];
  let entrypoints: string[] = [];

  // package.json
  const pkgPath = join(projectPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // Detect stack
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['next']) { stack.push(`Next.js ${allDeps['next']}`); patterns.push('Next.js'); }
      if (allDeps['react']) { stack.push(`React ${allDeps['react']}`); }
      if (allDeps['vue']) { stack.push(`Vue ${allDeps['vue']}`); }
      if (allDeps['express'] || allDeps['fastify']) { stack.push('Server'); }
      if (allDeps['typescript']) { stack.push('TypeScript'); patterns.push('TypeScript'); }
      if (allDeps['@supabase/ssr'] || allDeps['@supabase/supabase-js']) { stack.push('Supabase'); }
      if (allDeps['prisma'] || allDeps['@prisma/client']) { stack.push('Prisma'); }
      if (allDeps['drizzle-orm']) { stack.push('Drizzle'); }
      if (allDeps['vitest']) { patterns.push('Vitest'); }
      if (allDeps['jest']) { patterns.push('Jest'); }

      // Critical deps (top 10)
      const criticalDeps = Object.entries(allDeps || {})
        .filter(([name]) => !name.startsWith('@types/'))
        .slice(0, 10);
      for (const [dep, ver] of criticalDeps) {
        dependencies[dep] = ver as string;
      }

      // Entry points from scripts
      if (pkg.main) entrypoints.push(pkg.main);
      if (pkg.scripts?.start) {
        const startMatch = pkg.scripts.start.match(/(?:node|ts-node|tsx)\s+(.+?)(?:\s|$)/);
        if (startMatch) entrypoints.push(startMatch[1]);
      }
    } catch {}
  }

  // tsconfig.json
  if (existsSync(join(projectPath, 'tsconfig.json'))) {
    if (!stack.includes('TypeScript')) stack.push('TypeScript');
  }

  // Git log (recent decisions)
  const recentDecisions: string[] = [];
  try {
    const log = execSync('git log --oneline -20', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    recentDecisions.push(...log.trim().split('\n').filter(Boolean).slice(0, 10));
  } catch {}

  // README
  const readmePath = join(projectPath, 'README.md');
  if (existsSync(readmePath)) {
    patterns.push('README');
  }

  // CLAUDE.md
  if (existsSync(join(projectPath, 'CLAUDE.md'))) {
    patterns.push('CLAUDE.md');
  }

  const gitHead = getGitHead(projectPath);

  return {
    slug,
    name,
    stack,
    entrypoints,
    dependencies,
    recentDecisions,
    patterns,
    gitHead: gitHead || 'unknown',
  };
}

export function generateDNATemplate(
  metadata: Partial<ProjectDNA>,
  topFiles: Array<{ path: string; pagerank: number }>,
): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`project: ${metadata.slug}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`git_head: ${metadata.gitHead}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Project DNA: ${metadata.name}`);
  lines.push('');

  // Stack
  if (metadata.stack && metadata.stack.length > 0) {
    lines.push('## Stack');
    lines.push(metadata.stack.join(', '));
    lines.push('');
  }

  // Entry points
  if (metadata.entrypoints && metadata.entrypoints.length > 0) {
    lines.push('## Entrypoints');
    for (const ep of metadata.entrypoints) {
      lines.push(`- ${ep}`);
    }
    lines.push('');
  }

  // Top files by PageRank
  if (topFiles.length > 0) {
    lines.push('## Top Files (by import centrality)');
    for (const file of topFiles.slice(0, 20)) {
      lines.push(`- ${file.path} (${file.pagerank})`);
    }
    lines.push('');
  }

  // Dependencies
  if (metadata.dependencies && Object.keys(metadata.dependencies).length > 0) {
    lines.push('## Critical Dependencies');
    for (const [dep, ver] of Object.entries(metadata.dependencies)) {
      lines.push(`- ${dep}: ${ver}`);
    }
    lines.push('');
  }

  // Recent decisions
  if (metadata.recentDecisions && metadata.recentDecisions.length > 0) {
    lines.push('## Recent Commits');
    for (const decision of metadata.recentDecisions.slice(0, 10)) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Patterns
  if (metadata.patterns && metadata.patterns.length > 0) {
    lines.push('## Detected Patterns');
    lines.push(metadata.patterns.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

export function saveDNA(slug: string, content: string): string {
  const dnaPath = getProjectDnaPath(slug);
  const dir = dirname(dnaPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(dnaPath, content, 'utf-8');
  return dnaPath;
}

export function isDNACached(slug: string, currentHead: string | null): boolean {
  const dnaPath = getProjectDnaPath(slug);
  if (!existsSync(dnaPath)) return false;
  if (!currentHead) return false;

  try {
    const content = readFileSync(dnaPath, 'utf-8');
    return content.includes(`git_head: ${currentHead}`);
  } catch {
    return false;
  }
}
