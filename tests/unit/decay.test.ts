import { describe, it, expect } from 'vitest';
import { calculateEffectiveScore, hoursSince } from '../../src/core/decay.js';

describe('Decay Engine', () => {
  describe('calculateEffectiveScore', () => {
    it('returns full importance at 0 hours', () => {
      const score = calculateEffectiveScore(10, 0.995, 0);
      expect(score).toBe(10);
    });

    it('decays over time', () => {
      const score0 = calculateEffectiveScore(10, 0.995, 0);
      const score24 = calculateEffectiveScore(10, 0.995, 24);
      const score168 = calculateEffectiveScore(10, 0.995, 168); // 7 days

      expect(score0).toBeGreaterThan(score24);
      expect(score24).toBeGreaterThan(score168);
    });

    it('higher decay rate decays slower', () => {
      const scoreFast = calculateEffectiveScore(10, 0.990, 100);
      const scoreSlow = calculateEffectiveScore(10, 0.999, 100);

      expect(scoreSlow).toBeGreaterThan(scoreFast);
    });

    it('pinned (no decay) keeps full score conceptually', () => {
      // With decay_rate = 1.0, no decay
      const score = calculateEffectiveScore(10, 1.0, 1000);
      expect(score).toBe(10);
    });

    it('importance 0 always scores 0', () => {
      const score = calculateEffectiveScore(0, 0.995, 0);
      expect(score).toBe(0);
    });

    it('7 days with default rate drops below 3.0 for importance 5', () => {
      // 168 hours * 0.995 decay
      const score = calculateEffectiveScore(5, 0.995, 168);
      expect(score).toBeLessThan(3.0);
    });

    it('7 days with high importance 10 stays above threshold', () => {
      const score = calculateEffectiveScore(10, 0.995, 168);
      // 10 * 0.995^168 = 10 * 0.428 = 4.28
      expect(score).toBeGreaterThan(3.0);
    });

    it('formula matches exact PRD specification', () => {
      // effective_score = importance × (decay_rate ^ hours)
      const importance = 8;
      const decayRate = 0.995;
      const hours = 48;
      const expected = importance * Math.pow(decayRate, hours);
      const actual = calculateEffectiveScore(importance, decayRate, hours);
      expect(actual).toBeCloseTo(expected, 10);
    });

    it('access boost makes decay slower', () => {
      // Simulating access_count increase → decay_rate goes up
      const baseRate = 0.995;
      const boostedRate = Math.min(0.999, baseRate + 0.001 * 3); // 3 accesses

      const scoreBase = calculateEffectiveScore(7, baseRate, 200);
      const scoreBoosted = calculateEffectiveScore(7, boostedRate, 200);

      expect(scoreBoosted).toBeGreaterThan(scoreBase);
    });
  });

  describe('hoursSince', () => {
    it('returns positive hours for past date', () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const hours = hoursSince(pastDate);
      expect(hours).toBeGreaterThanOrEqual(0.99);
      expect(hours).toBeLessThanOrEqual(1.01);
    });

    it('returns ~0 for now', () => {
      const now = new Date().toISOString();
      const hours = hoursSince(now);
      expect(hours).toBeLessThan(0.01);
    });

    it('returns ~24 for yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
      const hours = hoursSince(yesterday);
      expect(hours).toBeGreaterThanOrEqual(23.99);
      expect(hours).toBeLessThanOrEqual(24.01);
    });
  });
});
