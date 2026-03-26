import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const mqlByMonth: ReportTemplate = {
  id: 'mql_by_month',
  name: 'MQL Volume by Month',
  section: 'volume',
  chartType: 'LINE',
  requiredProperties: ['hs_v2_date_entered_marketingqualifiedlead'],
  description: 'Line chart showing MQL volume trend over time',
  displayOrder: 3,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'MQL Volume by Month',
      description: 'Monthly MQL inflow trend',
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
          property: 'hs_v2_date_entered_marketingqualifiedlead',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'LINE',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 365
      }
    };
  }
};
