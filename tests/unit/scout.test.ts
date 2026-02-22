import { describe, it, expect } from 'vitest';
import { isScoutRequired, generateScoutPrompt, SCOUT_THRESHOLD } from '../../src/intelligence/scout.js';

describe('Scout Pattern', () => {
  it('requires scout when files > threshold', () => {
    expect(isScoutRequired(SCOUT_THRESHOLD + 1, false)).toBe(true);
    expect(isScoutRequired(SCOUT_THRESHOLD, false)).toBe(false);
  });

  it('requires scout for unknown areas', () => {
    expect(isScoutRequired(1, true)).toBe(true);
  });

  it('does not require scout for known small tasks', () => {
    expect(isScoutRequired(2, false)).toBe(false);
  });

  it('generates scout prompt with task and project', () => {
    const prompt = generateScoutPrompt('Add auth module', 'salesflow');
    expect(prompt).toContain('Add auth module');
    expect(prompt).toContain('salesflow');
    expect(prompt).toContain('pre-exploration');
  });
});
