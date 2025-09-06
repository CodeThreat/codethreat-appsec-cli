/**
 * API Types for CodeThreat CLI
 * These types match the API responses from the CodeThreat platform
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planType: string;
  isPersonal: boolean;
  usageBalance?: number;
}

export interface AuthValidationResponse {
  valid: boolean;
  user: User;
  organizations?: Organization[];
  permissions?: string[];
  usage?: {
    currentBalance: number;
    planType: string;
  };
  authenticatedAt: string;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  provider: string;
}

export interface RepositoryImportResponse {
  repository: Repository;
  alreadyExists: boolean;
  scan: {
    id: string;
    status: string;
    types: string[];
    branch: string;
  } | null;
}

export interface Scan {
  id: string;
  repositoryId: string;
  branch: string;
  status: 'PENDING' | 'SCANNING' | 'COMPLETED' | 'FAILED';
  types: string[];
  startedAt: string;
  completedAt?: string;
  scanDuration?: number;
  securityScore?: number;
}

export interface ScanRunResponse {
  scan: Scan;
  synchronous: boolean;
  results?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  duration?: number;
}

export interface ScanStatusResponse {
  scan: Scan & {
    repository: {
      id: string;
      name: string;
      fullName: string;
    };
  };
  progress: {
    percentage: number;
    currentPhase: string;
    estimatedCompletion: string | null;
  };
  results: {
    violationCount: number;
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  };
  logs?: Array<{
    step: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
}

export interface ScanResultsResponse {
  scan: Scan & {
    repository: Repository;
  };
  format: string;
  results: any; // Format-specific results (SARIF, JUnit, etc.)
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  exportedAt: string;
}

export interface Violation {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: string;
  lineNumber?: number;
  codeSnippet?: string;
  ruleId?: string;
  cwe?: string;
  cve?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationConfig {
  organization: {
    id: string;
    name: string;
    slug: string;
    planType: string;
    usageBalance: number;
  };
  capabilities: {
    scanTypes: {
      sast: boolean;
      sca: boolean;
      secrets: boolean;
      iac: boolean;
    };
    features: {
      repositoryImport: boolean;
      synchronousScanning: boolean;
      multiFormatExport: boolean;
      batchOperations: boolean;
      privateRepositories: boolean;
      aiAnalysis: boolean;
      prReviews: boolean;
    };
  };
  limits: {
    traditionalScans: {
      limit: number;
      currentCount: number;
      canPerform: boolean;
      resetDate: string;
    };
    prReviews: {
      limit: number;
      currentCount: number;
      canPerform: boolean;
      resetDate: string;
    };
  };
  usage: {
    currentBalance: number;
    usedThisMonth: number;
    billingPeriod: string;
  };
  supportedFormats: string[];
  supportedProviders: string[];
}

export interface CLIInfo {
  cli: {
    name: string;
    version: string;
    supportedPlatforms: string[];
    supportedArchitectures: string[];
  };
  api: {
    version: string;
    baseUrl: string;
    endpoints: {
      repositories: string;
      scans: string;
      organizations: string;
    };
  };
  supportedFormats: string[];
  supportedProviders: string[];
  capabilities?: OrganizationConfig['capabilities'];
}

// Export format types
export type ExportFormat = 'json' | 'sarif' | 'csv' | 'xml' | 'junit';
export type ScanType = 'sast' | 'sca' | 'secrets' | 'iac' | 'scan';
export type Provider = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';
export type ScanTrigger = 'manual' | 'ci/cd' | 'api';
