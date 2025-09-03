#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { authCommand } from './commands/auth';
import { repoCommand } from './commands/repo';
import { scanCommand } from './commands/scan';
import { configCommand } from './commands/config';
import { orgCommand } from './commands/org';
import { loadConfig } from './config/config';

const program = new Command();

// Load configuration
loadConfig();

program
  .name('codethreat')
  .description(process.env.CLI_DESCRIPTION || 'CodeThreat CLI - Security scanning for CI/CD pipelines')
  .version(process.env.CLI_VERSION || '1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--api-key <key>', 'CodeThreat API key')
  .option('--server-url <url>', 'CodeThreat server URL', process.env.CT_SERVER_URL || 'https://app.codethreat.com')
  .option('--org-id <id>', 'Organization ID')
  .option('--config <path>', 'Configuration file path')
  .hook('preAction', (thisCommand) => {
    // Set global options
    const opts = thisCommand.optsWithGlobals();
    process.env.CT_VERBOSE = opts.verbose ? 'true' : 'false';
    if (opts.apiKey) process.env.CT_API_KEY = opts.apiKey;
    if (opts.serverUrl) process.env.CT_SERVER_URL = opts.serverUrl;
    if (opts.orgId) process.env.CT_ORG_ID = opts.orgId;
  });

// Add command groups
program.addCommand(authCommand);
program.addCommand(repoCommand);
program.addCommand(scanCommand);
program.addCommand(configCommand);
program.addCommand(orgCommand);

// Global error handler
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message);
  if (process.env.CT_VERBOSE === 'true') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});

// Parse arguments and execute
program.parse();
