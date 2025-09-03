import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import dotenv from 'dotenv';
import { ScanType, ExportFormat } from '../types/api';

export interface CLIConfig {
  // Server configuration
  serverUrl: string;
  apiKey?: string;
  organizationId?: string;
  
  // Default scan settings
  defaultScanTypes: ScanType[];
  defaultBranch: string;
  defaultTimeout: number;
  defaultPollInterval: number;
  
  // Output settings
  defaultFormat: ExportFormat;
  outputDir: string;
  
  // CI/CD settings
  failOnHigh: boolean;
  failOnCritical: boolean;
  maxViolations?: number;
  
  // CLI behavior
  verbose: boolean;
  colors: boolean;
}

// Load environment variables from .env file
function loadEnvFile(): void {
  const envPaths = [
    './.env',                                    // Project-specific
    path.join(os.homedir(), '.codethreat', '.env'), // User-specific
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  }
}

// Load saved credentials from secure file
function loadSavedCredentials(): { apiKey?: string; serverUrl?: string } {
  try {
    const credentialsPath = path.join(os.homedir(), '.codethreat', '.credentials');
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      return {
        apiKey: credentials.apiKey,
        serverUrl: credentials.serverUrl,
      };
    }
  } catch (error) {
    // Ignore errors - credentials file might be corrupted or missing
  }
  return {};
}

// Get configuration from environment variables with fallbacks
function getEnvConfig(): CLIConfig {
  // Load .env file first
  loadEnvFile();
  
  // Load saved credentials
  const savedCredentials = loadSavedCredentials();

  return {
    serverUrl: process.env.CT_SERVER_URL || savedCredentials.serverUrl || process.env.CT_PRODUCTION_URL || 'https://api.codethreat.com',
    apiKey: process.env.CT_API_KEY || savedCredentials.apiKey,
    organizationId: process.env.CT_ORG_ID,
    defaultScanTypes: (process.env.CT_DEFAULT_SCAN_TYPES || 'sast,sca,secrets').split(',') as ScanType[],
    defaultBranch: process.env.CT_DEFAULT_BRANCH || 'main',
    defaultTimeout: parseInt(process.env.CT_TIMEOUT || '1800'),
    defaultPollInterval: parseInt(process.env.CT_POLL_INTERVAL || '10'),
    defaultFormat: (process.env.CT_DEFAULT_FORMAT || 'json') as ExportFormat,
    outputDir: process.env.CT_OUTPUT_DIR || './codethreat-results',
    failOnHigh: process.env.CT_FAIL_ON_HIGH === 'true',
    failOnCritical: process.env.CT_FAIL_ON_CRITICAL !== 'false', // Default true
    maxViolations: process.env.CT_MAX_VIOLATIONS ? parseInt(process.env.CT_MAX_VIOLATIONS) : undefined,
    verbose: process.env.CT_VERBOSE === 'true',
    colors: process.env.CT_COLORS !== 'false', // Default true
  };
}

const DEFAULT_CONFIG: CLIConfig = getEnvConfig();

let currentConfig: CLIConfig = { ...DEFAULT_CONFIG };

/**
 * Configuration file locations (in order of precedence)
 */
const CONFIG_LOCATIONS = [
  './.codethreat.yml',           // Project-specific
  './.codethreat.yaml',          // Project-specific (alternative)
  path.join(os.homedir(), '.codethreat', 'config.yml'), // User-specific
  path.join(os.homedir(), '.codethreat.yml'),           // User-specific (legacy)
];

/**
 * Load configuration from files and environment variables
 */
export function loadConfig(): CLIConfig {
  // Start with defaults
  currentConfig = { ...DEFAULT_CONFIG };
  
  // Load from config files (in order of precedence)
  for (const configPath of CONFIG_LOCATIONS) {
    if (fs.existsSync(configPath)) {
      try {
        const configFile = fs.readFileSync(configPath, 'utf8');
        const fileConfig = yaml.parse(configFile);
        
        // Merge with current config
        currentConfig = {
          ...currentConfig,
          ...fileConfig,
        };
        
        console.log(`Loaded configuration from: ${configPath}`);
        break;
      } catch (error) {
        console.warn(`Warning: Failed to load config from ${configPath}:`, error);
      }
    }
  }
  
  // Override with environment variables
  if (process.env.CT_API_KEY) currentConfig.apiKey = process.env.CT_API_KEY;
  if (process.env.CT_SERVER_URL) currentConfig.serverUrl = process.env.CT_SERVER_URL;
  if (process.env.CT_ORG_ID) currentConfig.organizationId = process.env.CT_ORG_ID;
  if (process.env.CT_VERBOSE === 'true') currentConfig.verbose = true;
  
  // Validate required configuration
  validateConfig(currentConfig);
  
  return currentConfig;
}

/**
 * Get current configuration
 */
export function getConfig(): CLIConfig {
  return currentConfig;
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<CLIConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...updates,
  };
}

/**
 * Save configuration to user config file
 */
export function saveConfig(config: Partial<CLIConfig>): void {
  const configDir = path.join(os.homedir(), '.codethreat');
  const configPath = path.join(configDir, 'config.yml');
  
  // Ensure config directory exists
  fs.ensureDirSync(configDir);
  
  // Merge with current config
  const newConfig = {
    ...currentConfig,
    ...config,
  };
  
  // Remove sensitive data from saved config
  const configToSave = { ...newConfig };
  delete configToSave.apiKey; // Don't save API key to file
  
  // Save to YAML file
  const yamlContent = yaml.stringify(configToSave, {
    indent: 2,
    lineWidth: 120,
  });
  
  fs.writeFileSync(configPath, yamlContent, 'utf8');
  console.log(`Configuration saved to: ${configPath}`);
  
  // Update current config
  currentConfig = newConfig;
}

/**
 * Validate configuration
 */
function validateConfig(config: CLIConfig): void {
  if (!config.serverUrl) {
    throw new Error('Server URL is required');
  }
  
  if (!config.serverUrl.startsWith('http')) {
    throw new Error('Server URL must start with http:// or https://');
  }
  
  if (config.defaultTimeout < 60 || config.defaultTimeout > 3600) {
    throw new Error('Default timeout must be between 60 and 3600 seconds');
  }
  
  if (config.defaultPollInterval < 5 || config.defaultPollInterval > 60) {
    throw new Error('Default poll interval must be between 5 and 60 seconds');
  }
}

/**
 * Get configuration file template
 */
export function getConfigTemplate(): string {
  return `# CodeThreat CLI Configuration
# This file can be placed in your project root or home directory

# Server configuration
server_url: "https://api.codethreat.com"
organization_id: "your-org-id"  # Optional: Set default organization

# Default scan settings
default_scan_types: ["sast", "sca", "secrets"]
default_branch: "main"
default_timeout: 1800  # 30 minutes
default_poll_interval: 10  # 10 seconds

# Output settings
default_format: "json"
output_dir: "./codethreat-results"

# CI/CD behavior
fail_on_high: false
fail_on_critical: true
max_violations: 50  # Optional: Fail if more than N violations

# CLI behavior
verbose: false
colors: true

# Note: API key should be set via environment variable CT_API_KEY
# for security reasons, not in this config file
`;
}
