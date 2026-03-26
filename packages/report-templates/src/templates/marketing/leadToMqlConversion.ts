import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const leadToMqlConversion: ReportTemplate = {
  id: 'lead_to_mql_conversion',
  name: 'Lead to MQL Conversion Rate',
  section: 'conversion',
  chartType: 'NUMERIC',
  requiredProperties: ['lifecyclestage', 'hs_v2_date_entered_lead', 'hs_v2_date_entered_marketingqualifiedlead'],
  description: 'Numeric metric showing conversion rate from lead to MQL',
  displayOrder: 6,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Lead to MQL Conversion Rate',
      description: 'Percentage of leads that convert to MQL',
      reportType: 'CONTACTS',
      filters: [
        {
          property: 'hs_v2_date_entered_lead',
          operator: 'is_set'
        }
      ],
      dimensions: [
        {
          property: 'lifecyclestage',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'NUMERIC',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 365
      }
    };
  }
};
