// Sinapse — Compression Engine (pre-compact)
// Generates prompts for Claude to extract critical info before compaction

import type { CompressionCategory } from '../types/index.js';

export const COMPRESSION_CATEGORIES: CompressionCategory[] = [
  {
    name: 'decisions',
    defaultImportance: 9,
    promptTemplate: `Extract all DECISIONS made in this session:
- Architecture choices and rationale
- Technology selections
- Trade-offs accepted
- Scope decisions
Format each as a separate memory with clear title and context.`,
  },
  {
    name: 'work_state',
    defaultImportance: 8,
    promptTemplate: `Extract the current WORK STATE:
- What was being worked on
- Current progress (what's done, what's pending)
- Files modified and why
- Any partial implementations that need to continue
Format as a single comprehensive memory.`,
  },
  {
    name: 'bugs',
    defaultImportance: 8,
    promptTemplate: `Extract all BUGS and issues discovered:
- Bug descriptions with reproduction steps
- Root causes identified
- Fixes applied or pending
- Workarounds in use
Format each bug as a separate memory.`,
  },
  {
    name: 'next_steps',
    defaultImportance: 7,
    promptTemplate: `Extract NEXT STEPS for the upcoming session:
- What needs to be done next
- Blockers or dependencies
- Order of operations
- Open questions that need answers
Format as a prioritized list.`,
  },
];

export function generateCompressionPrompt(category: CompressionCategory): string {
  return `## Sinapse Pre-Compact Compression — ${category.name.toUpperCase()}

${category.promptTemplate}

### Memory Format
Save each extracted item as a Sinapse memory file with this frontmatter:
\`\`\`yaml
---
id: mem-{timestamp}-{seq}
importance: ${category.defaultImportance}
agent: (current agent)
project: (current project or null)
tags: [compression, ${category.name}]
type: ${category.name === 'decisions' ? 'decision' : category.name === 'bugs' ? 'bug' : 'context'}
status: active
---
\`\`\`

### Rules
- Only extract SIGNIFICANT information, not noise
- Be concise but complete — this will survive compaction
- Include enough context to be useful without the original conversation
- Do NOT extract: verbose tool outputs, failed attempts, debugging logs`;
}

export function getCompressionCategories(): CompressionCategory[] {
  return COMPRESSION_CATEGORIES;
}

export function getCategoryByName(name: string): CompressionCategory | undefined {
  return COMPRESSION_CATEGORIES.find(c => c.name === name);
}
