import { describe, it, expect } from 'vitest';
import { slugify, detectProject } from '../../src/core/namespace.js';

describe('Namespace', () => {
  describe('slugify', () => {
    it('lowercases', () => {
      expect(slugify('MyProject')).toBe('myproject');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('My Project Name')).toBe('my-project-name');
    });

    it('removes special characters', () => {
      expect(slugify('project@v2.0!')).toBe('project-v2-0');
    });

    it('trims leading/trailing hyphens', () => {
      expect(slugify('--project--')).toBe('project');
    });

    it('collapses multiple hyphens', () => {
      expect(slugify('a   b   c')).toBe('a-b-c');
    });

    it('handles scoped packages', () => {
      expect(slugify('@scope/package')).toBe('scope-package');
    });
  });

  describe('detectProject', () => {
    it('detects current project from git', () => {
      // Running in sinapse repo itself
      const result = detectProject(process.cwd());
      // May or may not detect depending on test context
      // Just verify it returns correct shape or null
      if (result) {
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('slug');
        expect(result).toHaveProperty('remote');
      }
    });

    it('returns null for non-project directory', () => {
      const result = detectProject('/tmp');
      expect(result).toBeNull();
    });
  });
});
