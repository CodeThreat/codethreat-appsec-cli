import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { apiClient } from '../lib/api-client';
import { getConfig, updateConfig } from '../config/config';

export const orgCommand = new Command('org')
  .description('Organization management')
  .addCommand(
    new Command('list')
      .description('List available organizations')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (options) => {
        try {
          const spinner = ora('Fetching organizations...').start();

          const authResult = await apiClient.validateAuth({
            includeOrganizations: true,
            includeUsage: true,
          });

          spinner.succeed('Organizations retrieved');

          if (options.format === 'json') {
            console.log(JSON.stringify(authResult.organizations, null, 2));
            return;
          }

          if (!authResult.organizations || authResult.organizations.length === 0) {
            console.log(chalk.yellow('No organizations found'));
            return;
          }

          const tableData = [
            ['ID', 'Name', 'Type', 'Plan', 'Balance'],
            ...authResult.organizations.map(org => [
              org.id.substring(0, 8) + '...',
              org.name,
              org.isPersonal ? '👤 Personal' : '🏢 Team',
              org.planType,
              org.usageBalance !== undefined ? `$${org.usageBalance.toFixed(2)}` : 'N/A'
            ])
          ];

          console.log();
          console.log(table(tableData, {
            header: {
              alignment: 'center',
              content: chalk.bold('Organizations')
            }
          }));
        } catch (error) {
          ora().fail('Failed to fetch organizations');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('select')
      .description('Select default organization')
      .argument('<organization-id>', 'Organization ID')
      .action(async (organizationId) => {
        try {
          const spinner = ora('Validating organization access...').start();

          // Validate that user has access to this organization
          const authResult = await apiClient.validateAuth({
            includeOrganizations: true,
          });

          const hasAccess = authResult.organizations?.some(org => org.id === organizationId);
          if (!hasAccess) {
            spinner.fail('Access denied to organization');
            console.error(chalk.red('You do not have access to this organization'));
            process.exit(1);
          }

          const selectedOrg = authResult.organizations?.find(org => org.id === organizationId);
          
          spinner.succeed('Organization validated');

          // Update configuration
          updateConfig({ organizationId });

          console.log(chalk.green('✅ Default organization updated'));
          console.log(`  Organization: ${selectedOrg?.name}`);
          console.log(`  ID: ${organizationId}`);
          console.log(`  Plan: ${selectedOrg?.planType}`);
        } catch (error) {
          ora().fail('Failed to select organization');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('config')
      .description('Get organization configuration and capabilities')
      .argument('<organization-id>', 'Organization ID')
      .option('-f, --format <format>', 'Output format (json|table)', 'table')
      .action(async (organizationId, options) => {
        try {
          const spinner = ora('Fetching organization configuration...').start();

          const config = await apiClient.getOrganizationConfig(organizationId);

          spinner.succeed('Configuration retrieved');

          if (options.format === 'json') {
            console.log(JSON.stringify(config, null, 2));
            return;
          }

          // Display formatted configuration
          console.log();
          console.log(chalk.bold('Organization Information:'));
          console.log(`  Name: ${config.organization.name}`);
          console.log(`  ID: ${config.organization.id}`);
          console.log(`  Plan: ${config.organization.planType}`);
          console.log(`  Balance: $${config.organization.usageBalance.toFixed(2)}`);

          console.log();
          console.log(chalk.bold('Scan Capabilities:'));
          Object.entries(config.capabilities.scanTypes).forEach(([type, enabled]) => {
            console.log(`  ${type.toUpperCase()}: ${enabled ? chalk.green('✅') : chalk.red('❌')}`);
          });

          console.log();
          console.log(chalk.bold('Features:'));
          Object.entries(config.capabilities.features).forEach(([feature, enabled]) => {
            console.log(`  ${feature}: ${enabled ? chalk.green('✅') : chalk.red('❌')}`);
          });

          console.log();
          console.log(chalk.bold('Limits:'));
          console.log(`  Traditional Scans: ${config.limits.traditionalScans.currentCount}/${config.limits.traditionalScans.limit === -1 ? 'Unlimited' : config.limits.traditionalScans.limit}`);
          console.log(`  PR Reviews: ${config.limits.prReviews.currentCount}/${config.limits.prReviews.limit === -1 ? 'Unlimited' : config.limits.prReviews.limit}`);
          
          if (config.limits.traditionalScans.limit !== -1) {
            console.log(`  Scan Limit Resets: ${new Date(config.limits.traditionalScans.resetDate).toLocaleDateString()}`);
          }

          console.log();
          console.log(chalk.bold('Usage This Month:'));
          console.log(`  Used: $${config.usage.usedThisMonth.toFixed(2)}`);
          console.log(`  Period: ${config.usage.billingPeriod}`);

          console.log();
          console.log(chalk.bold('Supported:'));
          console.log(`  Formats: ${config.supportedFormats.join(', ')}`);
          console.log(`  Providers: ${config.supportedProviders.join(', ')}`);
        } catch (error) {
          ora().fail('Failed to get organization configuration');
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      })
  );
