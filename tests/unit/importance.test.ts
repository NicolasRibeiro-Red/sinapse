import { describe, it, expect } from 'vitest';
import { getImportanceLabel, IMPORTANCE_CRITERIA, IMPORTANCE_SCALE, PROMOTION_LEVELS } from '../../src/core/importance.js';

describe('Importance', () => {
  describe('getImportanceLabel', () => {
    it('labels correctly', () => {
      expect(getImportanceLabel(10)).toBe('critical');
      expect(getImportanceLabel(9)).toBe('critical');
      expect(getImportanceLabel(8)).toBe('high');
      expect(getImportanceLabel(7)).toBe('high');
      expect(getImportanceLabel(5)).toBe('medium');
      expect(getImportanceLabel(3)).toBe('low');
      expect(getImportanceLabel(1)).toBe('trivial');
      expect(getImportanceLabel(0)).toBe('trivial');
    });
  });

  describe('constants', () => {
    it('criteria have correct structure', () => {
      expect(IMPORTANCE_CRITERIA.ARCHITECTURE_IMPACT.points).toBe(3);
      expect(IMPORTANCE_CRITERIA.CRITICAL_BUG.points).toBe(2);
      expect(IMPORTANCE_CRITERIA.IRREVERSIBLE_DECISION.points).toBe(3);
    });

    it('scale is correct', () => {
      expect(IMPORTANCE_SCALE.MIN).toBe(0);
      expect(IMPORTANCE_SCALE.MAX).toBe(10);
    });

    it('promotion levels follow PRD spec', () => {
      expect(PROMOTION_LEVELS.INSIGHT.occurrences).toBe(1);
      expect(PROMOTION_LEVELS.PATTERN.occurrences).toBe(2);
      expect(PROMOTION_LEVELS.PATTERN.importanceBoost).toBe(2);
      expect(PROMOTION_LEVELS.RULE.occurrences).toBe(3);
      expect(PROMOTION_LEVELS.RULE.importanceBoost).toBe(3);
      expect(PROMOTION_LEVELS.RULE.pinned).toBe(true);
    });
  });
});
