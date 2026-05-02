import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

const rolling90 = { type: 'ROLLING', rollingDays: 90 } as const;
const rolling365 = { type: 'ROLLING', rollingDays: 365 } as const;

const tpl = (
  id: string,
  name: string,
  chartType: ReportTemplate['chartType'],
  description: string,
  build: (config: TemplateConfig) => ReportDefinition,
  requiredProperties: string[] = [],
  displayOrder = 0,
): ReportTemplate => ({
  id,
  name,
  section: 'service',
  chartType,
  description,
  requiredProperties,
  displayOrder,
  hub: 'service',
  build,
});

export const ticketsByStatus: ReportTemplate = tpl(
  'service_tickets_by_status',
  'Tickets by Status',
  'DONUT',
  'Open ticket distribution by hs_pipeline_stage.',
  () => ({
    name: 'Tickets by Status',
    description: 'Open ticket distribution',
    reportType: 'TICKETS',
    filters: [],
    dimensions: [{ property: 'hs_pipeline_stage', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'DONUT',
    dateRange: rolling365,
  }),
  ['hs_pipeline_stage'],
  1,
);

export const ticketsByCategory: ReportTemplate = tpl(
  'service_tickets_by_category',
  'Tickets by Category',
  'BAR',
  'Ticket volume grouped by hs_ticket_category. Shows which areas drive support load.',
  () => ({
    name: 'Tickets by Category',
    description: 'Support load by category',
    reportType: 'TICKETS',
    filters: [],
    dimensions: [{ property: 'hs_ticket_category', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling90,
  }),
  ['hs_ticket_category'],
  2,
);

export const firstResponseTime: ReportTemplate = tpl(
  'service_first_response_time',
  'Average First Response Time',
  'NUMERIC',
  'Average time-to-first-response on tickets in the last 90 days.',
  () => ({
    name: 'Average First Response Time (90d)',
    description: 'Support responsiveness',
    reportType: 'TICKETS',
    filters: [],
    dimensions: [],
    metrics: [
      { name: 'first_response_avg', type: 'AVG', property: 'time_to_first_agent_reply' },
    ],
    visualizationType: 'NUMERIC',
    dateRange: rolling90,
  }),
  ['time_to_first_agent_reply'],
  3,
);

export const ticketsCreatedByMonth: ReportTemplate = tpl(
  'service_tickets_created_by_month',
  'Tickets Created by Month',
  'LINE',
  'Trend of new tickets created per month over the last year.',
  () => ({
    name: 'Tickets Created by Month',
    description: 'Inbound ticket volume trend',
    reportType: 'TICKETS',
    filters: [],
    dimensions: [{ property: 'createdate', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'LINE',
    dateRange: rolling365,
  }),
  ['createdate'],
  4,
);

export const ticketsByOwner: ReportTemplate = tpl(
  'service_tickets_by_owner',
  'Open Tickets by Owner',
  'BAR',
  'Open ticket count grouped by ticket owner. Shows queue load per agent.',
  () => ({
    name: 'Open Tickets by Owner',
    description: 'Queue load per agent',
    reportType: 'TICKETS',
    filters: [
      { property: 'hs_pipeline_stage', operator: 'NEQ', value: 'closed' },
    ],
    dimensions: [{ property: 'hubspot_owner_id', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling90,
  }),
  ['hubspot_owner_id', 'hs_pipeline_stage'],
  5,
);

export const SERVICE_TEMPLATES: ReportTemplate[] = [
  ticketsByStatus,
  ticketsByCategory,
  firstResponseTime,
  ticketsCreatedByMonth,
  ticketsByOwner,
];
