import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

export const closedWonByMonth: ReportTemplate = {
  id: 'closed_won_by_month',
  name: 'Closed Won Deals by Month',
  section: 'revenue',
  chartType: 'BAR',
  requiredProperties: ['closedate', 'dealstage'],
  description: 'Bar chart showing count of closed won deals per month',
  displayOrder: 7,

  build(config: TemplateConfig): ReportDefinition {
    return {
      name: 'Closed Won Deals by Month',
      description: 'Monthly count of closed won deals',
      reportType: 'DEALS',
      filters: [
        {
          property: 'dealstage',
          operator: 'eq',
          value: 'closedwon'
        }
      ],
      dimensions: [
        {
          property: 'closedate',
          type: 'property',
        }
      ],
      metrics: [
        { name: 'count', type: 'COUNT' },
        { name: 'revenue', type: 'SUM', property: 'amount' }
      ],
      visualizationType: 'BAR',
      dateRange: {
        type: 'ROLLING',
        rollingDays: 365
      }
    };
  }
};
