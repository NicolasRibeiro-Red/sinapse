// sinapse dashboard — Unified visual dashboard
// Story 5.1: health gauge, sparklines, top memories, DNA status, trend

import { Command } from 'commander';
import { calculateHealth, healthGauge, getHealthRange, healthRangeLabel } from '../../core/health.js';
import { listMemories } from '../../core/memory-store.js';
import { ensureDirectoryStructure, listProjectNamespaces } from '../../core/namespace.js';
import { initDb, getHealthHistory, closeDb } from '../../core/db.js';
import { getMetaDbPath, getProjectDnaPath } from '../../core/paths.js';
import { existsSync, readFileSync, statSync } from 'node:fs';

const SPARKLINE_CHARS = '▁▂▃▄▅▆▇█';

function sparkline(values: number[], max?: number): string {
  if (values.length === 0) return '';
  const m = max ?? Math.max(...values);
  if (m === 0) return SPARKLINE_CHARS[0]!.repeat(values.length);
  return values.map(v => {
    const idx = Math.min(Math.floor((v / m) * 7), 7);
    return SPARKLINE_CHARS[idx]!;
  }).join('');
}

function trendArrow(values: number[]): string {
  if (values.length < 2) return '─';
  const last = values[values.length - 1]!;
  const prev = values[values.length - 2]!;
  if (last > prev + 2) return '↑';
  if (last < prev - 2) return '↓';
  return '→';
}

export const dashboardCommand = new Command('dashboard')
  .description('Unified visual dashboard')
  .option('--agent <agent>', 'Filter by agent')
  .option('--project <project>', 'Filter by project')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();

    // 1. Health
    const report = calculateHealth(undefined, {
      agent: opts.agent,
      project: opts.project,
    });

    // 2. Get health history for sparkline
    let healthHistory: number[] = [];
    try {
      const db = initDb(getMetaDbPath());
      const history = getHealthHistory(db, 7);
      healthHistory = history.map((h: { score: number }) => h.score);
      closeDb();
    } catch {}

    // 3. Memories
    const memories = listMemories({
      agent: opts.agent,
      project: opts.project,
    });

    const top5 = [...memories]
      .sort((a, b) => b.effective_score - a.effective_score)
      .slice(0, 5);

    // 4. Stats
    const byType = new Map<string, number>();
    const byStatus = new Map<string, number>();
    let pinnedCount = 0;
    for (const m of memories) {
      byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
      byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
      if (m.status === 'pinned') pinnedCount++;
    }

    // 5. DNA status
    const projects = listProjectNamespaces();
    const dnaStatus: Array<{ slug: string; exists: boolean; tokens: number; age: string }> = [];
    for (const slug of projects) {
      const dnaPath = getProjectDnaPath(slug);
      if (existsSync(dnaPath)) {
        const content = readFileSync(dnaPath, 'utf-8');
        const tokens = Math.round(content.length / 4);
        const stat = statSync(dnaPath);
        const ageMs = Date.now() - stat.mtimeMs;
        const ageH = Math.floor(ageMs / 3600000);
        const age = ageH < 24 ? `${ageH}h` : `${Math.floor(ageH / 24)}d`;
        dnaStatus.push({ slug, exists: true, tokens, age });
      } else {
        dnaStatus.push({ slug, exists: false, tokens: 0, age: '-' });
      }
    }

    if (json) {
      console.log(JSON.stringify({
        health: report,
        healthHistory,
        totalMemories: memories.length,
        pinnedCount,
        byType: Object.fromEntries(byType),
        byStatus: Object.fromEntries(byStatus),
        top5: top5.map(m => ({ id: m.id, title: m.title, score: m.effective_score })),
        dna: dnaStatus,
      }));
      return;
    }

    // Visual output
    const W = 44;
    const line = '═'.repeat(W - 2);
    const divider = '─'.repeat(W - 4);

    console.log(`\n╔${line}╗`);
    console.log(`║${'  SINAPSE DASHBOARD'.padEnd(W - 2)}║`);
    console.log(`╠${line}╣`);

    // Health gauge
    const gauge = healthGauge(report.score);
    const label = healthRangeLabel(getHealthRange(report.score));
    const trend = trendArrow(healthHistory);
    const spark = healthHistory.length > 0 ? ` ${sparkline(healthHistory, 100)}` : '';
    console.log(`║  Health: ${gauge} ${trend}${spark}`.padEnd(W - 1) + '║');
    console.log(`║  ${String(report.score).padStart(3)}/100 — ${label}`.padEnd(W - 1) + '║');

    console.log(`║  ${divider}  ║`);

    // Counts
    const active = byStatus.get('Active') ?? 0;
    const archived = byStatus.get('Archived') ?? 0;
    const decayed = byStatus.get('Decayed') ?? 0;
    console.log(`║  Memories: ${memories.length}  Active: ${active}  Pinned: ${pinnedCount}`.padEnd(W - 1) + '║');
    console.log(`║  Archived: ${archived}  Decayed: ${decayed}`.padEnd(W - 1) + '║');

    // Type distribution (block elements)
    if (byType.size > 0) {
      console.log(`║  ${divider}  ║`);
      console.log(`║  Type Distribution:`.padEnd(W - 1) + '║');
      const maxTypeCount = Math.max(...byType.values());
      for (const [type, count] of byType) {
        const barLen = maxTypeCount > 0 ? Math.max(1, Math.round((count / maxTypeCount) * 15)) : 0;
        const bar = '█'.repeat(barLen) + '░'.repeat(15 - barLen);
        console.log(`║  ${type.padEnd(10).slice(0, 10)} ${bar} ${count}`.padEnd(W - 1) + '║');
      }
    }

    // Top 5 memories
    if (top5.length > 0) {
      console.log(`║  ${divider}  ║`);
      console.log(`║  Top Memories:`.padEnd(W - 1) + '║');
      for (const mem of top5) {
        const title = (mem.title || mem.id).slice(0, 26);
        const score = mem.effective_score.toFixed(1);
        console.log(`║  ${score.padStart(5)} ${title.padEnd(26)}`.padEnd(W - 1) + '║');
      }
    }

    // DNA status
    if (dnaStatus.length > 0) {
      console.log(`║  ${divider}  ║`);
      console.log(`║  Project DNA:`.padEnd(W - 1) + '║');
      for (const d of dnaStatus) {
        const status = d.exists ? `~${d.tokens}tok ${d.age}` : 'not generated';
        console.log(`║  ${d.slug.padEnd(18).slice(0, 18)} ${status}`.padEnd(W - 1) + '║');
      }
    }

    console.log(`╚${line}╝\n`);
  });
