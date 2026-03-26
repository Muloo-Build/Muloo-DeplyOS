import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const contactsCreatedByMonth: ReportTemplate = {
  id: 'contacts_created_by_month',
  name: 'Contacts Created by Month',
  section: 'volume',
  chartType: 'BAR',
  requiredProperties: ['createdate'],
  description: 'Bar chart showing total contacts created per month',
  displayOrder: 2,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Contacts Created by Month',
      description: 'Monthly volume trend of new contacts',
      reportType: 'CONTACTS',
      filters: [],
      dimensions: [
        {
          property: 'createdate',
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
