import { describe, it, expect } from 'vitest';
import { getCompressionCategories, getCategoryByName, generateCompressionPrompt } from '../../src/intelligence/compression.js';

describe('Compression', () => {
  it('has 4 categories', () => {
    const categories = getCompressionCategories();
    expect(categories).toHaveLength(4);
  });

  it('categories have correct importance levels', () => {
    const decisions = getCategoryByName('decisions');
    expect(decisions!.defaultImportance).toBe(9);

    const bugs = getCategoryByName('bugs');
    expect(bugs!.defaultImportance).toBe(8);

    const nextSteps = getCategoryByName('next_steps');
    expect(nextSteps!.defaultImportance).toBe(7);
  });

  it('generates prompts with category info', () => {
    const decisions = getCategoryByName('decisions')!;
    const prompt = generateCompressionPrompt(decisions);
    expect(prompt).toContain('DECISIONS');
    expect(prompt).toContain('importance: 9');
  });

  it('returns undefined for unknown category', () => {
    expect(getCategoryByName('nonexistent')).toBeUndefined();
  });
});
