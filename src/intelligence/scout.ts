// Sinapse — Pre-Exploration Scout Pattern
// Generates prompts for Claude to scout codebase before complex tasks

export const SCOUT_THRESHOLD = 3; // files affected

export function isScoutRequired(filesAffected: number, isUnknownArea: boolean): boolean {
  return filesAffected > SCOUT_THRESHOLD || isUnknownArea;
}

export function generateScoutPrompt(taskDescription: string, projectSlug: string): string {
  return `Before starting this task, perform a pre-exploration scout:

## Task
${taskDescription}

## Instructions
1. Use the Explore agent or Glob/Grep to understand the relevant codebase area
2. For each significant finding, save a Sinapse memory with frontmatter:
   - type: context
   - importance: 5-7 (based on relevance to task)
   - agent: (current agent)
   - project: ${projectSlug}
   - tags: [scout, pre-exploration]
3. Focus on:
   - File structure and dependencies
   - Existing patterns that should be followed
   - Potential gotchas or constraints
   - Related code that might be affected
4. After scouting, summarize findings before proceeding with the task

This scout phase ensures you start with curated context, not assumptions.`;
}

export function generateScoutSummaryPrompt(findings: string[]): string {
  return `Summarize the following scout findings into a concise context briefing:

${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Output a brief summary (3-5 bullets) of the most important findings for the upcoming task.`;
}
