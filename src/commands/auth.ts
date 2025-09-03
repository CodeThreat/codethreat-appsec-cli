import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { apiClient } from '../lib/api-client';
import { getConfig, saveConfig } from '../config/config';

export const authCommand = new Command('auth')
  .description('Authentication management')
  .addCommand(
    new Command('login')
      .description('Login with API key')
      .option('-k, --api-key <key>', 'CodeThreat API key')
      .option('-s, --server-url <url>', 'CodeThreat server URL')
      .option('--save', 'Save credentials to config file', true)
      .action(async (options) => {
        try {
          let { apiKey, serverUrl } = options;
          const config = getConfig();

          // Prompt for API key if not provided
          if (!apiKey) {
            const answers = await inquirer.prompt([
              {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your CodeThreat API key:',
                mask: '*',
                validate: (input) => input.length > 0 || 'API key is required',
              }
            ]);
            apiKey = answers.apiKey;
          }

          // Prompt for server URL if not provided
          if (!serverUrl) {
            const answers = await inquirer.prompt([
              {
                type: 'input',
                name: 'serverUrl',
                message: 'Enter CodeThreat server URL:',
                default: config.serverUrl,
                validate: (input) => {
                  if (!input.startsWith('http')) {
                    return 'Server URL must start with http:// or https://';
                  }
                  return true;
                },
              }
            ]);
            serverUrl = answers.serverUrl;
          }

          // Update client configuration
          if (serverUrl) apiClient.setServerUrl(serverUrl);
          apiClient.setApiKey(apiKey);

          console.log(chalk.blue('🔐 Validating authentication...'));

          // Validate the API key
          const authResult = await apiClient.validateAuth({
            includeOrganizations: true,
            includePermissions: true,
          });

          if (!authResult.valid) {
            throw new Error('Invalid API key');
          }

          console.log(chalk.green('✅ Authentication successful!'));
          console.log();
          console.log(chalk.bold('User Information:'));
          console.log(`  Name: ${authResult.user.name || 'Not set'}`);
          console.log(`  Email: ${authResult.user.email}`);
          console.log();

          if (authResult.organizations && authResult.organizations.length > 0) {
            console.log(chalk.bold('Organizations:'));
            authResult.organizations.forEach((org, index) => {
              const marker = org.isPersonal ? '👤' : '🏢';
              console.log(`  ${marker} ${org.name} (${org.planType})`);
              if (index === 0) {
                console.log(chalk.gray('    ^ Default organization'));
              }
            });
            console.log();
          }

          // Save configuration if requested
          if (options.save) {
            // Save API key to a secure location for CLI usage
            const configDir = path.join(os.homedir(), '.codethreat');
            const credentialsPath = path.join(configDir, '.credentials');
            
            fs.ensureDirSync(configDir);
            
            // Save credentials securely (only readable by user)
            const credentials = {
              apiKey,
              serverUrl: serverUrl || config.serverUrl,
              savedAt: new Date().toISOString(),
            };
            
            fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { 
              mode: 0o600 // Only readable by user
            });
            
            saveConfig({
              serverUrl: serverUrl || config.serverUrl,
              organizationId: authResult.organizations?.[0]?.id,
            });
            
            console.log(chalk.green('💾 Credentials saved securely'));
            console.log(chalk.yellow('💡 Authentication will persist across CLI sessions'));
          }

          console.log(chalk.green('🚀 Ready to use CodeThreat CLI!'));
          console.log(chalk.gray('Try: codethreat repo list'));
        } catch (error) {
          console.error(chalk.red('❌ Login failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('validate')
      .description('Validate current authentication')
      .option('--verbose', 'Show detailed information')
      .action(async (options) => {
        try {
          console.log(chalk.blue('🔐 Validating authentication...'));

          const authResult = await apiClient.validateAuth({
            includeOrganizations: true,
            includePermissions: options.verbose,
            includeUsage: options.verbose,
          });

          console.log(chalk.green('✅ Authentication valid'));
          console.log();
          
          console.log(chalk.bold('User:'));
          console.log(`  ${authResult.user.name || 'Not set'} (${authResult.user.email})`);
          console.log();

          if (authResult.organizations && authResult.organizations.length > 0) {
            console.log(chalk.bold('Organizations:'));
            authResult.organizations.forEach((org) => {
              const marker = org.isPersonal ? '👤' : '🏢';
              console.log(`  ${marker} ${org.name} (${org.planType})`);
              if (org.usageBalance !== undefined) {
                console.log(chalk.gray(`    Balance: $${org.usageBalance.toFixed(2)}`));
              }
            });
            console.log();
          }

          if (options.verbose && authResult.permissions) {
            console.log(chalk.bold('Permissions:'));
            authResult.permissions.forEach(permission => {
              console.log(`  • ${permission}`);
            });
            console.log();
          }

          console.log(chalk.gray(`Authenticated at: ${authResult.authenticatedAt}`));
        } catch (error) {
          console.error(chalk.red('❌ Authentication invalid:'), error instanceof Error ? error.message : 'Unknown error');
          console.log(chalk.yellow('Run: codethreat auth login'));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('logout')
      .description('Clear stored credentials')
      .action(async () => {
        try {
          // Clear API key from environment
          delete process.env.CT_API_KEY;
          delete process.env.CT_SERVER_URL;
          
          // Remove credentials file
          const credentialsPath = path.join(os.homedir(), '.codethreat', '.credentials');
          if (fs.existsSync(credentialsPath)) {
            fs.removeSync(credentialsPath);
          }
          
          // Clear config
          saveConfig({
            apiKey: undefined,
            organizationId: undefined,
          });

          console.log(chalk.green('✅ Logged out successfully'));
          console.log(chalk.gray('Credentials cleared from all locations'));
          console.log(chalk.yellow('💡 You will need to login again to use the CLI'));
        } catch (error) {
          console.error(chalk.red('❌ Logout failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Show current authentication status')
      .action(async () => {
        try {
          const config = getConfig();
          
          console.log(chalk.bold('Authentication Status:'));
          console.log(`  Server URL: ${config.serverUrl}`);
          console.log(`  API Key: ${config.apiKey ? chalk.green('Set') : chalk.red('Not set')}`);
          console.log(`  Organization: ${config.organizationId || chalk.gray('Not set')}`);
          console.log();

          if (config.apiKey) {
            console.log(chalk.blue('Testing connection...'));
            const isConnected = await apiClient.testConnection();
            console.log(`  Connection: ${isConnected ? chalk.green('OK') : chalk.red('Failed')}`);
          }
        } catch (error) {
          console.error(chalk.red('❌ Status check failed:'), error instanceof Error ? error.message : 'Unknown error');
        }
      })
  );
