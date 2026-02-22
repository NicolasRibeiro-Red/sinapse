// Sinapse — Memory Store
// High-level operations for memory management (file + SQLite)

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseMemoryFile, serializeMemory } from './frontmatter.js';
import { getHotPath, getArchivedPath, getAgentPath, getProjectMemoriesPath } from './paths.js';
import type { SinapseMemory, MemoryFilter, MemoryCreateInput } from '../types/index.js';
import { MemoryStatus } from '../types/index.js';
import { generateMemoryId } from './frontmatter.js';
import { DEFAULT_CONFIG } from '../types/config.js';

// ─── Read Operations ────────────────────────────────────────

export function readMemory(filePath: string): SinapseMemory | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, title, content: body } = parseMemoryFile(content);
    return {
      ...frontmatter,
      title,
      content: body,
      filePath,
    };
  } catch {
    return null;
  }
}

export function listMemories(filter?: MemoryFilter): SinapseMemory[] {
  const memories: SinapseMemory[] = [];
  const dirs: string[] = [];

  // Collect directories to scan
  if (filter?.agent) {
    dirs.push(getAgentPath(filter.agent));
  } else {
    const hotPath = getHotPath();
    if (existsSync(hotPath)) {
      const entries = readdirSync(hotPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push(join(hotPath, entry.name));
        }
      }
    }
  }

  // Also scan archived if no status filter or looking for archived
  if (!filter?.status || filter.status === MemoryStatus.Archived) {
    const archivedPath = getArchivedPath();
    if (existsSync(archivedPath)) {
      dirs.push(archivedPath);
    }
  }

  // Scan project memories
  if (filter?.project) {
    const projMemPath = getProjectMemoriesPath(filter.project);
    if (existsSync(projMemPath)) {
      dirs.push(projMemPath);
    }
  }

  // Read all .md files from collected dirs
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const mem = readMemory(join(dir, file));
      if (!mem) continue;

      // Apply filters
      if (filter?.type && mem.type !== filter.type) continue;
      if (filter?.status && mem.status !== filter.status) continue;
      if (filter?.minScore !== undefined && mem.effective_score < filter.minScore) continue;
      if (filter?.project && mem.project !== filter.project) continue;
      if (filter?.tags && filter.tags.length > 0) {
        if (!filter.tags.some(t => mem.tags.includes(t))) continue;
      }

      memories.push(mem);
    }
  }

  // Sort by effective_score DESC
  memories.sort((a, b) => b.effective_score - a.effective_score);

  // Apply limit
  if (filter?.limit) {
    return memories.slice(0, filter.limit);
  }

  return memories;
}

// ─── Write Operations ───────────────────────────────────────

export function saveMemory(input: MemoryCreateInput, agent?: string): SinapseMemory {
  const now = new Date().toISOString();
  const id = generateMemoryId();
  const effectiveAgent = agent || input.agent;

  const memory: SinapseMemory = {
    id,
    importance: input.importance,
    agent: effectiveAgent,
    project: input.project ?? null,
    tags: input.tags,
    type: input.type,
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    decay_rate: DEFAULT_CONFIG.decay.defaultRate,
    effective_score: input.importance,
    status: MemoryStatus.Active,
    links: input.links ?? [],
    supersedes: input.supersedes ?? null,
    title: input.title,
    content: input.content,
    filePath: '', // Set below
  };

  // Determine file path
  const dir = memory.project
    ? getProjectMemoriesPath(memory.project)
    : getAgentPath(memory.agent);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const fileName = `${id}.md`;
  const filePath = join(dir, fileName);
  memory.filePath = filePath;

  // Serialize and write
  const content = serializeMemory(memory);
  writeFileSync(filePath, content, 'utf-8');

  return memory;
}

export function updateMemoryFile(memory: SinapseMemory): void {
  const content = serializeMemory(memory);
  writeFileSync(memory.filePath, content, 'utf-8');
}

export function archiveMemory(memory: SinapseMemory): void {
  const archivedDir = getArchivedPath();
  if (!existsSync(archivedDir)) {
    mkdirSync(archivedDir, { recursive: true });
  }

  const newPath = join(archivedDir, basename(memory.filePath));
  memory.status = MemoryStatus.Archived;
  memory.updated = new Date().toISOString();

  // Write to archived location
  const content = serializeMemory(memory);
  writeFileSync(newPath, content, 'utf-8');

  // Remove from original location
  if (existsSync(memory.filePath) && memory.filePath !== newPath) {
    unlinkSync(memory.filePath);
  }

  memory.filePath = newPath;
}

export function deleteMemoryFile(memory: SinapseMemory): void {
  if (existsSync(memory.filePath)) {
    unlinkSync(memory.filePath);
  }
}

// ─── Access Tracking ────────────────────────────────────────

export function updateMemoryAccess(memory: SinapseMemory): void {
  memory.access_count += 1;
  memory.accessed = new Date().toISOString();
  memory.decay_rate = Math.min(
    DEFAULT_CONFIG.decay.maxRate,
    memory.decay_rate + DEFAULT_CONFIG.decay.accessBoost,
  );
  memory.updated = new Date().toISOString();
  updateMemoryFile(memory);
}

// ─── Scan All Memory Files ──────────────────────────────────

export function scanAllMemoryFiles(): string[] {
  const files: string[] = [];
  const dirs = [getHotPath(), getArchivedPath()];

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  for (const dir of dirs) {
    scanDir(dir);
  }

  return files;
}
