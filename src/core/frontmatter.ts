// Sinapse — Frontmatter YAML Schema + Validation
// Uses gray-matter for parse/serialize, Zod for validation

import matter from 'gray-matter';
import { z } from 'zod';
import { MemoryStatus, MemoryType } from '../types/index.js';
import type { SinapseMemory } from '../types/index.js';
import { createHash } from 'node:crypto';

// ─── Zod Schema ─────────────────────────────────────────────

export const memoryFrontmatterSchema = z.object({
  id: z.string().regex(/^mem-\d+-\d+$/, 'ID must match format mem-{timestamp}-{seq}'),
  importance: z.number().int().min(0).max(10),
  agent: z.string().min(1),
  project: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  type: z.nativeEnum(MemoryType),
  created: z.coerce.string().refine(s => !isNaN(Date.parse(s)), 'Invalid date'),
  updated: z.coerce.string().refine(s => !isNaN(Date.parse(s)), 'Invalid date'),
  accessed: z.coerce.string().refine(s => !isNaN(Date.parse(s)), 'Invalid date'),
  access_count: z.number().int().min(0).default(0),
  decay_rate: z.number().min(0).max(1).default(0.995),
  effective_score: z.number().min(0).default(5),
  status: z.nativeEnum(MemoryStatus).default(MemoryStatus.Active),
  links: z.array(z.string()).default([]),
  supersedes: z.string().nullable().default(null),
});

export type MemoryFrontmatter = z.infer<typeof memoryFrontmatterSchema>;

// ─── ID Generation ──────────────────────────────────────────

let _seqCounter = 0;

export function generateMemoryId(): string {
  const timestamp = Date.now();
  const seq = _seqCounter++;
  return `mem-${timestamp}-${seq}`;
}

export function resetSeqCounter(): void {
  _seqCounter = 0;
}

// ─── Parse / Serialize ──────────────────────────────────────

export interface ParseResult {
  frontmatter: MemoryFrontmatter;
  title: string;
  content: string;
}

export function parseMemoryFile(fileContent: string): ParseResult {
  const parsed = matter(fileContent);
  const validation = memoryFrontmatterSchema.safeParse(parsed.data);

  if (!validation.success) {
    const errors = validation.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid frontmatter:\n${errors}`);
  }

  // Extract title from first heading
  const lines = parsed.content.trim().split('\n');
  let title = '';
  let contentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      contentStart = i + 1;
      break;
    }
  }

  const content = lines.slice(contentStart).join('\n').trim();

  return {
    frontmatter: validation.data,
    title,
    content,
  };
}

export function serializeMemory(memory: Omit<SinapseMemory, 'filePath'>): string {
  const frontmatterData: MemoryFrontmatter = {
    id: memory.id,
    importance: memory.importance,
    agent: memory.agent,
    project: memory.project,
    tags: memory.tags,
    type: memory.type,
    created: memory.created,
    updated: memory.updated,
    accessed: memory.accessed,
    access_count: memory.access_count,
    decay_rate: memory.decay_rate,
    effective_score: memory.effective_score,
    status: memory.status,
    links: memory.links,
    supersedes: memory.supersedes,
  };

  const body = `# ${memory.title}\n\n${memory.content}`;
  return matter.stringify(body, frontmatterData);
}

// ─── Content Hash ───────────────────────────────────────────

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ─── Helpers ────────────────────────────────────────────────

export function memoryToRow(memory: SinapseMemory) {
  return {
    id: memory.id,
    importance: memory.importance,
    agent: memory.agent,
    project: memory.project,
    tags: JSON.stringify(memory.tags),
    type: memory.type,
    created: memory.created,
    updated: memory.updated,
    accessed: memory.accessed,
    access_count: memory.access_count,
    decay_rate: memory.decay_rate,
    effective_score: memory.effective_score,
    status: memory.status,
    links: JSON.stringify(memory.links),
    supersedes: memory.supersedes,
    title: memory.title,
    content_hash: contentHash(memory.content),
    file_path: memory.filePath,
  };
}

export function rowToMemoryPartial(row: Record<string, unknown>) {
  return {
    id: row['id'] as string,
    importance: row['importance'] as number,
    agent: row['agent'] as string,
    project: (row['project'] as string) || null,
    tags: JSON.parse((row['tags'] as string) || '[]') as string[],
    type: row['type'] as MemoryType,
    created: row['created'] as string,
    updated: row['updated'] as string,
    accessed: row['accessed'] as string,
    access_count: row['access_count'] as number,
    decay_rate: row['decay_rate'] as number,
    effective_score: row['effective_score'] as number,
    status: row['status'] as MemoryStatus,
    links: JSON.parse((row['links'] as string) || '[]') as string[],
    supersedes: (row['supersedes'] as string) || null,
    title: row['title'] as string,
    filePath: row['file_path'] as string,
  };
}
