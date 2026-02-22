// Sinapse — Path Constants and Getters
// Platform-aware (Windows/Unix)

import { join } from 'node:path';
import { homedir } from 'node:os';

// Base path for sinapse memory — relative to Claude project memory
const CLAUDE_MEMORY_BASE = join(homedir(), '.claude', 'projects', 'C--Users-nicol', 'memory', 'sinapse');

export function getBasePath(): string {
  return CLAUDE_MEMORY_BASE;
}

export function getHotPath(): string {
  return join(getBasePath(), 'hot');
}

export function getAgentPath(agent: string): string {
  return join(getHotPath(), agent);
}

export function getGlobalPath(): string {
  return join(getHotPath(), 'global');
}

export function getProjectsPath(): string {
  return join(getBasePath(), 'projects');
}

export function getProjectPath(slug: string): string {
  return join(getProjectsPath(), slug);
}

export function getProjectDnaPath(slug: string): string {
  return join(getProjectPath(slug), 'dna.md');
}

export function getProjectMemoriesPath(slug: string): string {
  return join(getProjectPath(slug), 'memories');
}

export function getArchivedPath(): string {
  return join(getBasePath(), 'archived');
}

export function getGraphPath(): string {
  return join(getBasePath(), 'graph');
}

export function getGraphIndexPath(): string {
  return join(getGraphPath(), 'index.json');
}

export function getMetaDbPath(): string {
  return join(getBasePath(), 'meta.db');
}

// ─── External paths (existing ecosystem) ────────────────────

export function getClaudeMemoryBase(): string {
  return join(homedir(), '.claude', 'projects', 'C--Users-nicol', 'memory');
}

export function getSkillPath(): string {
  return join(homedir(), '.claude', 'skills', 'sinapse');
}

export function getRulesPath(): string {
  return join(homedir(), '.claude', 'rules');
}

export function getHooksPath(): string {
  return join(homedir(), '.claude', 'hooks');
}
