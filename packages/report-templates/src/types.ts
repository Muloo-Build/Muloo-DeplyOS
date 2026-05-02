export type DashboardSection =
  | 'volume'
  | 'conversion'
  | 'source'
  | 'revenue'
  | 'hygiene'
  | 'pipeline'
  | 'service'
  | 'ops'
  | 'commerce';
export type ChartType = 'BAR' | 'DONUT' | 'LINE' | 'NUMERIC' | 'TABLE' | 'AREA';
export type ReportHub =
  | 'marketing'
  | 'sales'
  | 'service'
  | 'ops'
  | 'commerce';

export interface ReportFilter {
  property: string;
  operator: string;
  value?: string | string[];
}

export interface ReportDimension {
  property: string;
  type: 'property' | 'custom';
}

export interface ReportMetric {
  name: string;
  type: 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN';
  property?: string;
}

export interface ReportDefinition {
  name: string;
  description: string;
  reportType: string;
  filters: ReportFilter[];
  dimensions: ReportDimension[];
  metrics: ReportMetric[];
  visualizationType: string;
  dateRange: object;
}

export interface TemplateConfig {
  portalId: string;
  primaryLeadSourceProperty?: string;
  lastKeyActionProperty?: string;
  dateRange?: { start: string; end: string };
}

export interface ReportTemplate {
  id: string;
  name: string;
  section: DashboardSection;
  chartType: ChartType;
  requiredProperties: string[];
  description: string;
  displayOrder?: number;
  // T8 — `hub` is additive. Existing templates default to 'marketing' via
  // the registration site (TemplateEngine) so that legacy templates without
  // an explicit hub still group correctly in the catalogue.
  hub?: ReportHub;
  build(config: TemplateConfig): ReportDefinition;
}
