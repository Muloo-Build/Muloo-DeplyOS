import type { ReportTemplate, TemplateConfig, ReportDefinition, ReportHub } from './types';
import { MARKETING_TEMPLATES } from './templates/marketing';
import { SALES_TEMPLATES } from './templates/sales';
import { SERVICE_TEMPLATES } from './templates/service';
import { OPS_TEMPLATES } from './templates/ops';
import { COMMERCE_TEMPLATES } from './templates/commerce';

// Marketing templates predate the `hub` field; tag them at registration time
// so the catalogue API can group consistently without editing 10 files.
const ALL_TEMPLATES: ReportTemplate[] = [
  ...MARKETING_TEMPLATES.map((t) => ({ ...t, hub: t.hub ?? ('marketing' as ReportHub) })),
  ...SALES_TEMPLATES,
  ...SERVICE_TEMPLATES,
  ...OPS_TEMPLATES,
  ...COMMERCE_TEMPLATES,
];

export class TemplateEngine {
  private templates: Map<string, ReportTemplate>;

  constructor() {
    this.templates = new Map();
    ALL_TEMPLATES.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  getTemplate(templateId: string): ReportTemplate | undefined {
    return this.templates.get(templateId);
  }

  buildReport(templateId: string, config: TemplateConfig): ReportDefinition {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template.build(config);
  }

  getAllTemplateIds(): string[] {
    return Array.from(this.templates.keys()).sort();
  }

  getAllTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => {
      const hubA = a.hub ?? 'marketing';
      const hubB = b.hub ?? 'marketing';
      if (hubA !== hubB) return hubA.localeCompare(hubB);
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
  }

  getTemplatesBySection(section: string): ReportTemplate[] {
    return Array.from(this.templates.values())
      .filter((t) => t.section === section)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  }

  getTemplatesByHub(hub: ReportHub): ReportTemplate[] {
    return Array.from(this.templates.values())
      .filter((t) => (t.hub ?? 'marketing') === hub)
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  }

  getTemplateMetadata(templateId: string) {
    const template = this.getTemplate(templateId);
    if (!template) return null;
    return {
      id: template.id,
      name: template.name,
      section: template.section,
      chartType: template.chartType,
      requiredProperties: template.requiredProperties,
      description: template.description,
      displayOrder: template.displayOrder,
      hub: template.hub ?? 'marketing',
    };
  }

  getAllTemplateMetadata() {
    return this.getAllTemplates().map((t) => this.getTemplateMetadata(t.id));
  }
}
