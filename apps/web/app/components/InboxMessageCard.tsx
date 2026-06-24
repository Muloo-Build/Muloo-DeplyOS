interface InboxMessageCardProps {
  message: {
    id: string;
    senderName: string;
    body: string;
    createdAt: string;
    project: { name: string };
  };
}

export default function InboxMessageCard({ message }: InboxMessageCardProps) {
  return (
    <div
      key={message.id}
      className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0b1126] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
            {message.project.name}
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            {message.senderName}
          </p>
        </div>
        <span className="text-xs text-text-muted">
          {new Date(message.createdAt).toLocaleString("en-ZA")}
        </span>
      </div>
      <p className="mt-3 text-sm text-text-secondary">{message.body}</p>
    </div>
  );
}
