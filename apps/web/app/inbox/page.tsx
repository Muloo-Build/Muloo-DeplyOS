import AppShell from "../components/AppShell";
import InternalInbox from "../components/InternalInbox";

export default function InboxPage() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-text-muted">
            Inbox
          </p>
          <h1 className="mt-3 text-3xl font-bold font-heading text-white">
            Requests and project messages
          </h1>
          <p className="mt-3 max-w-3xl text-text-secondary">
            Keep client intake, quick project messages, and lightweight
            coordination in one place.
          </p>
        </div>

        <InternalInbox />
      </div>
    </AppShell>
  );
}
