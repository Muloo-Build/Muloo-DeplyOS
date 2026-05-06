"use client";

import Link from "next/link";
import { useState } from "react";

interface CompanyRow {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  numberOfEmployees: string | null;
  alreadyImported: boolean;
  importedClientId: string | null;
}

interface ContactRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
}

interface DealRow {
  id: string;
  name: string | null;
  stage: string | null;
  amount: string | null;
  closeDate: string | null;
}

interface ImportResult {
  clientId: string;
  clientName: string;
  clientSlug: string;
  contactCount: number;
  dealCount: number;
  reused: boolean;
}

export default function HubSpotImportWorkspace() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [paging, setPaging] = useState<{ after: string | null }>({
    after: null
  });
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selected, setSelected] = useState<CompanyRow | null>(null);
  const [related, setRelated] = useState<{
    contacts: ContactRow[];
    deals: DealRow[];
  } | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includeDeals, setIncludeDeals] = useState(false);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  async function runSearch(after?: string) {
    setSearching(true);
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (after) params.set("after", after);
      const res = await fetch(
        `/api/integrations/hubspot/companies?${params.toString()}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Search failed");
      if (after) {
        setCompanies((current) => [...current, ...body.companies]);
      } else {
        setCompanies(body.companies);
      }
      setPaging(body.paging);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function selectCompany(company: CompanyRow) {
    setSelected(company);
    setRelated(null);
    setLastImport(null);
    setLoadingRelated(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/hubspot/companies/${encodeURIComponent(
          company.id
        )}/related?includeContacts=true&includeDeals=true`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load related");
      setRelated({ contacts: body.contacts, deals: body.deals });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Failed to load related"
      );
    } finally {
      setLoadingRelated(false);
    }
  }

  async function runImport() {
    if (!selected) return;
    setImporting(true);
    setError(null);
    setInfo(null);
    setLastImport(null);
    try {
      const res = await fetch("/api/integrations/hubspot/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selected.id,
          includeContacts,
          includeDeals
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Import failed");
      setLastImport(body);
      setCompanies((current) =>
        current.map((row) =>
          row.id === selected.id
            ? { ...row, alreadyImported: true, importedClientId: body.clientId }
            : row
        )
      );
      setInfo(
        body.reused
          ? `Linked existing client. ${body.contactCount} contact(s) synced.`
          : `Imported as ${body.clientName}. ${body.contactCount} contact(s), ${body.dealCount} deal(s).`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-xl border border-[rgba(73,255,143,0.3)] bg-[rgba(20,46,32,0.5)] px-4 py-3 text-sm text-[#9ef0bd]">
          {info}
          {lastImport ? (
            <>
              {" "}
              <Link
                href={`/clients/${lastImport.clientSlug || lastImport.clientId}`}
                className="underline"
              >
                Open client →
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[260px]">
            <span className="text-sm font-medium text-white">
              Search HubSpot companies
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or domain"
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              className="mt-3 w-full rounded-[14px] border border-ink-4 bg-ink-2 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching}
            className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-3">
            Results
          </h3>
          <div className="mt-4 space-y-2">
            {companies.length === 0 && !searching ? (
              <p className="text-sm text-text-3">
                Run a search to see companies.
              </p>
            ) : null}
            {companies.map((company) => {
              const isActive = selected?.id === company.id;
              return (
                <button
                  type="button"
                  key={company.id}
                  onClick={() => void selectCompany(company)}
                  className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-[rgba(255,255,255,0.25)] bg-ink-3"
                      : "border-ink-4 bg-ink-2 hover:bg-ink-3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {company.name ?? "Untitled company"}
                      </p>
                      <p className="text-xs text-text-3">
                        {[company.domain, company.industry, company.country]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    {company.alreadyImported ? (
                      <span className="rounded-full bg-[rgba(73,255,143,0.12)] px-2 py-0.5 text-[11px] font-medium text-[#7af0a8]">
                        Imported
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {paging.after ? (
            <button
              type="button"
              onClick={() => void runSearch(paging.after ?? undefined)}
              disabled={searching}
              className="mt-4 rounded-xl border border-ink-5 px-3 py-2 text-xs text-white"
            >
              Load more
            </button>
          ) : null}
        </section>

        <section className="rounded-[14px] border border-ink-4 bg-ink-1 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-3">
            Preview + import
          </h3>
          {!selected ? (
            <p className="mt-4 text-sm text-text-3">
              Select a company on the left to preview related records.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  {selected.name ?? "Untitled company"}
                </p>
                <p className="text-xs text-text-3">
                  {[selected.domain, selected.industry, selected.country]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>

              {loadingRelated ? (
                <p className="text-sm text-text-3">Loading related...</p>
              ) : related ? (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                      Contacts ({related.contacts.length})
                    </p>
                    <ul className="mt-2 space-y-1">
                      {related.contacts.slice(0, 8).map((c) => (
                        <li key={c.id} className="text-sm text-white">
                          {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                            c.email ||
                            "Unnamed contact"}
                          {c.email ? (
                            <span className="text-xs text-text-3">
                              {" "}
                              · {c.email}
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {related.contacts.length > 8 ? (
                        <li className="text-xs text-text-3">
                          + {related.contacts.length - 8} more
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-text-3">
                      Deals ({related.deals.length})
                    </p>
                    <ul className="mt-2 space-y-1">
                      {related.deals.slice(0, 8).map((d) => (
                        <li key={d.id} className="text-sm text-white">
                          {d.name ?? "Untitled deal"}
                          {d.amount ? (
                            <span className="text-xs text-text-3">
                              {" "}
                              · {d.amount}
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {related.deals.length === 0 ? (
                        <li className="text-xs text-text-3">No deals.</li>
                      ) : null}
                    </ul>
                  </div>
                </>
              ) : null}

              <div className="space-y-2 rounded-xl border border-ink-4 bg-ink-2 p-4">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={includeContacts}
                    onChange={(e) => setIncludeContacts(e.target.checked)}
                  />
                  Import related contacts as ClientContact
                </label>
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={includeDeals}
                    onChange={(e) => setIncludeDeals(e.target.checked)}
                  />
                  Note related deals (count only — does not create projects)
                </label>
              </div>

              <button
                type="button"
                onClick={() => void runImport()}
                disabled={importing || selected.alreadyImported}
                className="rounded-xl bg-[linear-gradient(135deg,#7c5cbf_0%,#e0529c_55%,#f0824a_100%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selected.alreadyImported
                  ? "Already imported"
                  : importing
                    ? "Importing..."
                    : "Import as Client"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
