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
      
      if (this.config.verbose) {
        console.log(chalk.gray(`→ ${config.method?.toUpperCase()} ${config.url}`));
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
    name?: string;
    provider?: Provider;
    branch?: string;
    autoScan?: boolean;
    scanTypes?: ScanType[];
    isPrivate?: boolean;
    description?: string;
  }): Promise<RepositoryImportResponse> {
    const response = await this.client.post<ApiResponse<RepositoryImportResponse>>(
      '/api/v1/repositories/import',
      options
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
   * Run scan (synchronous or asynchronous)
   */
  async runScan(options: {
    repositoryId: string;
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
    const response = await this.client.post<ApiResponse<ScanRunResponse>>(
      '/api/v1/scans/run',
      options,
      {
        timeout: options.wait ? (options.timeout || 1800) * 1000 + 30000 : 30000, // Add 30s buffer for API processing
      }
    );
    
    return this.handleResponse(response);
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string, includeLogs = false): Promise<ScanStatusResponse> {
    const response = await this.client.get<ApiResponse<ScanStatusResponse>>(
      `/api/v1/scans/${scanId}/status`,
      { params: { includeLogs } }
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
    const response = await this.client.get<ApiResponse<ScanResultsResponse>>(
      `/api/v1/scans/${scanId}/results`,
      { params }
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
    
    if (this.config.verbose) {
      console.log(chalk.gray('Response data:'), JSON.stringify(data, null, 2));
    }
    
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
    if (this.config.verbose) {
      console.error(chalk.red('API Error Details:'), error.response?.data || error.message);
    }

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
