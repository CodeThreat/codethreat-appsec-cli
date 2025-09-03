import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { table } from 'table';
import { apiClient } from '../lib/api-client';
import { getConfig } from '../config/config';
import { Provider, ScanType } from '../types/api';

export const repoCommand = new Command('repo')
  .description('Repository management')
  .addCommand(
    new Command('import')
      .description('Import a repository from Git URL')
      .argument('<url>', 'Git repository URL')
      .option('-n, --name <name>', 'Repository name (auto-detected from URL if not provided)')
      .option('-p, --provider <provider>', 'Git provider (github|gitlab|bitbucket|azure_devops)')
      .option('-b, --branch <branch>', 'Default branch', 'main')
      .option('--auto-scan', 'Trigger scan after import', true)
      .option('--no-auto-scan', 'Skip auto-scan after import')
      .option('-t, --types <types>', 'Scan types (comma-separated)', 'sast,sca,secrets')
      .option('--private', 'Mark repository as private')
      .option('-d, --description <desc>', 'Repository description')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (url, options) => {
        try {
          const config = getConfig();
          const spinner = ora('Importing repository...').start();

          // Parse scan types
          const scanTypes = options.types.split(',').map((t: string) => t.trim()) as ScanType[];

          // Validate scan types
          const validScanTypes = ['sast', 'sca', 'secrets', 'iac'];
          const invalidTypes = scanTypes.filter(t => !validScanTypes.includes(t));
          if (invalidTypes.length > 0) {
            spinner.fail(`Invalid scan types: ${invalidTypes.join(', ')}`);
            console.log(chalk.yellow(`Valid types: ${validScanTypes.join(', ')}`));
            process.exit(1);
          }

          const result = await apiClient.importRepository({
            url,
            name: options.name,
            provider: options.provider as Provider,
            branch: options.branch,
            autoScan: options.autoScan,
            scanTypes,
            isPrivate: options.private,
            description: options.description,
          });

          if (result.alreadyExists) {
            spinner.info('Repository already imported');
          } else {
            spinner.succeed('Repository imported successfully');
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
          } else {
            // Display in table format
            console.log();
            console.log(chalk.bold('Repository Details:'));
            console.log(`  ID: ${result.repository.id}`);
            console.log(`  Name: ${result.repository.name}`);
            console.log(`  Full Name: ${result.repository.fullName}`);
            console.log(`  URL: ${result.repository.url}`);
            console.log(`  Provider: ${result.repository.provider}`);
            console.log(`  Default Branch: ${result.repository.defaultBranch}`);
            console.log(`  Private: ${result.repository.isPrivate ? 'Yes' : 'No'}`);

            if (result.scan) {
              console.log();
              console.log(chalk.bold('Auto-Scan Triggered:'));
              console.log(`  Scan ID: ${result.scan.id}`);
              console.log(`  Status: ${result.scan.status}`);
              console.log(`  Types: ${result.scan.types.join(', ')}`);
              console.log(`  Branch: ${result.scan.branch}`);
              console.log();
              console.log(chalk.yellow('💡 Use "codethreat scan status ' + result.scan.id + '" to check progress'));
            }
          }
        } catch (error) {
          ora().fail('Import failed');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List imported repositories')
      .option('-p, --provider <provider>', 'Filter by provider')
      .option('-s, --search <term>', 'Search repositories by name')
      .option('--status <status>', 'Filter by status')
      .option('--page <page>', 'Page number', '1')
      .option('--limit <limit>', 'Results per page', '20')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (options) => {
        try {
          const spinner = ora('Fetching repositories...').start();

          const result = await apiClient.listRepositories({
            provider: options.provider as Provider,
            search: options.search,
            status: options.status,
            page: parseInt(options.page),
            limit: parseInt(options.limit),
          });

          spinner.succeed(`Found ${result.repositories.length} repositories`);

          if (options.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          // Display in table format
          if (result.repositories.length === 0) {
            console.log(chalk.yellow('No repositories found'));
            console.log(chalk.gray('Use "codethreat repo import <url>" to import a repository'));
            return;
          }

          const tableData = [
            ['ID', 'Name', 'Provider', 'Branch', 'Private', 'Last Scan'],
            ...result.repositories.map((repo: any) => [
              repo.id.substring(0, 8) + '...',
              repo.name,
              repo.connection?.provider?.name || 'Unknown',
              repo.defaultBranch,
              repo.isPrivate ? '🔒' : '🌐',
              repo.lastScanAt ? new Date(repo.lastScanAt).toLocaleDateString() : 'Never'
            ])
          ];

          console.log();
          console.log(table(tableData, {
            header: {
              alignment: 'center',
              content: chalk.bold('Repositories')
            }
          }));

          if (result.pagination?.hasMore) {
            console.log();
            console.log(chalk.gray(`Showing ${result.repositories.length} of ${result.pagination.total} repositories`));
            console.log(chalk.gray(`Use --page ${parseInt(options.page) + 1} to see more`));
          }
        } catch (error) {
          ora().fail('Failed to fetch repositories');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Get repository status')
      .argument('<repository-id>', 'Repository ID')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (repositoryId, options) => {
        try {
          const spinner = ora('Fetching repository status...').start();

          const status = await apiClient.getRepositoryStatus(repositoryId);

          spinner.succeed('Repository status retrieved');

          if (options.format === 'json') {
            console.log(JSON.stringify(status, null, 2));
            return;
          }

          // Display in formatted output
          console.log();
          console.log(chalk.bold('Repository Information:'));
          console.log(`  ID: ${status.repository.id}`);
          console.log(`  Name: ${status.repository.name}`);
          console.log(`  Full Name: ${status.repository.fullName}`);
          console.log(`  URL: ${status.repository.url}`);
          console.log(`  Provider: ${status.repository.provider}`);
          console.log(`  Default Branch: ${status.repository.defaultBranch}`);
          console.log(`  Private: ${status.repository.isPrivate ? 'Yes' : 'No'}`);
          console.log(`  Imported: ${new Date(status.repository.importedAt).toLocaleString()}`);

          console.log();
          console.log(chalk.bold('Scanning Information:'));
          console.log(`  Has Scans: ${status.scanning.hasScans ? 'Yes' : 'No'}`);
          
          if (status.scanning.latestScan) {
            const scan = status.scanning.latestScan;
            console.log(`  Latest Scan:`);
            console.log(`    ID: ${scan.id}`);
            console.log(`    Status: ${this.formatScanStatus(scan.status)}`);
            console.log(`    Branch: ${scan.branch}`);
            console.log(`    Started: ${new Date(scan.startedAt).toLocaleString()}`);
            if (scan.completedAt) {
              console.log(`    Completed: ${new Date(scan.completedAt).toLocaleString()}`);
            }
            console.log(`    Types: ${scan.types.join(', ')}`);
            console.log(`    Violations: ${scan.violationCount}`);
            if (scan.securityScore) {
              console.log(`    Security Score: ${scan.securityScore}/100`);
            }
          }

          if (status.scanning.pendingJobs.length > 0) {
            console.log();
            console.log(chalk.bold('Pending Jobs:'));
            status.scanning.pendingJobs.forEach((job: any) => {
              console.log(`  • ${job.type} (${job.status})`);
            });
          }

          console.log();
          console.log(chalk.bold('Capabilities:'));
          console.log(`  Can Scan: ${status.capabilities.canScan ? '✅' : '❌'}`);
          console.log(`  Supported Types: ${status.capabilities.supportedScanTypes.join(', ')}`);
        } catch (error) {
          ora().fail('Failed to get repository status');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  );

// Helper method to format scan status with colors
function formatScanStatus(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return chalk.green(status);
    case 'SCANNING':
      return chalk.blue(status);
    case 'PENDING':
      return chalk.yellow(status);
    case 'FAILED':
      return chalk.red(status);
    default:
      return chalk.gray(status);
  }
}
