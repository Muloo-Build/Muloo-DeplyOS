/**
 * Configuration for browser session executor
 */
export interface BrowserSessionConfig {
  portalId: string;
  csrfToken: string; // Value of hubspotapi-csrf cookie
  baseUrl: string; // e.g. https://app-eu1.hubspot.com
}

/**
 * Result of a browser session execution
 */
export interface ExecutionResult {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  tier: 'browser_session';
}

/**
 * Property definition for create operations
 */
export interface PropertyDefinition {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  formField?: boolean;
  options?: Array<{
    label: string;
    value: string;
    displayOrder?: number;
    hidden?: boolean;
  }>;
}

/**
 * Report definition for create operations
 */
export interface ReportDefinition {
  name: string;
  description: string;
  reportType: string;
  filters: unknown[];
  dimensions: unknown[];
  metrics: unknown[];
  visualizationType: string;
  dateRange: unknown;
}

/**
 * Dashboard definition for create operations
 */
export interface DashboardDefinition {
  name: string;
  description?: string;
  sections?: Array<{
    name: string;
    displayOrder: number;
    reportIds: string[];
  }>;
}
