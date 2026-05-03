import {
  COMMERCE_TEMPLATES,
  MARKETING_TEMPLATES,
  OPS_TEMPLATES,
  SALES_TEMPLATES,
  SERVICE_TEMPLATES,
} from '../src';
import { validateTemplateCatalogue } from '../src/validation';

const all = [
  ...MARKETING_TEMPLATES,
  ...SALES_TEMPLATES,
  ...SERVICE_TEMPLATES,
  ...OPS_TEMPLATES,
  ...COMMERCE_TEMPLATES,
];

const issues = validateTemplateCatalogue(all);

if (issues.length > 0) {
  console.error(`\n[report-templates] ${issues.length} validation issue(s):\n`);
  for (const issue of issues) {
    console.error(`  - ${issue.templateId} :: ${issue.field} :: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`[report-templates] ${all.length} templates validated OK.`);
