import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const mqlBySource: ReportTemplate = {
  id: 'mql_by_source',
  name: 'MQL by Lead Source',
  section: 'source',
  chartType: 'BAR',
  requiredProperties: ['primary_lead_source', 'hs_v2_date_entered_marketingqualifiedlead'],
  description: 'Bar chart showing MQL volume by primary lead source',
  displayOrder: 4,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'MQL by Lead Source',
      description: 'MQL breakdown by source of origin',
      reportType: 'CONTACTS',
      filters: [
        {
          property: 'lifecyclestage',
          operator: 'eq',
          value: 'marketingqualifiedlead'
        }
      ],
      dimensions: [
        {
          property: config.primaryLeadSourceProperty ?? 'primary_lead_source',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'BAR',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 365
      }
    };
  }
};
