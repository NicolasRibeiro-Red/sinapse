#!/usr/bin/env node
// Sinapse CLI — Entry Point

import { Command } from 'commander';
import { indexCommand } from './commands/index-cmd.js';
import { decayCommand } from './commands/decay-cmd.js';
import { gcCommand } from './commands/gc-cmd.js';
import { healthCommand } from './commands/health-cmd.js';
import { statsCommand } from './commands/stats-cmd.js';
import { listCommand } from './commands/list-cmd.js';
import { graphCommand } from './commands/graph-cmd.js';
import { consolidateCommand } from './commands/consolidate-cmd.js';
import { exportCommand } from './commands/export-cmd.js';
import { ingestCommand } from './commands/ingest-cmd.js';
import { dashboardCommand } from './commands/dashboard-cmd.js';
import { graphVizCommand } from './commands/graph-viz-cmd.js';

const program = new Command();

program
  .name('sinapse')
  .description('Context management and intelligent memory system for AI agents')
  .version('0.1.0')
  .option('--verbose', 'Detailed output')
  .option('--json', 'JSON output');

program.addCommand(indexCommand);
program.addCommand(decayCommand);
program.addCommand(gcCommand);
program.addCommand(healthCommand);
program.addCommand(statsCommand);
program.addCommand(listCommand);
program.addCommand(graphCommand);
program.addCommand(consolidateCommand);
program.addCommand(exportCommand);
program.addCommand(ingestCommand);
program.addCommand(dashboardCommand);
program.addCommand(graphVizCommand);

program.parse();
