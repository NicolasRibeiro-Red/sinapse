// Sinapse — Graph Index
// Builds adjacency list from memory links, save/load graph/index.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getGraphIndexPath } from './paths.js';
import { scanAllMemoryFiles, readMemory } from './memory-store.js';
import type { GraphIndex, SinapseMemory } from '../types/index.js';

export function buildGraphIndex(memories?: SinapseMemory[]): GraphIndex {
  const mems = memories ?? loadAllMemories();

  const nodes: Record<string, string[]> = {};
  let edgeCount = 0;

  for (const mem of mems) {
    if (!nodes[mem.id]) {
      nodes[mem.id] = [];
    }

    for (const link of mem.links) {
      if (!nodes[mem.id]!.includes(link)) {
        nodes[mem.id]!.push(link);
        edgeCount++;
      }

      // Ensure linked node exists in graph
      if (!nodes[link]) {
        nodes[link] = [];
      }
    }

    // Handle supersedes as a link
    if (mem.supersedes) {
      if (!nodes[mem.id]!.includes(mem.supersedes)) {
        nodes[mem.id]!.push(mem.supersedes);
        edgeCount++;
      }
      if (!nodes[mem.supersedes]) {
        nodes[mem.supersedes] = [];
      }
    }
  }

  return {
    nodes,
    nodeCount: Object.keys(nodes).length,
    edgeCount,
    updatedAt: new Date().toISOString(),
  };
}

export function saveGraphIndex(index: GraphIndex): void {
  const path = getGraphIndexPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(index, null, 2), 'utf-8');
}

export function loadGraphIndex(): GraphIndex | null {
  const path = getGraphIndexPath();
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as GraphIndex;
  } catch {
    return null;
  }
}

export function getConnections(index: GraphIndex, memoryId: string, depth = 1): string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = [{ id: memoryId, d: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.d < depth) {
      const links = index.nodes[current.id] ?? [];
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ id: link, d: current.d + 1 });
        }
      }

      // Also find reverse connections
      for (const [nodeId, nodeLinks] of Object.entries(index.nodes)) {
        if (nodeLinks.includes(current.id) && !visited.has(nodeId)) {
          queue.push({ id: nodeId, d: current.d + 1 });
        }
      }
    }
  }

  visited.delete(memoryId);
  return Array.from(visited);
}

function loadAllMemories(): SinapseMemory[] {
  const files = scanAllMemoryFiles();
  const memories: SinapseMemory[] = [];
  for (const file of files) {
    const mem = readMemory(file);
    if (mem) memories.push(mem);
  }
  return memories;
}
