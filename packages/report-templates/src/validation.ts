import type { ReportDefinition, ReportFilter, ReportTemplate, TemplateConfig } from './types';

/**
 * HubSpot's internal Reports v2 API accepts a fixed vocabulary of filter
 * operators. The catalogue must use ONLY these values — uppercase variants
 * (`EQ`, `NEQ`, `IN`, `NOT_HAS_PROPERTY`, …) are silently rejected at
 * install time and produce confusing failures in the operator console.
 *
 * This list mirrors the operators currently exercised by the working
 * marketing templates plus the additional comparators used by the new
 * sales / service / ops / commerce packs. If a template needs an operator
 * outside this set, add it here AND verify against a sandbox install
 * before shipping.
 */
export const ALLOWED_FILTER_OPERATORS = new Set<string>([
  'eq',
  'neq',
  'in',
  'not_in',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'contains',
  'not_contains',
  'is_set',
  'not_set',
]);

export interface TemplateValidationIssue {
  templateId: string;
  field: string;
  message: string;
}

export function validateReportDefinition(
  templateId: string,
  def: ReportDefinition,
): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = [];

  if (!def.name || typeof def.name !== 'string') {
    issues.push({ templateId, field: 'name', message: 'name is required' });
  }
  if (!def.reportType) {
    issues.push({ templateId, field: 'reportType', message: 'reportType is required' });
  }
  if (!Array.isArray(def.filters)) {
    issues.push({ templateId, field: 'filters', message: 'filters must be an array' });
  } else {
    def.filters.forEach((f: ReportFilter, idx: number) => {
      if (!f.property) {
        issues.push({
          templateId,
          field: `filters[${idx}].property`,
          message: 'filter.property is required',
        });
      }
      if (!f.operator) {
        issues.push({
          templateId,
          field: `filters[${idx}].operator`,
          message: 'filter.operator is required',
        });
      } else if (!ALLOWED_FILTER_OPERATORS.has(f.operator)) {
        issues.push({
          templateId,
          field: `filters[${idx}].operator`,
          message: `filter.operator "${f.operator}" is not in the HubSpot-compatible set: ${[
            ...ALLOWED_FILTER_OPERATORS,
          ].join(', ')}`,
        });
      }
      // Marketing convention is a comma-separated string for multi-value
      // filters; the existing browser-session payload has never been
      // observed accepting an array. Catch this drift early.
      if (Array.isArray(f.value)) {
        issues.push({
          templateId,
          field: `filters[${idx}].value`,
          message:
            'filter.value should be a comma-separated string for multi-value operators (matches the working marketing templates), not an array.',
        });
      }
    });
  }

  return issues;
}

export function validateTemplate(template: ReportTemplate): TemplateValidationIssue[] {
  const config: TemplateConfig = { portalId: 'validation' };
  let def: ReportDefinition;
  try {
    def = template.build(config);
  } catch (err) {
    return [
      {
        templateId: template.id,
        field: 'build',
        message: `template.build threw: ${err instanceof Error ? err.message : String(err)}`,
      },
    ];
  }
  return validateReportDefinition(template.id, def);
}

export function validateTemplateCatalogue(
  templates: ReportTemplate[],
): TemplateValidationIssue[] {
  return templates.flatMap((t) => validateTemplate(t));
}
