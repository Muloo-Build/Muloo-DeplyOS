import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

const tpl = (
  id: string,
  name: string,
  section: ReportTemplate['section'],
  chartType: ReportTemplate['chartType'],
  description: string,
  reportType: string,
  build: (config: TemplateConfig) => ReportDefinition,
  requiredProperties: string[] = [],
  displayOrder = 0,
): ReportTemplate => ({
  id,
  name,
  section,
  chartType,
  description,
  requiredProperties,
  displayOrder,
  hub: 'sales',
  build,
});

const rolling365 = { type: 'ROLLING', rollingDays: 365 } as const;
const rolling90 = { type: 'ROLLING', rollingDays: 90 } as const;

export const dealsByStage: ReportTemplate = tpl(
  'sales_deals_by_stage',
  'Open Deals by Pipeline Stage',
  'pipeline',
  'BAR',
  'Open deals grouped by current pipeline stage. Shows where the pipeline is concentrated.',
  'DEALS',
  () => ({
    name: 'Open Deals by Pipeline Stage',
    description: 'Pipeline distribution across stages',
    reportType: 'DEALS',
    filters: [{ property: 'dealstage', operator: 'neq', value: 'closedwon' }],
    dimensions: [{ property: 'dealstage', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling365,
  }),
  ['dealstage'],
  1,
);

export const dealAmountByOwner: ReportTemplate = tpl(
  'sales_deal_amount_by_owner',
  'Open Deal Amount by Owner',
  'pipeline',
  'BAR',
  'Sum of open deal amount grouped by deal owner. Shows pipeline coverage per rep.',
  'DEALS',
  () => ({
    name: 'Open Deal Amount by Owner',
    description: 'Pipeline coverage per rep',
    reportType: 'DEALS',
    filters: [{ property: 'dealstage', operator: 'neq', value: 'closedwon' }],
    dimensions: [{ property: 'hubspot_owner_id', type: 'property' }],
    metrics: [{ name: 'amount_sum', type: 'SUM', property: 'amount' }],
    visualizationType: 'BAR',
    dateRange: rolling365,
  }),
  ['hubspot_owner_id', 'amount'],
  2,
);

export const closedWonRevenueByMonth: ReportTemplate = tpl(
  'sales_closed_won_revenue_by_month',
  'Closed-Won Revenue by Month',
  'revenue',
  'LINE',
  'Closed-won deal amount summed per close-month over the last 12 months.',
  'DEALS',
  () => ({
    name: 'Closed-Won Revenue by Month',
    description: 'Monthly recognised revenue trend',
    reportType: 'DEALS',
    filters: [{ property: 'dealstage', operator: 'eq', value: 'closedwon' }],
    dimensions: [{ property: 'closedate', type: 'property' }],
    metrics: [{ name: 'amount_sum', type: 'SUM', property: 'amount' }],
    visualizationType: 'LINE',
    dateRange: rolling365,
  }),
  ['closedate', 'amount'],
  3,
);

export const winRateByOwner: ReportTemplate = tpl(
  'sales_win_rate_by_owner',
  'Win Rate by Owner (last 90 days)',
  'conversion',
  'BAR',
  'Closed-won count divided by total closed deals per owner over the last 90 days.',
  'DEALS',
  () => ({
    name: 'Win Rate by Owner (90d)',
    description: 'Closed-won % per rep',
    reportType: 'DEALS',
    filters: [
      { property: 'dealstage', operator: 'in', value: 'closedwon,closedlost' },
    ],
    dimensions: [
      { property: 'hubspot_owner_id', type: 'property' },
      { property: 'dealstage', type: 'property' },
    ],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling90,
  }),
  ['hubspot_owner_id', 'dealstage'],
  4,
);

export const dealVelocityByStage: ReportTemplate = tpl(
  'sales_deal_velocity_by_stage',
  'Average Days in Stage',
  'pipeline',
  'BAR',
  'Average time deals spend in each pipeline stage. Identifies stuck stages.',
  'DEALS',
  () => ({
    name: 'Average Days in Stage',
    description: 'Pipeline velocity diagnostic',
    reportType: 'DEALS',
    filters: [],
    dimensions: [{ property: 'dealstage', type: 'property' }],
    metrics: [
      { name: 'days_in_stage_avg', type: 'AVG', property: 'hs_v2_time_in_current_stage' },
    ],
    visualizationType: 'BAR',
    dateRange: rolling365,
  }),
  ['dealstage', 'hs_v2_time_in_current_stage'],
  5,
);

export const SALES_TEMPLATES: ReportTemplate[] = [
  dealsByStage,
  dealAmountByOwner,
  closedWonRevenueByMonth,
  winRateByOwner,
  dealVelocityByStage,
];
