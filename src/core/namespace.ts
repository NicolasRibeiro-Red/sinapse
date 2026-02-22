// Sinapse — Namespace Manager
// Directory structure, project detection, agent namespaces

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import {
  getBasePath, getHotPath, getGlobalPath, getArchivedPath,
  getGraphPath, getProjectsPath, getAgentPath, getProjectPath,
  getProjectMemoriesPath
} from './paths.js';

// ─── Directory Structure ────────────────────────────────────

const REQUIRED_DIRS = [
  getBasePath,
  getHotPath,
  getGlobalPath,
  getArchivedPath,
  getGraphPath,
  getProjectsPath,
];

const DEFAULT_AGENTS = ['jarvis', 'dev', 'qa', 'architect'];

export function ensureDirectoryStructure(): void {
  for (const getDir of REQUIRED_DIRS) {
    const dir = getDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create default agent namespaces
  for (const agent of DEFAULT_AGENTS) {
    const agentDir = getAgentPath(agent);
    if (!existsSync(agentDir)) {
      mkdirSync(agentDir, { recursive: true });
    }
  }
}

export function ensureAgentNamespace(agent: string): string {
  const dir = getAgentPath(agent);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function ensureProjectNamespace(slug: string): string {
  const dir = getProjectPath(slug);
  const memDir = getProjectMemoriesPath(slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true });
  return dir;
}

// ─── Agent Listing ──────────────────────────────────────────

export function listAgentNamespaces(): string[] {
  const hotPath = getHotPath();
  if (!existsSync(hotPath)) return [];

  return readdirSync(hotPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'global')
    .map(d => d.name);
}

export function listProjectNamespaces(): string[] {
  const projectsPath = getProjectsPath();
  if (!existsSync(projectsPath)) return [];

  return readdirSync(projectsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

// ─── Project Detection ──────────────────────────────────────

export function detectProject(cwd?: string): { name: string; slug: string; remote: string | null } | null {
  const dir = cwd || process.cwd();

  try {
    // Try git remote
    const remote = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const name = extractRepoName(remote);
    return { name, slug: slugify(name), remote };
  } catch {
    // Try package.json
    try {
      const pkgPath = require('node:path').join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'));
        const name = pkg.name || require('node:path').basename(dir);
        return { name, slug: slugify(name), remote: null };
      }
    } catch {
      // Fall through
    }

    return null;
  }
}

function extractRepoName(remote: string): string {
  // https://github.com/user/repo.git → repo
  // git@github.com:user/repo.git → repo
  const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? remote;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Git HEAD ───────────────────────────────────────────────

export function getGitHead(cwd?: string): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}
