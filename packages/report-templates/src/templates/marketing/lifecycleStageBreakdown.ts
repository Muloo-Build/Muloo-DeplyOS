import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const lifecycleStageBreakdown: ReportTemplate = {
  id: 'lifecycle_stage_breakdown',
  name: 'Lifecycle Stage Breakdown',
  section: 'conversion',
  chartType: 'DONUT',
  requiredProperties: ['lifecyclestage'],
  description: 'Donut chart showing contact distribution across lifecycle stages',
  displayOrder: 5,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Lifecycle Stage Breakdown',
      description: 'Current distribution of contacts by lifecycle stage',
      reportType: 'CONTACTS',
      filters: [],
      dimensions: [
        {
          property: 'lifecyclestage',
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
