export interface ClientQuestionDefinition {
  key: string;
  label: string;
  hint: string;
}

export const clientSessionDefinitions: Record<
  number,
  {
    title: string;
    description: string;
    questions: ClientQuestionDefinition[];
  }
> = {
  1: {
    title: "Business & Goals",
    description:
      "Help Muloo understand the business, why this project matters, and what success should look like.",
    questions: [
      {
        key: "business_overview",
        label: "Tell us about your business",
        hint: "What the business does, key services, and who you serve."
      },
      {
        key: "primary_pain_challenge",
        label: "What is the biggest challenge driving this project?",
        hint: "What is not working well enough today?"
      },
      {
        key: "goals_and_success_metrics",
        label: "What outcomes would make this project a success?",
        hint: "Think in terms of business results, team improvements, or customer outcomes."
      },
      {
        key: "key_stakeholders",
        label: "Who should be involved in decisions and delivery?",
        hint: "List the people, teams, or roles that matter."
      },
      {
        key: "timeline_and_constraints",
        label: "Are there key timing or business constraints?",
        hint: "Important deadlines, events, campaigns, resourcing, or dependencies."
      }
    ]
  },
  2: {
    title: "Current State",
    description:
      "Describe the systems, tools, data, and workflows you use today so discovery starts from reality.",
    questions: [
      {
        key: "current_tech_stack",
        label: "What tools and platforms do you use today?",
        hint: "CRM, email, forms, reporting, finance, website, or any other important tools."
      },
      {
        key: "current_hubspot_state",
        label: "What is your current HubSpot situation?",
        hint: "If you already use HubSpot, what is in place and what feels incomplete or broken?"
      },
      {
        key: "data_landscape",
        label: "Where does your key data live today?",
        hint: "Spreadsheets, legacy CRM, email lists, finance systems, or other sources."
      },
      {
        key: "current_processes",
        label: "How do your teams currently work?",
        hint: "Describe the current sales, marketing, service, or operational process."
      },
      {
        key: "what_has_been_tried_before",
        label: "What has already been tried?",
        hint: "Previous systems, projects, fixes, or workarounds."
      }
    ]
  },
  3: {
    title: "Future State Design",
    description:
      "Describe what you want the future way of working to look like so Muloo can shape the recommendation properly.",
    questions: [
      {
        key: "hubs_and_features_required",
        label: "Which hubs or capabilities matter most?",
        hint: "Sales, marketing, service, content, operations, automation, reporting, and so on."
      },
      {
        key: "pipeline_and_process_design",
        label: "How should the future process work?",
        hint: "What should happen from first enquiry through to delivery, renewal, or support?"
      },
      {
        key: "automation_requirements",
        label: "What should be automated?",
        hint: "Routing, notifications, qualification, reminders, handoffs, or customer journeys."
      },
      {
        key: "integration_requirements",
        label: "What other systems need to connect?",
        hint: "Finance, events, website, support, surveys, forms, or any other critical tools."
      },
      {
        key: "reporting_requirements",
        label: "What reporting or visibility is needed?",
        hint: "Dashboards, KPIs, board reporting, pipeline visibility, attribution, or service performance."
      }
    ]
  },
  4: {
    title: "Scope & Handover",
    description:
      "Help Muloo understand what should be prioritised, what is out of scope for now, and what the client team needs to provide.",
    questions: [
      {
        key: "confirmed_scope",
        label: "What do you see as the priority scope for this work?",
        hint: "The pieces that matter most to get right first."
      },
      {
        key: "out_of_scope",
        label: "What should not be part of this phase?",
        hint: "Anything that should be excluded, deferred, or treated separately."
      },
      {
        key: "risks_and_blockers",
        label: "What could delay or complicate delivery?",
        hint: "Access, data, resourcing, change resistance, approvals, or technical unknowns."
      },
      {
        key: "client_responsibilities",
        label: "What can your team provide or own?",
        hint: "Data, access, decisions, approvals, subject matter expertise, or internal project ownership."
      },
      {
        key: "agreed_next_steps",
        label: "What should happen next after discovery?",
        hint: "Actions, owners, and what you expect to receive back from Muloo."
      }
    ]
  }
};
