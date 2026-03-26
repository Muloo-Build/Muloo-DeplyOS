import { ReportTemplate, TemplateConfig, ReportDefinition } from './types';
import { MARKETING_TEMPLATES } from './templates/marketing';

export class TemplateEngine {
  private templates: Map<string, ReportTemplate>;

  constructor() {
    this.templates = new Map();

    // Register all marketing templates
    MARKETING_TEMPLATES.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): ReportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Build a report definition from a template ID and config
   */
  buildReport(templateId: string, config: TemplateConfig): ReportDefinition {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template.build(config);
  }

  /**
   * Get all registered template IDs
   */
  getAllTemplateIds(): string[] {
    return Array.from(this.templates.keys()).sort();
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
  }

  /**
   * Get templates by section
   */
  getTemplatesBySection(section: string): ReportTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.section === section)
      .sort((a, b) => {
        const orderA = a.displayOrder ?? 999;
        const orderB = b.displayOrder ?? 999;
        return orderA - orderB;
      });
  }

  /**
   * Get template metadata for API responses
   */
  getTemplateMetadata(templateId: string) {
    const template = this.getTemplate(templateId);
    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      section: template.section,
      chartType: template.chartType,
      requiredProperties: template.requiredProperties,
      description: template.description,
      displayOrder: template.displayOrder,
    };
  }

  /**
   * Get all template metadata
   */
  getAllTemplateMetadata() {
    return this.getAllTemplates().map(t => this.getTemplateMetadata(t.id));
  }
}
