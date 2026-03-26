import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const missingSourceContacts: ReportTemplate = {
  id: 'missing_source_contacts',
  name: 'Missing Source Contacts',
  section: 'hygiene',
  chartType: 'NUMERIC',
  requiredProperties: ['primary_lead_source'],
  description: 'Numeric metric showing count of contacts with missing primary lead source',
  displayOrder: 10,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Missing Source Contacts',
      description: 'Count of contacts without a primary lead source value',
      reportType: 'CONTACTS',
      filters: [
        {
          property: config.primaryLeadSourceProperty ?? 'primary_lead_source',
          operator: 'not_set'
        }
      ],
      dimensions: [],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'NUMERIC',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 0
      }
    };
  }
};
