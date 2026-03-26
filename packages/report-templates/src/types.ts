export type DashboardSection = 'volume' | 'conversion' | 'source' | 'revenue' | 'hygiene';
export type ChartType = 'BAR' | 'DONUT' | 'LINE' | 'NUMERIC' | 'TABLE';

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
  build(config: TemplateConfig): ReportDefinition;
}
