'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import AppShell from './AppShell'

type DiscoverySectionKey =
  | 'businessContext'
  | 'platformContext'
  | 'crmArchitecture'
  | 'salesRequirements'
  | 'marketingRequirements'
  | 'serviceRequirements'
  | 'integrationsAndData'
  | 'governanceAndOps'
  | 'risksAndAssumptions'

type FieldType = 'text' | 'textarea' | 'list' | 'boolean'

interface SectionField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

interface SectionConfig {
  key: DiscoverySectionKey
  title: string
  description: string
  fields: SectionField[]
}

interface Project {
  id: string
  name: string
  clientContext: {
    clientName: string
  }
}

interface ProjectDiscovery {
  completedSections: DiscoverySectionKey[]
  businessContext: Record<string, unknown>
  platformContext: Record<string, unknown>
  crmArchitecture: Record<string, unknown>
  salesRequirements: Record<string, unknown>
  marketingRequirements: Record<string, unknown>
  serviceRequirements: Record<string, unknown>
  integrationsAndData: Record<string, unknown>
  governanceAndOps: Record<string, unknown>
  risksAndAssumptions: Record<string, unknown>
  updatedAt?: string
}

const sections: SectionConfig[] = [
  {
    key: 'businessContext',
    title: 'Business Context',
    description: 'Capture what the client does, how they grow, and what this implementation must enable.',
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text' },
      { key: 'businessModel', label: 'Business Model', type: 'textarea' },
      { key: 'region', label: 'Region', type: 'text' },
      { key: 'teamStructure', label: 'Team Structure', type: 'textarea' },
      { key: 'growthGoals', label: 'Growth Goals', type: 'list' },
      {
        key: 'implementationObjectives',
        label: 'Implementation Objectives',
        type: 'list',
      },
    ],
  },
  {
    key: 'platformContext',
    title: 'Platform Context',
    description: 'Document the current HubSpot footprint, connected systems, and migration context.',
    fields: [
      { key: 'currentHubspotUsage', label: 'Current HubSpot Usage', type: 'textarea' },
      { key: 'activeHubs', label: 'Active Hubs', type: 'list' },
      { key: 'subscriptionTiers', label: 'Subscription Tiers', type: 'list' },
      {
        key: 'existingCrmCleanliness',
        label: 'Existing CRM Cleanliness',
        type: 'textarea',
      },
      { key: 'connectedTools', label: 'Connected Tools', type: 'list' },
      { key: 'migrationNeeds', label: 'Migration Needs', type: 'textarea' },
    ],
  },
  {
    key: 'crmArchitecture',
    title: 'CRM Architecture',
    description: 'Define objects, lifecycle logic, ownership, associations, and the structure that needs to exist in HubSpot.',
    fields: [
      { key: 'objectsInScope', label: 'Objects In Scope', type: 'list' },
      {
        key: 'contactCompanyRules',
        label: 'Contact / Company Rules',
        type: 'textarea',
      },
      { key: 'dealPipelines', label: 'Deal Pipelines', type: 'list' },
      { key: 'lifecycleStages', label: 'Lifecycle Stages', type: 'list' },
      { key: 'leadStatuses', label: 'Lead Statuses', type: 'list' },
      { key: 'ownershipModel', label: 'Ownership Model', type: 'textarea' },
      { key: 'associations', label: 'Associations', type: 'textarea' },
    ],
  },
  {
    key: 'salesRequirements',
    title: 'Sales Requirements',
    description: 'Capture the sales process, qualification logic, tasking, and reporting expectations.',
    fields: [
      {
        key: 'pipelineRequirements',
        label: 'Pipeline Requirements',
        type: 'textarea',
      },
      { key: 'qualificationLogic', label: 'Qualification Logic', type: 'textarea' },
      { key: 'sdrAeProcess', label: 'SDR / AE Process', type: 'textarea' },
      {
        key: 'taskAutomationNeeds',
        label: 'Task Automation Needs',
        type: 'textarea',
      },
      { key: 'reportingNeeds', label: 'Reporting Needs', type: 'textarea' },
    ],
  },
  {
    key: 'marketingRequirements',
    title: 'Marketing Requirements',
    description: 'Define segmentation, campaigns, forms, lead capture, email, and marketing reporting.',
    fields: [
      { key: 'segmentation', label: 'Segmentation', type: 'textarea' },
      { key: 'campaignStructure', label: 'Campaign Structure', type: 'textarea' },
      { key: 'forms', label: 'Forms', type: 'textarea' },
      { key: 'leadCapture', label: 'Lead Capture', type: 'textarea' },
      { key: 'emailNeeds', label: 'Email Needs', type: 'textarea' },
      { key: 'reportingNeeds', label: 'Reporting Needs', type: 'textarea' },
    ],
  },
  {
    key: 'serviceRequirements',
    title: 'Service Requirements',
    description: 'Cover support flows, ticket routing, SLAs, and any portal or help-centre needs.',
    fields: [
      { key: 'tickets', label: 'Tickets', type: 'textarea' },
      { key: 'supportCategories', label: 'Support Categories', type: 'textarea' },
      { key: 'routingLogic', label: 'Routing Logic', type: 'textarea' },
      { key: 'slas', label: 'SLAs', type: 'textarea' },
      {
        key: 'portalOrHelpCentreRequirements',
        label: 'Portal / Help Centre Requirements',
        type: 'textarea',
      },
    ],
  },
  {
    key: 'integrationsAndData',
    title: 'Integrations And Data',
    description: 'Capture source systems, sync directions, imports, mapping, and dedupe concerns.',
    fields: [
      { key: 'sourceSystems', label: 'Source Systems', type: 'list' },
      { key: 'syncDirection', label: 'Sync Direction', type: 'textarea' },
      { key: 'fieldMappingNeeds', label: 'Field Mapping Needs', type: 'textarea' },
      { key: 'importRequirements', label: 'Import Requirements', type: 'textarea' },
      { key: 'dedupeConcerns', label: 'Dedupe Concerns', type: 'textarea' },
    ],
  },
  {
    key: 'governanceAndOps',
    title: 'Governance And Ops',
    description: 'Define naming rules, permissions, QA expectations, training, and handover needs.',
    fields: [
      { key: 'namingConventions', label: 'Naming Conventions', type: 'textarea' },
      { key: 'permissions', label: 'Permissions', type: 'textarea' },
      { key: 'qaRequirements', label: 'QA Requirements', type: 'textarea' },
      { key: 'trainingNeeds', label: 'Training Needs', type: 'textarea' },
      { key: 'handoverNeeds', label: 'Handover Needs', type: 'textarea' },
    ],
  },
  {
    key: 'risksAndAssumptions',
    title: 'Risks And Assumptions',
    description: 'Track blockers, dependencies, access gaps, assumptions, and whether custom development is likely.',
    fields: [
      { key: 'blockers', label: 'Blockers', type: 'list' },
      { key: 'dependencies', label: 'Dependencies', type: 'list' },
      { key: 'accessIssues', label: 'Access Issues', type: 'list' },
      { key: 'customDevLikely', label: 'Custom Dev Likely', type: 'boolean' },
      { key: 'assumptions', label: 'Assumptions', type: 'list' },
    ],
  },
]

