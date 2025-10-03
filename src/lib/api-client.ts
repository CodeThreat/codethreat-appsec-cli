import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import chalk from 'chalk';
import { getConfig } from '../config/config';
import { 
  ApiResponse, 
  AuthValidationResponse, 
  CLIInfo,
  RepositoryImportResponse,
  ScanRunResponse,
  ScanStatusResponse,
  ScanResultsResponse,
  OrganizationConfig,
  ScanType,
  ExportFormat,
  Provider,
  ScanTrigger
} from '../types/api';

export class CodeThreatApiClient {
  private client: AxiosInstance;
  private config = getConfig();

  constructor() {
    // Reload config to pick up environment variables set by Azure extension
    this.config = getConfig();
    
    // Use environment variable or config for server URL
    const serverUrl = process.env.CT_SERVER_URL || this.config.serverUrl;
    const timeout = parseInt(process.env.CT_API_TIMEOUT || '30000');
    const userAgent = `${process.env.CLI_NAME || 'CodeThreat-CLI'}/${process.env.CLI_VERSION || '1.0.0'}`;
    
    this.client = axios.create({
      baseURL: serverUrl,
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      const apiKey = this.config.apiKey || process.env.CT_API_KEY;
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        if (this.config.verbose) {
          console.log(chalk.gray(`← ${response.status} ${response.config.url}`));
        }
        return response;
      },
      (error: AxiosError) => {
        this.handleApiError(error);
        throw error;
      }
    );
  }

