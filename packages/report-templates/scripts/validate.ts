import {
  COMMERCE_TEMPLATES,
  MARKETING_TEMPLATES,
  OPS_TEMPLATES,
  SALES_TEMPLATES,
  SERVICE_TEMPLATES,
} from '../src';
import { validateTemplateCatalogue } from '../src/validation';
import type { ReportFilter, ReportTemplate, TemplateConfig } from '../src/types';

const all = [
  ...MARKETING_TEMPLATES,
  ...SALES_TEMPLATES,
  ...SERVICE_TEMPLATES,
  ...OPS_TEMPLATES,
  ...COMMERCE_TEMPLATES,
];

// ---------------------------------------------------------------------------
// Shape validation (operator vocabulary, value typing, required fields).
// ---------------------------------------------------------------------------
const issues = validateTemplateCatalogue(all);
if (issues.length > 0) {
  console.error(`\n[report-templates] ${issues.length} shape issue(s):\n`);
  for (const issue of issues) {
    console.error(`  - ${issue.templateId} :: ${issue.field} :: ${issue.message}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Semantic assertions — protect the catalogue from regressions where a
// template's filter set drifts away from what its name/description promises.
// Each assertion takes the built ReportDefinition and either returns null
// (pass) or a human-readable failure string.
// ---------------------------------------------------------------------------
type SemanticCheck = {
  templateId: string;
  reason: string;
  assert: (filters: ReportFilter[]) => string | null;
};

const cfg: TemplateConfig = { portalId: 'semantic' };
const byId = new Map<string, ReportTemplate>(all.map((t) => [t.id, t]));

function hasNeqExcluding(filters: ReportFilter[], property: string, mustExclude: string[]): string | null {
  const f = filters.find((x) => x.property === property && x.operator === 'neq');
  if (!f) return `expected a neq filter on "${property}"`;
  const value = typeof f.value === 'string' ? f.value : '';
  const tokens = value.split(',').map((s) => s.trim()).filter(Boolean);
  const missing = mustExclude.filter((m) => !tokens.includes(m));
  if (missing.length > 0) {
    return `neq filter on "${property}" must exclude ${mustExclude.join(', ')} but is missing ${missing.join(', ')} (current value: "${value}")`;
  }
  return null;
}

const checks: SemanticCheck[] = [
  {
    templateId: 'sales_deals_by_stage',
    reason: '"Open Deals" must exclude both closedwon and closedlost',
    assert: (f) => hasNeqExcluding(f, 'dealstage', ['closedwon', 'closedlost']),
  },
  {
    templateId: 'sales_deal_amount_by_owner',
    reason: '"Open Deal Amount" must exclude both closedwon and closedlost',
    assert: (f) => hasNeqExcluding(f, 'dealstage', ['closedwon', 'closedlost']),
  },
  {
    templateId: 'ops_deals_missing_closedate',
    reason: '"Open Deals Missing Close Date" must exclude both closedwon and closedlost',
    assert: (f) => hasNeqExcluding(f, 'dealstage', ['closedwon', 'closedlost']),
  },
  {
    templateId: 'service_tickets_by_status',
    reason: '"Open ticket distribution" must exclude the closed pipeline stage',
    assert: (f) => hasNeqExcluding(f, 'hs_pipeline_stage', ['closed']),
  },
  {
    templateId: 'service_tickets_by_owner',
    reason: '"Open Tickets by Owner" must exclude the closed pipeline stage',
    assert: (f) => hasNeqExcluding(f, 'hs_pipeline_stage', ['closed']),
  },
  {
    templateId: 'sales_closed_won_revenue_by_month',
    reason: '"Closed-Won Revenue" must filter dealstage == closedwon',
    assert: (f) => {
      const eq = f.find((x) => x.property === 'dealstage' && x.operator === 'eq' && x.value === 'closedwon');
      return eq ? null : 'expected eq filter dealstage=closedwon';
    },
  },
];

const semanticFailures: string[] = [];
for (const check of checks) {
  const tpl = byId.get(check.templateId);
  if (!tpl) {
    semanticFailures.push(`  - missing template "${check.templateId}" (catalogue drift?)`);
    continue;
  }
  const def = tpl.build(cfg);
  const err = check.assert(def.filters);
  if (err) {
    semanticFailures.push(`  - ${check.templateId} :: ${check.reason} :: ${err}`);
  }
}

if (semanticFailures.length > 0) {
  console.error(`\n[report-templates] ${semanticFailures.length} semantic issue(s):\n`);
  for (const line of semanticFailures) console.error(line);
  process.exit(1);
}

console.log(
  `[report-templates] ${all.length} templates validated OK (${checks.length} semantic checks passed).`,
);
