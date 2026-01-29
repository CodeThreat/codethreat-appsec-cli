import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { table } from 'table';
import { apiClient } from '../lib/api-client';
import { getConfig } from '../config/config';
import { ScanType, ExportFormat, ScanTrigger } from '../types/api';

export const scanCommand = new Command('scan')
  .description('Security scanning operations')
  .addCommand(
    new Command('run')
      .description('Run security scan on repository')
      .argument('<repository-id>', 'Repository ID to scan')
      .requiredOption('-org, --organization <slug>', 'Organization slug (required)')
      .option('-b, --branch <branch>', 'Branch to scan', 'main')
      .option('-t, --types <types>', 'Scan types (comma-separated)', 'sast,sca,secrets')
      .option('-w, --wait', 'Wait for scan completion', false)
      .option('--timeout <seconds>', 'Timeout in seconds', '3600')
      .option('--poll-interval <seconds>', 'Polling interval in seconds', '10')
      .option('--trigger <trigger>', 'Scan trigger type', 'api')
      .option('--pr <pr-id>', 'Pull request ID (if scanning PR)')
      .option('--commit <sha>', 'Commit SHA')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .option('-o, --output <file>', 'Output file (optional)')
      .option('--max-critical <number>', 'Fail if critical >= threshold (-1 = disabled)', '-1')
      .option('--max-high <number>', 'Fail if high >= threshold (-1 = disabled)', '-1')
      .option('--max-medium <number>', 'Fail if medium >= threshold (-1 = disabled)', '-1')
      .option('--max-low <number>', 'Fail if low >= threshold (-1 = disabled)', '-1')
      .action(async (repositoryId, options) => {
        try {
          const config = getConfig();
          
          // Parse scan types
          const scanTypes = options.types.split(',').map((t: string) => t.trim()) as ScanType[];

          // Validate scan types
          const validScanTypes = ['sast', 'sca', 'secrets', 'iac', 'scan'];
          const invalidTypes = scanTypes.filter(t => !validScanTypes.includes(t));
          if (invalidTypes.length > 0) {
            console.error(chalk.red(`Invalid scan types: ${invalidTypes.join(', ')}`));
            console.log(chalk.yellow(`Valid types: ${validScanTypes.join(', ')}`));
            process.exit(1);
          }

          const spinner = ora('Starting security scan...').start();

          const result = await apiClient.runScan({
            repositoryId,
            organizationSlug: options.organization,
            branch: options.branch,
            scanTypes: [], // Empty array for shift-ql compatibility
            wait: options.wait,
            timeout: parseInt(options.timeout),
            pollInterval: parseInt(options.pollInterval),
            scanTrigger: options.trigger as ScanTrigger,
            pullRequestId: options.pr,
            commitSha: options.commit,
          });

          if (result.synchronous) {
            spinner.succeed(`Scan completed in ${result.duration}s`);
          } else {
            spinner.succeed('Scan started');
          }

          // Output results
          if (options.format === 'json') {
            const output = JSON.stringify(result, null, 2);
            if (options.output) {
              await fs.writeFile(options.output, output);
              console.log(chalk.green(`Results saved to: ${options.output}`));
            } else {
              console.log(output);
            }
          } else {
            // Display in formatted output
            console.log();
            console.log(chalk.bold('Scan Information:'));
            console.log(`  Scan ID: ${result.scan.id}`);
            console.log(`  Repository: ${result.scan.repositoryId}`);
            console.log(`  Branch: ${result.scan.branch}`);
            console.log(`  Status: ${formatScanStatus(result.scan.status)}`);
            console.log(`  Types: ${result.scan.types.join(', ')}`);
            console.log(`  Started: ${new Date(result.scan.startedAt).toLocaleString()}`);

            if (result.synchronous && result.results) {
              console.log();
              console.log(chalk.bold('Scan Results:'));
              console.log(`  Total Violations: ${result.results.total}`);
              console.log(`  Critical: ${chalk.red(result.results.critical)}`);
              console.log(`  High: ${chalk.yellow(result.results.high)}`);
              console.log(`  Medium: ${chalk.blue(result.results.medium)}`);
              console.log(`  Low: ${chalk.gray(result.results.low)}`);

              if (result.scan.securityScore) {
                console.log(`  Security Score: ${result.scan.securityScore}/100`);
              }

              // Check for CI/CD failure conditions with numeric thresholds
              const maxCritical = parseInt(options.maxCritical || '-1', 10);
              const maxHigh = parseInt(options.maxHigh || '-1', 10);
              const maxMedium = parseInt(options.maxMedium || '-1', 10);
              const maxLow = parseInt(options.maxLow || '-1', 10);

              // Critical threshold check
              if (maxCritical >= 0 && result.results.critical >= maxCritical) {
                console.log();
                console.error(chalk.red(`❌ Build failed: ${result.results.critical} critical vulnerabilities found (threshold: ${maxCritical})`));
                process.exit(1);
              }

              // High threshold check
              if (maxHigh >= 0 && result.results.high >= maxHigh) {
                console.log();
                console.error(chalk.red(`❌ Build failed: ${result.results.high} high severity vulnerabilities found (threshold: ${maxHigh})`));
                process.exit(1);
              }

              // Medium threshold check
              if (maxMedium >= 0 && result.results.medium >= maxMedium) {
                console.log();
                console.error(chalk.red(`❌ Build failed: ${result.results.medium} medium severity vulnerabilities found (threshold: ${maxMedium})`));
                process.exit(1);
              }

              // Low threshold check
              if (maxLow >= 0 && result.results.low >= maxLow) {
                console.log();
                console.error(chalk.red(`❌ Build failed: ${result.results.low} low severity vulnerabilities found (threshold: ${maxLow})`));
                process.exit(1);
              }

              // Total violations check (backward compatibility with config)
              if (config.maxViolations && result.results.total > config.maxViolations) {
                console.log();
                console.error(chalk.red(`❌ Build should fail: Too many violations (${result.results.total} > ${config.maxViolations})`));
                process.exit(1);
              }

              // Log success if thresholds are set
              if (maxCritical >= 0 || maxHigh >= 0 || maxMedium >= 0 || maxLow >= 0) {
                console.log();
                console.log(chalk.green('✅ All threshold checks passed'));
              }
            } else {
              console.log();
              console.log(chalk.yellow('💡 Use "codethreat scan status ' + result.scan.id + '" to check progress'));
            }
          }
        } catch (error) {
          ora().fail('Scan failed');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Get scan status')
      .argument('<scan-id>', 'Scan ID')
      .option('--logs', 'Include detailed logs')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (scanId, options) => {
        try {
          const spinner = ora('Fetching scan status...').start();

          const status = await apiClient.getScanStatus(scanId, options.logs);

          spinner.succeed('Scan status retrieved');

          if (options.format === 'json') {
            console.log(JSON.stringify(status, null, 2));
            return;
          }

          // Display formatted status
          console.log();
          console.log(chalk.bold('Scan Information:'));
          console.log(`  ID: ${status.scan.id}`);
          console.log(`  Repository: ${status.scan.repository.name}`);
          console.log(`  Branch: ${status.scan.branch}`);
          console.log(`  Status: ${formatScanStatus(status.scan.status)}`);
          console.log(`  Types: ${status.scan.types.join(', ')}`);
          console.log(`  Started: ${new Date(status.scan.startedAt).toLocaleString()}`);
          
          if (status.scan.completedAt) {
            console.log(`  Completed: ${new Date(status.scan.completedAt).toLocaleString()}`);
            console.log(`  Duration: ${status.scan.scanDuration}s`);
          }

          console.log();
          console.log(chalk.bold('Progress:'));
          console.log(`  Percentage: ${status.progress.percentage}%`);
          console.log(`  Phase: ${status.progress.currentPhase}`);
          if (status.progress.estimatedCompletion) {
            console.log(`  ETA: ${status.progress.estimatedCompletion}`);
          }

          if (status.results.violationCount > 0) {
            console.log();
            console.log(chalk.bold('Results:'));
            console.log(`  Total Violations: ${status.results.violationCount}`);
            console.log(`  Critical: ${chalk.red(status.results.summary.critical)}`);
            console.log(`  High: ${chalk.yellow(status.results.summary.high)}`);
            console.log(`  Medium: ${chalk.blue(status.results.summary.medium)}`);
            console.log(`  Low: ${chalk.gray(status.results.summary.low)}`);

            if (Object.keys(status.results.byType).length > 0) {
              console.log();
              console.log(chalk.bold('By Type:'));
              Object.entries(status.results.byType).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
              });
            }
          }

          if (options.logs && status.logs) {
            console.log();
            console.log(chalk.bold('Execution Logs:'));
            status.logs.forEach(log => {
              const statusIcon = log.status === 'COMPLETED' ? '✅' : 
                               log.status === 'FAILED' ? '❌' : 
                               log.status === 'RUNNING' ? '🔄' : '⏳';
              console.log(`  ${statusIcon} ${log.step} (${log.status})`);
              if (log.error) {
                console.log(chalk.red(`    Error: ${log.error}`));
              }
            });
          }

          // Show next actions based on status
          if (status.scan.status === 'COMPLETED') {
            console.log();
            console.log(chalk.green('✅ Scan completed successfully'));
            console.log(chalk.yellow('💡 Use "codethreat scan results ' + scanId + '" to export results'));
          } else if (status.scan.status === 'FAILED') {
            console.log();
            console.log(chalk.red('❌ Scan failed'));
          } else {
            console.log();
            console.log(chalk.blue('🔄 Scan in progress...'));
            console.log(chalk.gray('Use this command again to check progress'));
          }
        } catch (error) {
          ora().fail('Failed to get scan status');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('results')
      .description('Export scan results')
      .argument('<scan-id>', 'Scan ID')
      .option('-f, --format <format>', 'Export format (json|sarif|csv|xml|junit)', 'json')
      .option('-o, --output <file>', 'Output file')
      .option('--severity <levels>', 'Filter by severity (comma-separated)', 'critical,high,medium,low')
      .option('--types <types>', 'Filter by scan types (comma-separated)')
      .option('--include-fixed', 'Include fixed violations', false)
      .option('--include-suppressed', 'Include suppressed violations', false)
      .option('--no-metadata', 'Exclude metadata from results')
      .action(async (scanId, options) => {
        try {
          const spinner = ora('Exporting scan results...').start();

          const severityLevels = options.severity.split(',').map((s: string) => s.trim());
          const scanTypes = options.types ? options.types.split(',').map((t: string) => t.trim()) as ScanType[] : undefined;

          const result = await apiClient.exportScanResults({
            scanId,
            format: options.format as ExportFormat,
            severity: severityLevels,
            scanTypes,
            includeFixed: options.includeFixed,
            includeSuppressed: options.includeSuppressed,
            includeMetadata: !options.noMetadata,
          });

          spinner.succeed('Results exported successfully');

          // Determine output file
          let outputFile = options.output;
          if (!outputFile) {
            const extension = options.format === 'sarif' ? 'sarif' : 
                            options.format === 'junit' ? 'xml' :
                            options.format;
            outputFile = `codethreat-results.${extension}`;
          }

          // Save results to file
          const outputContent = typeof result.results === 'string' ? 
                              result.results : 
                              JSON.stringify(result.results, null, 2);

          await fs.writeFile(outputFile, outputContent);

          console.log();
          console.log(chalk.green('✅ Results exported:'));
          console.log(`  File: ${outputFile}`);
          console.log(`  Format: ${result.format}`);
          console.log(`  Violations: ${result.summary.total}`);
          console.log(`  Critical: ${chalk.red(result.summary.critical)}`);
          console.log(`  High: ${chalk.yellow(result.summary.high)}`);
          console.log(`  Medium: ${chalk.blue(result.summary.medium)}`);
          console.log(`  Low: ${chalk.gray(result.summary.low)}`);

          // CI/CD integration hints
          if (options.format === 'sarif') {
            console.log();
            console.log(chalk.blue('💡 GitHub Actions integration:'));
            console.log(chalk.gray('   - uses: github/codeql-action/upload-sarif@v3'));
            console.log(chalk.gray('     with:'));
            console.log(chalk.gray(`       sarif_file: ${outputFile}`));
          } else if (options.format === 'junit') {
            console.log();
            console.log(chalk.blue('💡 GitLab CI/CD integration:'));
            console.log(chalk.gray('   artifacts:'));
            console.log(chalk.gray('     reports:'));
            console.log(chalk.gray(`       junit: ${outputFile}`));
          }
        } catch (error) {
          ora().fail('Export failed');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List scans')
      .option('-r, --repository <id>', 'Filter by repository ID')
      .option('-s, --status <status>', 'Filter by status')
      .option('--page <page>', 'Page number', '1')
      .option('--limit <limit>', 'Results per page', '20')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (options) => {
        try {
          const spinner = ora('Fetching scans...').start();

          const result = await apiClient.listScans({
            repositoryId: options.repository,
            status: options.status,
            page: parseInt(options.page),
            limit: parseInt(options.limit),
          });

          spinner.succeed(`Found ${result.scans.length} scans`);

          if (options.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          if (result.scans.length === 0) {
            console.log(chalk.yellow('No scans found'));
            console.log(chalk.gray('Use "codethreat scan run <repository-id>" to start a scan'));
            return;
          }

          const tableData = [
            ['ID', 'Repository', 'Branch', 'Status', 'Types', 'Started', 'Score'],
            ...result.scans.map((scan: any) => [
              scan.id.substring(0, 8) + '...',
              scan.repository?.name || scan.repositoryId.substring(0, 8) + '...',
              scan.branch,
              formatScanStatus(scan.status),
              scan.types.join(','),
              new Date(scan.startedAt).toLocaleDateString(),
              scan.securityScore ? `${scan.securityScore}/100` : 'N/A'
            ])
          ];

          console.log();
          console.log(table(tableData, {
            header: {
              alignment: 'center',
              content: chalk.bold('Scans')
            }
          }));

          if (result.pagination?.hasMore) {
            console.log();
            console.log(chalk.gray(`Showing ${result.scans.length} of ${result.pagination.total} scans`));
            console.log(chalk.gray(`Use --page ${parseInt(options.page) + 1} to see more`));
          }
        } catch (error) {
          ora().fail('Failed to fetch scans');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  );

// Helper function to format scan status with colors
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
