import { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

const rolling365 = { type: 'ROLLING', rollingDays: 365 } as const;
const rolling90 = { type: 'ROLLING', rollingDays: 90 } as const;

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
  section: 'commerce',
  chartType,
  description,
  requiredProperties,
  displayOrder,
  hub: 'commerce',
  build,
});

export const invoicesByStatus: ReportTemplate = tpl(
  'commerce_invoices_by_status',
  'Invoices by Status',
  'DONUT',
  'Distribution of invoices by hs_invoice_status (draft / open / paid / voided).',
  () => ({
    name: 'Invoices by Status',
    description: 'AR pipeline view',
    reportType: 'INVOICES',
    filters: [],
    dimensions: [{ property: 'hs_invoice_status', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'DONUT',
    dateRange: rolling365,
  }),
  ['hs_invoice_status'],
  1,
);

export const invoiceRevenueByMonth: ReportTemplate = tpl(
  'commerce_invoice_revenue_by_month',
  'Invoiced Revenue by Month',
  'LINE',
  'Sum of invoice amounts per month over the last year.',
  () => ({
    name: 'Invoiced Revenue by Month',
    description: 'Monthly invoiced revenue trend',
    reportType: 'INVOICES',
    filters: [],
    dimensions: [{ property: 'hs_invoice_date', type: 'property' }],
    metrics: [{ name: 'amount_sum', type: 'SUM', property: 'hs_amount_billed' }],
    visualizationType: 'LINE',
    dateRange: rolling365,
  }),
  ['hs_invoice_date', 'hs_amount_billed'],
  2,
);

export const overdueInvoiceCount: ReportTemplate = tpl(
  'commerce_overdue_invoice_count',
  'Overdue Invoices',
  'NUMERIC',
  'Count of invoices in "open" status past their due date.',
  () => ({
    name: 'Overdue Invoices',
    description: 'AR risk indicator',
    reportType: 'INVOICES',
    filters: [
      { property: 'hs_invoice_status', operator: 'eq', value: 'open' },
      { property: 'hs_due_date', operator: 'lt', value: 'TODAY' },
    ],
    dimensions: [],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'NUMERIC',
    dateRange: rolling90,
  }),
  ['hs_invoice_status', 'hs_due_date'],
  3,
);

export const subscriptionsByStatus: ReportTemplate = tpl(
  'commerce_subscriptions_by_status',
  'Subscriptions by Status',
  'BAR',
  'Active subscription count grouped by hs_subscription_status.',
  () => ({
    name: 'Subscriptions by Status',
    description: 'Subscription portfolio view',
    reportType: 'SUBSCRIPTIONS',
    filters: [],
    dimensions: [{ property: 'hs_subscription_status', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling365,
  }),
  ['hs_subscription_status'],
  4,
);

export const paymentsByMethod: ReportTemplate = tpl(
  'commerce_payments_by_method',
  'Payments by Method',
  'DONUT',
  'Payment count grouped by hs_payment_method over the last 90 days.',
  () => ({
    name: 'Payments by Method (90d)',
    description: 'Payment mix view',
    reportType: 'PAYMENTS',
    filters: [],
    dimensions: [{ property: 'hs_payment_method', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'DONUT',
    dateRange: rolling90,
  }),
  ['hs_payment_method'],
  5,
);

export const COMMERCE_TEMPLATES: ReportTemplate[] = [
  invoicesByStatus,
  invoiceRevenueByMonth,
  overdueInvoiceCount,
  subscriptionsByStatus,
  paymentsByMethod,
];
