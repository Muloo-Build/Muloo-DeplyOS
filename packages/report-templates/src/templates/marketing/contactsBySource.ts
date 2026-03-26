import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const contactsBySource: ReportTemplate = {
  id: 'contacts_by_source',
  name: 'Contacts by Primary Lead Source',
  section: 'source',
  chartType: 'BAR',
  requiredProperties: ['primary_lead_source'],
  description: 'Bar chart showing total contacts grouped by their primary lead source value',
  displayOrder: 1,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Contacts by Primary Lead Source',
      description: 'Volume breakdown by source of origin',
      reportType: 'CONTACTS',
      filters: [],
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
