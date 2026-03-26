import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const lastKeyActionDistribution: ReportTemplate = {
  id: 'last_key_action_distribution',
  name: 'Last Key Action Distribution',
  section: 'conversion',
  chartType: 'DONUT',
  requiredProperties: ['last_key_action'],
  description: 'Donut chart showing distribution of contacts by their last key action',
  displayOrder: 9,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Last Key Action Distribution',
      description: 'Contact distribution by most recent key action',
      reportType: 'CONTACTS',
      filters: [],
      dimensions: [
        {
          property: config.lastKeyActionProperty ?? 'last_key_action',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'DONUT',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 0
      }
    };
  }
};
