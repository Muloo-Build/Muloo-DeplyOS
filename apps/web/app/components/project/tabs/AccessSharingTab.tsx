"use client";

import type { ReactNode } from "react";

export default function AccessSharingTab(props: {
  championCard: ReactNode;
  contributorsPanel: ReactNode;
  resourcesPanel: ReactNode;
  hubspotPanel: ReactNode;
  // Slice 6 (new plan): the workbook sharing summary used to live
  // in its own section here. The unified resources panel now owns
  // both the resources list AND the workbook sharing summary, so
  // this slot is optional — pass null to hide the legacy section.
  workbookSharingSummary?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="brand-surface-soft rounded-[14px] border border-ink-4 p-4">
        <p className="text-sm font-semibold text-white">Access &amp; Sharing</p>
        <p className="mt-1 text-xs leading-relaxed text-text-2">
          One place to control who can see this project. Configure the client
          champion, invite contributors who need to fill in workbooks, manage
          shared Miro boards and documents, and handle HubSpot access — both
          the partner invite for the client and the internal Deploy OS
          connection.
        </p>
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-white">Client champion</h3>
          <p className="mt-1 text-xs text-text-2">
            The single person on the client side responsible for reviewing and
            approving project work.
          </p>
        </header>
        {props.championCard}
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-white">
            External contributors
          </h3>
          <p className="mt-1 text-xs text-text-2">
            People you need input from who do not need a full client portal
            account. Assign them workbooks below.
          </p>
        </header>
        {props.contributorsPanel}
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-white">HubSpot access</h3>
          <p className="mt-1 text-xs text-text-2">
            Two separate actions: the client invites Muloo as a partner/admin
            into their HubSpot portal, and Muloo separately connects that
            portal to Deploy OS for audits and tracking.
          </p>
        </header>
        {props.hubspotPanel}
      </section>

      <section className="brand-surface rounded-[14px] border p-6">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-white">
            Project resources
          </h3>
          <p className="mt-1 text-xs text-text-2">
            Workbook sharing status, Miro boards, Google Docs/Sheets, PDFs,
            and synthesized discovery briefs — all in one place. Visibility
            decides who sees each item.
          </p>
        </header>
        {props.resourcesPanel}
      </section>

      {props.workbookSharingSummary ? (
        <section className="brand-surface rounded-[14px] border p-6">
          <header className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              Workbook sharing
            </h3>
            <p className="mt-1 text-xs text-text-2">
              Quick view of how each workbook is shared. Edit details on the
              Discovery tab.
            </p>
          </header>
          {props.workbookSharingSummary}
        </section>
      ) : null}
    </div>
  );
}
