import type { ReportTemplate, TemplateConfig, ReportDefinition } from '../../types';

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
  section: 'ops',
  chartType,
  description,
  requiredProperties,
  displayOrder,
  hub: 'ops',
  build,
});

export const contactsMissingOwner: ReportTemplate = tpl(
  'ops_contacts_missing_owner',
  'Contacts Missing an Owner',
  'NUMERIC',
  'Count of contacts where hubspot_owner_id is empty. Hygiene baseline.',
  () => ({
    name: 'Contacts Missing an Owner',
    description: 'Records lacking ownership',
    reportType: 'CONTACTS',
    filters: [{ property: 'hubspot_owner_id', operator: 'not_set' }],
    dimensions: [],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'NUMERIC',
    dateRange: rolling365,
  }),
  ['hubspot_owner_id'],
  1,
);

export const companiesMissingIndustry: ReportTemplate = tpl(
  'ops_companies_missing_industry',
  'Companies Missing Industry',
  'NUMERIC',
  'Count of company records with no industry value. Highlights enrichment gaps.',
  () => ({
    name: 'Companies Missing Industry',
    description: 'Companies needing enrichment',
    reportType: 'COMPANIES',
    filters: [{ property: 'industry', operator: 'not_set' }],
    dimensions: [],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'NUMERIC',
    dateRange: rolling365,
  }),
  ['industry'],
  2,
);

export const recordsByOwnerLoad: ReportTemplate = tpl(
  'ops_records_by_owner_load',
  'Contact Records per Owner',
  'BAR',
  'Distribution of contact records across owners. Identifies imbalanced books.',
  () => ({
    name: 'Contact Records per Owner',
    description: 'Owner load distribution',
    reportType: 'CONTACTS',
    filters: [],
    dimensions: [{ property: 'hubspot_owner_id', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'BAR',
    dateRange: rolling365,
  }),
  ['hubspot_owner_id'],
  3,
);

export const dealsMissingCloseDate: ReportTemplate = tpl(
  'ops_deals_missing_closedate',
  'Open Deals Missing Close Date',
  'NUMERIC',
  'Open deals without a close date. Forecast hygiene.',
  () => ({
    name: 'Open Deals Missing Close Date',
    description: 'Forecast hygiene gap',
    reportType: 'DEALS',
    filters: [
      // "Open" must exclude both terminal stages — closed-lost deals
      // without a close date are not a forecast hygiene problem.
      { property: 'dealstage', operator: 'neq', value: 'closedwon,closedlost' },
      { property: 'closedate', operator: 'not_set' },
    ],
    dimensions: [],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'NUMERIC',
    dateRange: rolling365,
  }),
  ['dealstage', 'closedate'],
  4,
);

export const contactsByLifecycleHygiene: ReportTemplate = tpl(
  'ops_contacts_lifecycle_hygiene',
  'Contacts by Lifecycle Stage (hygiene view)',
  'TABLE',
  'Tabular view of contacts grouped by lifecyclestage including unknown/blank for hygiene scrubs.',
  () => ({
    name: 'Contacts by Lifecycle Stage (hygiene)',
    description: 'Lifecycle distribution incl. blanks',
    reportType: 'CONTACTS',
    filters: [],
    dimensions: [{ property: 'lifecyclestage', type: 'property' }],
    metrics: [{ name: 'count', type: 'COUNT' }],
    visualizationType: 'TABLE',
    dateRange: rolling365,
  }),
  ['lifecyclestage'],
  5,
);

export const OPS_TEMPLATES: ReportTemplate[] = [
  contactsMissingOwner,
  companiesMissingIndustry,
  recordsByOwnerLoad,
  dealsMissingCloseDate,
  contactsByLifecycleHygiene,
];
