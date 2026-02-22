// Sinapse — Configuration Types

import type { DecayConfig } from './index.js';

export interface SinapseConfig {
  basePath: string;              // memory/sinapse/
  dbPath: string;                // memory/sinapse/meta.db
  decay: DecayConfig;
  health: HealthConfig;
  hooks: HooksConfig;
  ingest: IngestConfig;
}

export interface HealthConfig {
  staleDays: number;             // 7
  stalePenaltyPerMemory: number; // 2
  dupePenalty: number;           // 5
  agePenaltyFactor: number;     // 0.5
  lowScorePenalty: number;      // 1
  pinnedBonus: number;          // 2
  linksBonus: number;           // 0.5
}

export interface HooksConfig {
  sessionStart: {
    enabled: boolean;
    loadTopN: number;            // 20
    minEffectiveScore: number;   // 5.0
  };
  preCompact: {
    enabled: boolean;
  };
  sessionStop: {
    enabled: boolean;
    runDecay: boolean;
    runStats: boolean;
  };
}

export interface IngestConfig {
  languages: string[];           // ['typescript', 'javascript']
  excludePatterns: string[];     // node_modules, dist, etc.
  pagerankDamping: number;       // 0.85
  pagerankMaxIter: number;       // 50
  pagerankConvergence: number;   // 1e-6
  dnaMaxTokens: number;          // 1500
  topFilesCount: number;         // 20
}

export const DEFAULT_CONFIG: SinapseConfig = {
  basePath: 'memory/sinapse',
  dbPath: 'memory/sinapse/meta.db',
  decay: {
    defaultRate: 0.995,
    accessBoost: 0.001,
    maxRate: 0.999,
    archiveThreshold: 3.0,
    gcThreshold: 1.0,
  },
  health: {
    staleDays: 7,
    stalePenaltyPerMemory: 2,
    dupePenalty: 5,
    agePenaltyFactor: 0.5,
    lowScorePenalty: 1,
    pinnedBonus: 2,
    linksBonus: 0.5,
  },
  hooks: {
    sessionStart: {
      enabled: true,
      loadTopN: 20,
      minEffectiveScore: 5.0,
    },
    preCompact: {
      enabled: true,
    },
    sessionStop: {
      enabled: true,
      runDecay: true,
      runStats: true,
    },
  },
  ingest: {
    languages: ['typescript', 'javascript'],
    excludePatterns: [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '.next',
      '.turbo',
    ],
    pagerankDamping: 0.85,
    pagerankMaxIter: 50,
    pagerankConvergence: 1e-6,
    dnaMaxTokens: 1500,
    topFilesCount: 20,
  },
};
