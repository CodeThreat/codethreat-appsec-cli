import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';
import { getConfig, saveConfig, getConfigTemplate } from '../config/config';
import fs from 'fs-extra';

export const configCommand = new Command('config')
  .description('Configuration management')
  .addCommand(
    new Command('show')
      .description('Show current configuration')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (options) => {
        try {
          const config = getConfig();

          if (options.format === 'json') {
            // Hide sensitive data in JSON output
            const safeConfig = { ...config };
            if (safeConfig.apiKey) {
              safeConfig.apiKey = '***hidden***';
            }
            console.log(JSON.stringify(safeConfig, null, 2));
            return;
          }

          // Display in table format
          const configData = [
            ['Setting', 'Value'],
            ['Server URL', config.serverUrl],
            ['API Key', config.apiKey ? chalk.green('Set') : chalk.red('Not set')],
            ['Organization ID', config.organizationId || chalk.gray('Not set')],
            ['Default Scan Types', config.defaultScanTypes.join(', ')],
            ['Default Branch', config.defaultBranch],
            ['Default Timeout', `${config.defaultTimeout}s`],
            ['Default Poll Interval', `${config.defaultPollInterval}s`],
            ['Default Format', config.defaultFormat],
            ['Output Directory', config.outputDir],
            ['Fail on Critical', config.failOnCritical ? 'Yes' : 'No'],
            ['Fail on High', config.failOnHigh ? 'Yes' : 'No'],
            ['Max Violations', config.maxViolations?.toString() || 'No limit'],
            ['Verbose', config.verbose ? 'Yes' : 'No'],
            ['Colors', config.colors ? 'Yes' : 'No'],
          ];

          console.log();
          console.log(table(configData, {
            header: {
              alignment: 'center',
              content: chalk.bold('CodeThreat CLI Configuration')
            }
          }));
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key')
      .argument('<value>', 'Configuration value')
      .action(async (key, value) => {
        try {
          const config = getConfig();
          const updates: any = {};

          // Parse and validate the configuration key
          switch (key) {
            case 'server-url':
            case 'serverUrl':
              if (!value.startsWith('http')) {
                throw new Error('Server URL must start with http:// or https://');
              }
              updates.serverUrl = value;
              break;

            case 'api-key':
            case 'apiKey':
              updates.apiKey = value;
              break;

            case 'org-id':
            case 'organizationId':
              updates.organizationId = value;
              break;

            case 'default-scan-types':
            case 'defaultScanTypes':
              const scanTypes = value.split(',').map((t: string) => t.trim());
              const validTypes = ['sast', 'sca', 'secrets', 'iac'];
              const invalid = scanTypes.filter(t => !validTypes.includes(t));
              if (invalid.length > 0) {
                throw new Error(`Invalid scan types: ${invalid.join(', ')}`);
              }
              updates.defaultScanTypes = scanTypes;
              break;

            case 'default-format':
            case 'defaultFormat':
              const validFormats = ['json', 'sarif', 'csv', 'xml', 'junit'];
              if (!validFormats.includes(value)) {
                throw new Error(`Invalid format. Valid formats: ${validFormats.join(', ')}`);
              }
              updates.defaultFormat = value;
              break;

            case 'fail-on-critical':
            case 'failOnCritical':
              updates.failOnCritical = value.toLowerCase() === 'true';
              break;

            case 'fail-on-high':
            case 'failOnHigh':
              updates.failOnHigh = value.toLowerCase() === 'true';
              break;

            case 'verbose':
              updates.verbose = value.toLowerCase() === 'true';
              break;

            default:
              throw new Error(`Unknown configuration key: ${key}`);
          }

          saveConfig(updates);
          console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('init')
      .description('Initialize configuration file')
      .option('-f, --force', 'Overwrite existing config file')
      .action(async (options) => {
        try {
          const configPath = './.codethreat.yml';

          if (fs.existsSync(configPath) && !options.force) {
            const answers = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'overwrite',
                message: 'Configuration file already exists. Overwrite?',
                default: false,
              }
            ]);

            if (!answers.overwrite) {
              console.log(chalk.yellow('Configuration initialization cancelled'));
              return;
            }
          }

          const template = getConfigTemplate();
          await fs.writeFile(configPath, template);

          console.log(chalk.green('✅ Configuration file created: .codethreat.yml'));
          console.log(chalk.blue('📝 Please edit the file to set your preferences'));
          console.log(chalk.gray('Remember to set CT_API_KEY environment variable for your API key'));
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  );