  /**
   * Validate authentication
   */
  async validateAuth(options: {
    includePermissions?: boolean;
    includeOrganizations?: boolean;
    includeUsage?: boolean;
  } = {}): Promise<AuthValidationResponse> {
    // Convert boolean values to strings for query parameters
    const params = Object.entries(options).reduce((acc, [key, value]) => {
      if (typeof value === 'boolean') {
        acc[key] = value.toString();
      } else if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);

    const response = await this.client.get<ApiResponse<AuthValidationResponse>>(
      '/api/v1/cli/auth/validate',
      { params }
    );
    
    return this.handleResponse(response);
  }

  /**
   * Get CLI information and capabilities
   */
  async getCLIInfo(): Promise<CLIInfo> {
    const response = await this.client.get<ApiResponse<CLIInfo>>('/api/v1/cli/info');
    return this.handleResponse(response);
  }

  /**
   * Import repository from Git URL
   */
  async importRepository(options: {
    url: string;
    organizationSlug?: string;
    name?: string;
    provider?: Provider;
    branch?: string;
    autoScan?: boolean;
    scanTypes?: ScanType[];
    isPrivate?: boolean;
    description?: string;
  }): Promise<RepositoryImportResponse> {
    // Create request body - ensure organizationSlug is ALWAYS included
    const organizationSlug = options.organizationSlug || this.config.organizationSlug || process.env.CT_ORG_SLUG || '';
    
    // Build clean request body without undefined values
    const requestBody: any = {
      url: options.url,
      organizationSlug: organizationSlug
    };
    
    // Only add optional fields if they have values
    if (options.name) requestBody.name = options.name;
    if (options.provider) requestBody.provider = options.provider;
    if (options.branch) requestBody.branch = options.branch;
    if (options.autoScan !== undefined) requestBody.autoScan = options.autoScan;
    if (options.scanTypes) requestBody.scanTypes = options.scanTypes;
    if (options.isPrivate !== undefined) requestBody.isPrivate = options.isPrivate;
    if (options.description) requestBody.description = options.description;
    
    // Validate organizationSlug is present
    if (!requestBody.organizationSlug) {
      throw new Error('Organization slug is required. Please set CT_ORG_SLUG environment variable or provide organizationSlug parameter.');
    }
    
    const response = await this.client.post<ApiResponse<RepositoryImportResponse>>(
      '/api/v1/repositories/import',
      requestBody
    );
    
    return this.handleResponse(response);
  }

  /**
   * Get repository status
   */
  async getRepositoryStatus(repositoryId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(
      `/api/v1/repositories/${repositoryId}/status`
    );
    
    return this.handleResponse(response);
  }

  /**
   * Run scan with client-side polling (serverless-friendly)
   * This method always starts an async scan and polls from the client side
   * to avoid serverless function timeouts (Netlify/Vercel limits)
   */
  async runScan(options: {
    repositoryId: string;
    organizationSlug?: string;
    branch?: string;
    scanTypes: ScanType[];
    wait?: boolean;
    timeout?: number;
    pollInterval?: number;
    scanTrigger?: ScanTrigger;
    pullRequestId?: string;
    commitSha?: string;
    metadata?: Record<string, string>;
  }): Promise<ScanRunResponse> {
    // Get organizationSlug from options, config, or environment
    const organizationSlug = options.organizationSlug || this.config.organizationSlug || process.env.CT_ORG_SLUG || '';
    
    // Build clean request body without undefined values
    const requestBody: any = {
      repositoryId: options.repositoryId,
      organizationSlug: organizationSlug,
      scanTypes: options.scanTypes,
      wait: false, // ALWAYS false - we do client-side polling to avoid serverless timeouts
      timeout: 1800, // Send to backend (required by validation) but not used for polling
      pollInterval: 10, // Send to backend (required by validation) but not used for polling
    };
    
    // Only add optional fields if they have values
    if (options.branch) requestBody.branch = options.branch;
    if (options.scanTrigger) requestBody.scanTrigger = options.scanTrigger;
    if (options.pullRequestId) requestBody.pullRequestId = options.pullRequestId;
    if (options.commitSha) requestBody.commitSha = options.commitSha;
    if (options.metadata) requestBody.metadata = options.metadata;
    
    // Validate organizationSlug is present
    if (!requestBody.organizationSlug) {
      throw new Error('Organization slug is required. Please set CT_ORG_SLUG environment variable or provide organizationSlug parameter.');
    }
    
    // Start async scan (returns immediately, no serverless timeout)
    const response = await this.client.post<ApiResponse<ScanRunResponse>>(
      '/api/v1/scans/run',
      requestBody,
      {
        timeout: 30000, // 30 seconds - only for starting scan, not waiting
      }
    );
    
    const scanResponse = this.handleResponse(response);
    
    // If wait=true, do client-side polling
    if (options.wait) {
      return await this.pollScanCompletion(
        scanResponse.scan.id,
        options.timeout || 43200, // Default 12 hours
        options.pollInterval || 30  // Default 30 seconds
      );
    }
    
    return scanResponse;
  }

  /**
   * Poll scan status until completion (client-side polling)
   * This avoids serverless function timeouts by polling from the client
   */
  private async pollScanCompletion(
    scanId: string,
    timeoutSeconds: number,
    pollIntervalSeconds: number
  ): Promise<ScanRunResponse> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;
    const pollIntervalMs = pollIntervalSeconds * 1000;
    
    if (this.config.verbose) {
      console.log(`⏳ Polling scan ${scanId} (timeout: ${timeoutSeconds}s, interval: ${pollIntervalSeconds}s)`);
    }
    
    while (Date.now() - startTime < timeoutMs) {
      // Get current scan status
      const statusResponse = await this.getScanStatus(scanId, false);
      
      if (statusResponse.scan.status === 'COMPLETED') {
        if (this.config.verbose) {
          console.log(`✅ Scan completed in ${Math.round((Date.now() - startTime) / 1000)}s`);
        }
        
        // Return full response with results
        return {
          scan: statusResponse.scan,
          synchronous: true,
          results: {
            total: statusResponse.results.violationCount,
            critical: statusResponse.results.summary.critical,
            high: statusResponse.results.summary.high,
            medium: statusResponse.results.summary.medium,
            low: statusResponse.results.summary.low,
          },
          duration: Math.round((Date.now() - startTime) / 1000),
        };
      }
      
      if (statusResponse.scan.status === 'FAILED') {
        throw new Error(`Scan failed during execution`);
      }
      
      if (this.config.verbose) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏳ Scan status: ${statusResponse.scan.status} (${elapsed}s elapsed)`);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    // Timeout reached
    throw new Error(`Scan timeout after ${timeoutSeconds} seconds. Scan ID: ${scanId}`);
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string, includeLogs = false): Promise<ScanStatusResponse> {
    // Include organizationSlug if available
    const params: any = { includeLogs };
    if (this.config.organizationSlug || process.env.CT_ORG_SLUG) {
      params.organizationSlug = this.config.organizationSlug || process.env.CT_ORG_SLUG;
    }
    
    const response = await this.client.get<ApiResponse<ScanStatusResponse>>(
      `/api/v1/scans/${scanId}/status`,
      { params }
    );
    
    return this.handleResponse(response);
  }

  /**
   * Export scan results
   */
  async exportScanResults(options: {
    scanId: string;
    format?: ExportFormat;
    severity?: string[];
    scanTypes?: ScanType[];
    includeFixed?: boolean;
    includeSuppressed?: boolean;
    includeMetadata?: boolean;
    ruleIds?: string[];
  }): Promise<ScanResultsResponse> {
    const { scanId, ...params } = options;
    
    // Include organizationSlug if available
    const requestParams: any = { ...params };
    if (this.config.organizationSlug || process.env.CT_ORG_SLUG) {
      requestParams.organizationSlug = this.config.organizationSlug || process.env.CT_ORG_SLUG;
    }
    
    const response = await this.client.get<ApiResponse<ScanResultsResponse>>(
      `/api/v1/scans/${scanId}/results`,
      { params: requestParams }
    );
    
    return this.handleResponse(response);
  }

  /**
   * Get organization configuration
   */
  async getOrganizationConfig(organizationId: string): Promise<OrganizationConfig> {
    const response = await this.client.get<ApiResponse<OrganizationConfig>>(
      `/api/v1/organizations/${organizationId}/config`
    );
    
    return this.handleResponse(response);
  }

  /**
   * List repositories
   */
  async listRepositories(options: {
    page?: number;
    limit?: number;
    search?: string;
    provider?: Provider;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(
      '/api/v1/repositories',
      { params: options }
    );
    
    return this.handleResponse(response);
  }

  /**
   * List scans
   */
  async listScans(options: {
    page?: number;
    limit?: number;
    repositoryId?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>(
      '/api/v1/scans',
      { params: options }
    );
    
    return this.handleResponse(response);
  }

  /**
   * Handle API response and extract data
   */
  private handleResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
    const { data } = response;
    
    if (!data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }
    
    if (!data.data) {
      throw new Error('No data in API response');
    }
    
    return data.data;
  }

  /**
   * Handle API errors with user-friendly messages
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      
      switch (status) {
        case 401:
          console.error(chalk.red('Authentication failed. Please check your API key.'));
          console.log(chalk.yellow('Run: codethreat auth login --api-key <your-key>'));
          break;
        case 403:
          console.error(chalk.red('Permission denied. You may not have access to this resource.'));
          break;
        case 404:
          console.error(chalk.red('Resource not found. Please check the ID and try again.'));
          break;
        case 429:
          console.error(chalk.red('Rate limit exceeded. Please wait and try again.'));
          break;
        case 500:
          console.error(chalk.red('Server error. Please try again later.'));
          break;
        default:
          console.error(chalk.red(`API Error (${status}): ${data?.error?.message || error.message}`));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red('Cannot connect to CodeThreat server. Please check your server URL.'));
      console.log(chalk.yellow(`Current server: ${this.config.serverUrl}`));
    } else if (error.code === 'ETIMEDOUT') {
      console.error(chalk.red('Request timeout. The operation took too long.'));
    } else {
      console.error(chalk.red('Network error:'), error.message);
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/health');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    // Update the axios instance headers
    this.client.defaults.headers['X-API-Key'] = apiKey;
  }

  /**
   * Update server URL
   */
  setServerUrl(serverUrl: string): void {
    this.config.serverUrl = serverUrl;
    this.client.defaults.baseURL = serverUrl;
  }
}

// Export singleton instance
export const apiClient = new CodeThreatApiClient();
