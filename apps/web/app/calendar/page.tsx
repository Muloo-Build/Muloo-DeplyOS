"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ExternalLink, RefreshCw } from "lucide-react";

import AppShell from "../components/AppShell";
import { Btn } from "../components/ui/Btn";
import { Empty } from "../components/ui/Empty";
import { PageHead } from "../components/ui/PageHead";
import { Panel, PanelBody, PanelHead } from "../components/ui/Panel";

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  hangoutLink?: string;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(iso?: string, allDay?: string): string {
  if (allDay) return "All day";
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/workspace/calendar/events").then((r) =>
        r.ok ? r.json() : null
      );
      setConnected(Boolean(r?.connected));
      setEvents(Array.isArray(r?.events) ? (r.events as CalendarEvent[]) : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const week = useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dayKey = day.toDateString();
      const dayEvents = events.filter((e) => {
        const iso = e.start?.dateTime ?? e.start?.date;
        if (!iso) return false;
        return new Date(iso).toDateString() === dayKey;
      });
      return { date: day, events: dayEvents };
    });
  }, [events]);

  return (
    <AppShell>
      <div className="px-8 pt-6 pb-16 max-w-[1480px] w-full">
        <PageHead
          eyebrow="Schedule"
          title="Calendar"
          lede="Connected Google Calendar feed used by Today and project meetings. Week view of all upcoming events."
          actions={
            <Btn
              variant="ghost"
              size="md"
              onClick={() => void loadAll()}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Btn>
          }
        />

        {!connected && !loading ? (
          <Empty
            icon={<CalendarIcon size={20} />}
            title="Calendar not connected"
            sub="Connect Google Calendar in Workspace settings to see your week."
            action={
              <a href="/settings/workspace#calendar">
                <Btn variant="ghost" size="sm">
                  <ExternalLink size={12} />
                  Open workspace settings
                </Btn>
              </a>
            }
          />
        ) : loading ? (
          <Empty title="Loading week…" sub="One moment." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {week.map((day, i) => {
              const isToday =
                day.date.toDateString() === new Date().toDateString();
              return (
                <Panel key={day.date.toISOString()} className="min-h-[240px]">
                  <PanelHead
                    title={
                      <div className="flex flex-col">
                        <span className="text-[10px] tracking-[0.14em] uppercase text-text-3 font-semibold">
                          {dayLabels[i]}
                        </span>
                        <span
                          className={`text-[16px] font-semibold ${
                            isToday ? "text-status-ok" : "text-text-1"
                          }`}
                        >
                          {day.date.getDate()}
                        </span>
                      </div>
                    }
                  />
                  <PanelBody className="flex flex-col gap-2">
                    {day.events.length === 0 ? (
                      <span className="text-text-3 text-[12px]">—</span>
                    ) : (
                      day.events.map((e) => (
                        <div
                          key={e.id}
                          className="border-l-2 border-status-ok pl-2.5 py-1"
                        >
                          <div className="font-mono text-[11px] text-status-ok">
                            {fmtTime(e.start?.dateTime, e.start?.date)}
                          </div>
                          <div className="text-[12.5px] font-medium truncate">
                            {e.summary}
                          </div>
                          {e.attendees && e.attendees.length > 0 && (
                            <div className="text-[11px] text-text-3 truncate">
                              {e.attendees
                                .slice(0, 2)
                                .map((a) => a.displayName ?? a.email)
                                .join(", ")}
                              {e.attendees.length > 2 ? ` +${e.attendees.length - 2}` : ""}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
