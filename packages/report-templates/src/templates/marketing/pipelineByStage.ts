import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const pipelineByStage: ReportTemplate = {
  id: 'pipeline_by_stage',
  name: 'Pipeline by Deal Stage',
  section: 'revenue',
  chartType: 'BAR',
  requiredProperties: ['dealstage', 'amount'],
  description: 'Bar chart showing pipeline value grouped by deal stage',
  displayOrder: 8,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Pipeline by Deal Stage',
      description: 'Open pipeline value breakdown by stage',
      reportType: 'DEALS',
      filters: [
        {
          property: 'dealstage',
          operator: 'neq',
          value: 'closedwon,closedlost'
        }
      ],
      dimensions: [
        {
          property: 'dealstage',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'revenue', type: 'SUM', property: 'amount' },
        { name: 'count', type: 'COUNT' }
      ],
      visualizationType: 'BAR',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 0
      }
    };
  }
};
