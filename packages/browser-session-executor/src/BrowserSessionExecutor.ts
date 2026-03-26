import type {
  BrowserSessionConfig,
  DashboardDefinition,
  ExecutionResult,
  PropertyDefinition,
  ReportDefinition
} from './types';

/**
 * Executor for HubSpot operations via browser session authenticated APIs
 * Uses the hubspotapi-csrf cookie for authentication to internal APIs
 */
export class BrowserSessionExecutor {
  constructor(private config: BrowserSessionConfig) {}

  /**
   * Get request headers with CSRF token for HubSpot internal API
   */
  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-HubSpot-CSRF-hubspotapi': this.config.csrfToken
    };
  }

  /**
   * Base URL for HubSpot internal API calls
   */
  private get apiBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Build query params for portal ID
   */
  private buildPortalParam(): string {
    return `portalId=${this.config.portalId}`;
  }

  /**
   * Validate the session by making a test API call
   */
  async validateSession(): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/properties/v1/contacts/properties/named/firstname?${this.buildPortalParam()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (response.ok) {
        return {
          success: true,
          action: 'validate_session',
          tier: 'browser_session'
        };
      }

      return {
        success: false,
        action: 'validate_session',
        error: `Validation failed with status ${response.status}`,
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'validate_session',
        error: err?.message || 'Unknown error during validation',
        tier: 'browser_session'
      };
    }
  }

  /**
   * Get a contact property by name
   */
  async getContactProperty(name: string): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/properties/v1/contacts/properties/named/${encodeURIComponent(name)}?${this.buildPortalParam()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: true,
            action: 'get_contact_property',
            data: null,
            tier: 'browser_session'
          };
        }
        const body = await response.text();
        return {
          success: false,
          action: 'get_contact_property',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }
      const data = (await response.json()) as Record<string, unknown>;
      return {
        success: true,
        action: 'get_contact_property',
        data,
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'get_contact_property',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }

  /**
   * Create a contact property
   */
  async createContactProperty(propertyDef: PropertyDefinition): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/properties/v1/contacts/properties?${this.buildPortalParam()}`;
      const payload = {
        name: propertyDef.name,
        label: propertyDef.label,
        type: propertyDef.type,
        fieldType: propertyDef.fieldType,
        ...(propertyDef.description ? { description: propertyDef.description } : {}),
        ...(propertyDef.groupName ? { groupName: propertyDef.groupName } : {}),
        ...(propertyDef.formField !== undefined ? { formField: propertyDef.formField } : {}),
        ...(propertyDef.options
          ? {
              options: propertyDef.options.map((opt) => ({
                label: opt.label,
                value: opt.value,
                ...(opt.displayOrder !== undefined ? { displayOrder: opt.displayOrder } : {}),
                ...(opt.hidden !== undefined ? { hidden: opt.hidden } : {})
              }))
            }
          : {})
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          action: 'create_contact_property',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        success: true,
        action: 'create_contact_property',
        data,
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'create_contact_property',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }

  /**
   * Create a report
   */
  async createReport(reportDef: ReportDefinition): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/reports/v2/reports?${this.buildPortalParam()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(reportDef)
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          action: 'create_report',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      const reportId =
        typeof data?.reportId === 'string'
          ? data.reportId
          : typeof data?.id === 'string'
            ? data.id
            : undefined;
      return {
        success: true,
        action: 'create_report',
        data: {
          ...data,
          ...(reportId
            ? {
                reportId,
                reportUrl: `${this.apiBaseUrl}/reports/${encodeURIComponent(reportId)}?${this.buildPortalParam()}`
              }
            : {})
        },
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'create_report',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }

  /**
   * Create a dashboard
   */
  async createDashboard(
    dashboardDef: DashboardDefinition & { portalId?: string }
  ): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/reports/v2/dashboards?${this.buildPortalParam()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: dashboardDef.name,
          ...(dashboardDef.description ? { description: dashboardDef.description } : {}),
          filters: [],
        })
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          action: 'create_dashboard',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }
      const data = (await response.json()) as Record<string, unknown>;
      const dashboardId =
        typeof data?.dashboardId === 'string'
          ? data.dashboardId
          : typeof data?.id === 'string'
            ? data.id
            : undefined;
      return {
        success: true,
        action: 'create_dashboard',
        data: {
          ...data,
          ...(dashboardId
            ? {
                dashboardId,
                dashboardUrl: `${this.apiBaseUrl}/reports/${encodeURIComponent(dashboardId)}?${this.buildPortalParam()}`
              }
            : {})
        },
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'create_dashboard',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }

  /**
   * Add a report to a dashboard
   */
  async addReportToDashboard(dashboardId: string, reportId: string): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/reports/v2/dashboards/${encodeURIComponent(dashboardId)}?${this.buildPortalParam()}`;
      const currentDashboardResponse = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!currentDashboardResponse.ok) {
        const body = await currentDashboardResponse.text();
        return {
          success: false,
          action: 'add_report_to_dashboard',
          error: `Failed to load dashboard with status ${currentDashboardResponse.status}: ${body}`,
          tier: 'browser_session'
        };
      }

      const existingDashboard = (await currentDashboardResponse.json()) as Record<
        string,
        unknown
      >;
      const currentReports = Array.isArray(existingDashboard?.reports)
        ? existingDashboard.reports
        : [];
      const nextReports = currentReports.some((entry: unknown) => {
        if (typeof entry === 'string') {
          return entry === reportId;
        }

        return (
          entry &&
          typeof entry === 'object' &&
          (entry as Record<string, unknown>).id === reportId
        );
      })
        ? currentReports
        : [...currentReports, { id: reportId }];

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          ...existingDashboard,
          reports: nextReports
        })
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          action: 'add_report_to_dashboard',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        success: true,
        action: 'add_report_to_dashboard',
        data: {
          ...data,
          dashboardId,
          reportId
        },
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'add_report_to_dashboard',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }

  /**
   * List dashboards in the portal
   */
  async listDashboards(): Promise<ExecutionResult> {
    try {
      const url = `${this.apiBaseUrl}/api/reports/v2/dashboards?${this.buildPortalParam()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          action: 'list_dashboards',
          error: `Failed with status ${response.status}: ${body}`,
          tier: 'browser_session'
        };
      }

      const data = (await response.json()) as unknown;
      return {
        success: true,
        action: 'list_dashboards',
        data: Array.isArray(data)
          ? data.map((dashboard: Record<string, unknown>) => ({
              dashboardId:
                (typeof dashboard.id === 'string' ? dashboard.id : undefined) ??
                (typeof dashboard.dashboardId === 'string'
                  ? dashboard.dashboardId
                  : undefined),
              name:
                typeof dashboard.name === 'string'
                  ? dashboard.name
                  : typeof dashboard.label === 'string'
                    ? dashboard.label
                    : 'Untitled dashboard',
              reportCount: Array.isArray(dashboard.reports)
                ? dashboard.reports.length
                : 0
            }))
          : data,
        tier: 'browser_session'
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'list_dashboards',
        error: err?.message || 'Unknown error',
        tier: 'browser_session'
      };
    }
  }
}
