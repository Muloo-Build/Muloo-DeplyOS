"use client";

import { useEffect, useState } from "react";

interface DeliveryTemplateTask {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  executionType: string;
  priority: string;
  status: string;
  qaRequired: boolean;
  approvalRequired: boolean;
  assigneeType?: string | null;
  plannedHours?: number | null;
  sortOrder: number;
}

interface DeliveryTemplate {
  id: string;
  name: string;
  description?: string | null;
  serviceFamily: string;
  category: string;
  scopeType: string;
  recommendedHubs: string[];
  defaultPlannedHours?: number | null;
  isActive: boolean;
  sortOrder: number;
  tasks: DeliveryTemplateTask[];
}

const serviceFamilies = [
  { value: "hubspot_architecture", label: "HubSpot Architecture" },
  { value: "custom_engineering", label: "Custom Engineering" },
  { value: "ai_automation", label: "AI Automation" }
];

export default function DeliveryTemplatesStudio() {
  const [templates, setTemplates] = useState<DeliveryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch("/api/delivery-templates");
        if (!response.ok) {
          throw new Error("Failed to load delivery templates");
        }

        const body = await response.json();
        setTemplates(body.templates ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load delivery templates"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadTemplates();
  }, []);

  function updateTemplate(
    templateId: string,
    field: keyof DeliveryTemplate,
    value: string | number | boolean | string[]
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId ? { ...template, [field]: value } : template
      )
    );
  }

  async function saveTemplate(templateId: string) {
    const template = templates.find((candidate) => candidate.id === templateId);

    if (!template) {
      return;
    }

    setSavingId(templateId);
    setError(null);

    try {
      const response = await fetch(
        `/api/delivery-templates/${encodeURIComponent(templateId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: template.name,
            description: template.description ?? "",
            serviceFamily: template.serviceFamily,
            category: template.category,
            scopeType: template.scopeType,
            recommendedHubs: template.recommendedHubs,
            defaultPlannedHours: template.defaultPlannedHours,
            isActive: template.isActive,
            sortOrder: template.sortOrder,
            tasks: template.tasks
          })
        }
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save delivery template");
      }

      setTemplates((current) =>
        current.map((candidate) =>
          candidate.id === templateId ? body.template : candidate
        )
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save delivery template"
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6 text-sm text-text-secondary">
        Loading delivery templates...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      {templates.map((template) => (
        <section
          key={template.id}
          className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6"
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm text-text-secondary">Name</span>
                <input
                  value={template.name}
                  onChange={(event) =>
                    updateTemplate(template.id, "name", event.target.value)
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm text-text-secondary">Description</span>
                <textarea
                  value={template.description ?? ""}
                  onChange={(event) =>
                    updateTemplate(
                      template.id,
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-3 min-h-[100px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">
                  Service family
                </span>
                <select
                  value={template.serviceFamily}
                  onChange={(event) =>
                    updateTemplate(
                      template.id,
                      "serviceFamily",
                      event.target.value
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                >
                  {serviceFamilies.map((family) => (
                    <option key={family.value} value={family.value}>
                      {family.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Category</span>
                <input
                  value={template.category}
                  onChange={(event) =>
                    updateTemplate(template.id, "category", event.target.value)
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Scope type</span>
                <input
                  value={template.scopeType}
                  onChange={(event) =>
                    updateTemplate(template.id, "scopeType", event.target.value)
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">
                  Default planned hours
                </span>
                <input
                  type="number"
                  value={template.defaultPlannedHours ?? ""}
                  onChange={(event) =>
                    updateTemplate(
                      template.id,
                      "defaultPlannedHours",
                      Number(event.target.value)
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-text-secondary">Sort order</span>
                <input
                  type="number"
                  value={template.sortOrder}
                  onChange={(event) =>
                    updateTemplate(
                      template.id,
                      "sortOrder",
                      Number(event.target.value)
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Template tasks
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {template.tasks.length} tasks ·{" "}
                    {template.tasks.reduce(
                      (total, task) => total + (task.plannedHours ?? 0),
                      0
                    )}{" "}
                    planned hours
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveTemplate(template.id)}
                  disabled={savingId === template.id}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-2 text-sm font-medium text-white"
                >
                  {savingId === template.id ? "Saving..." : "Save"}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {template.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-background-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {task.category ?? "Uncategorized"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-1 text-xs font-medium text-text-secondary">
                        {task.plannedHours ?? 0}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