function createEmptyDiscovery(): ProjectDiscovery {
  return {
    completedSections: [],
    businessContext: {},
    platformContext: {},
    crmArchitecture: {},
    salesRequirements: {},
    marketingRequirements: {},
    serviceRequirements: {},
    integrationsAndData: {},
    governanceAndOps: {},
    risksAndAssumptions: {},
  }
}

function fieldValueToInput(value: unknown, type: FieldType) {
  if (type === 'list') {
    return Array.isArray(value) ? value.join('\n') : ''
  }

  if (type === 'boolean') {
    if (value === true) return 'true'
    if (value === false) return 'false'
    return 'unknown'
  }

  return typeof value === 'string' ? value : ''
}

function inputToFieldValue(value: string, type: FieldType) {
  if (type === 'list') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (type === 'boolean') {
    if (value === 'true') return true
    if (value === 'false') return false
    return null
  }

  return value
}

export default function DiscoveryWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null)
  const [discovery, setDiscovery] = useState<ProjectDiscovery>(createEmptyDiscovery())
  const [activeSection, setActiveSection] =
    useState<DiscoverySectionKey>('businessContext')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadDiscovery() {
      try {
        const [projectResponse, discoveryResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/discovery`),
        ])

        if (!projectResponse.ok || !discoveryResponse.ok) {
          throw new Error('Failed to load discovery workspace')
        }

        const projectBody = await projectResponse.json()
        const discoveryBody = await discoveryResponse.json()

        setProject(projectBody.project)
        setDiscovery(discoveryBody.discovery)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load discovery workspace',
        )
      } finally {
        setLoading(false)
      }
    }

    loadDiscovery()
  }, [projectId])

  const activeSectionConfig =
    sections.find((section) => section.key === activeSection) ?? sections[0]
  const activeSectionData = discovery[activeSection] as Record<string, unknown>

  function updateField(section: DiscoverySectionKey, key: string, value: string, type: FieldType) {
    setDiscovery((current) => ({
      ...current,
      [section]: {
        ...(current[section] as Record<string, unknown>),
        [key]: inputToFieldValue(value, type),
      },
    }))
  }

  function saveSection(section: DiscoverySectionKey) {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/discovery`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              section,
              data: discovery[section],
            }),
          },
        )

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error ?? 'Failed to save discovery section')
        }

        const body = await response.json()
        setDiscovery(body.discovery)
        setMessage(`${sections.find((item) => item.key === section)?.title} saved`)
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Failed to save discovery section',
        )
      }
    })
  }

  return (
    <AppShell>
      <div className="p-8">
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-28 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card"
              />
            ))}
          </div>
        ) : error && !project ? (
          <div className="rounded-2xl border border-[rgba(224,80,96,0.4)] bg-background-card p-8 text-white">
            {error}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-sm text-text-muted"
                >
                  Back to overview
                </Link>
                <h1 className="mt-3 text-3xl font-bold font-heading text-white">
                  Discovery Workspace
                </h1>
                <p className="mt-2 text-text-secondary">
                  {project?.name} · {project?.clientContext.clientName}
                </p>
              </div>

              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card px-5 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                  Completion
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {discovery.completedSections.length}/9
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-4">
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                    Sections
                  </p>
                </div>

                <div className="space-y-2">
                  {sections.map((section, index) => {
                    const complete = discovery.completedSections.includes(section.key)

                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => setActiveSection(section.key)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors ${
                          activeSection === section.key
                            ? 'bg-background-elevated text-white'
                            : 'text-text-secondary hover:bg-background-elevated hover:text-white'
                        }`}
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
                            Section {String.fromCharCode(65 + index)}
                          </p>
                          <p className="mt-1 text-sm font-medium">{section.title}</p>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            complete ? 'bg-status-success' : 'bg-text-muted'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
              </aside>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-background-card p-6">
                <div className="mb-6">
                  <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
                    Active Section
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {activeSectionConfig.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-text-secondary">
                    {activeSectionConfig.description}
                  </p>
                </div>

                <div className="grid gap-5">
                  {activeSectionConfig.fields.map((field) => {
                    const value = fieldValueToInput(
                      activeSectionData[field.key],
                      field.type,
                    )

                    if (field.type === 'textarea' || field.type === 'list') {
                      return (
                        <label key={field.key} className="block">
                          <span className="mb-2 block text-sm text-text-secondary">
                            {field.label}
                          </span>
                          <textarea
                            rows={field.type === 'list' ? 5 : 4}
                            value={value}
                            onChange={(event) =>
                              updateField(
                                activeSection,
                                field.key,
                                event.target.value,
                                field.type,
                              )
                            }
                            placeholder={
                              field.type === 'list'
                                ? 'Enter one item per line'
                                : field.placeholder
                            }
                            className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                          />
                        </label>
                      )
                    }

                    if (field.type === 'boolean') {
                      return (
                        <label key={field.key} className="block">
                          <span className="mb-2 block text-sm text-text-secondary">
                            {field.label}
                          </span>
                          <select
                            value={value}
                            onChange={(event) =>
                              updateField(
                                activeSection,
                                field.key,
                                event.target.value,
                                field.type,
                              )
                            }
                            className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                          >
                            <option value="unknown">Unknown</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </label>
                      )
                    }

                    return (
                      <label key={field.key} className="block">
                        <span className="mb-2 block text-sm text-text-secondary">
                          {field.label}
                        </span>
                        <input
                          value={value}
                          onChange={(event) =>
                            updateField(
                              activeSection,
                              field.key,
                              event.target.value,
                              field.type,
                            )
                          }
                          className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] px-4 py-3 text-white outline-none focus:border-accent-solid"
                        />
                      </label>
                    )
                  })}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.07)] pt-6">
                  <div className="space-y-1">
                    {message ? (
                      <p className="text-sm text-status-success">{message}</p>
                    ) : null}
                    {error ? <p className="text-sm text-status-error">{error}</p> : null}
                    <p className="text-xs text-text-muted">
                      Each section saves independently and updates completion status.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveSection(activeSection)}
                    disabled={isPending}
                    className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isPending ? 'Saving...' : 'Save Section'}
                  </button>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
