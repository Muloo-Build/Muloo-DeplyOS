"use client";

import { useEffect, useState } from "react";

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
  role: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyDraft = {
  name: "",
  email: "",
  password: "",
  role: "",
  isActive: true,
  sortOrder: "999"
};

export default function WorkspaceUsersSettings() {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to load workspace users");
        }
        const body = await response.json();
        setUsers(body.users ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load workspace users"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, []);

  function updateUser(
    userId: string,
    field: keyof WorkspaceUser,
    value: string | boolean | number
  ) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, [field]: value } : user
      )
    );
  }

  async function saveUser(userId: string) {
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) return;

    setSaving(userId);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...user,
          ...(passwordDrafts[userId]?.trim()
            ? { password: passwordDrafts[userId] }
            : {})
        })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to save workspace user");
      }
      setUsers((current) =>
        current.map((candidate) =>
          candidate.id === userId ? body.user : candidate
        )
      );
      setPasswordDrafts((currentDrafts) => ({
        ...currentDrafts,
        [userId]: ""
      }));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save workspace user"
      );
    } finally {
      setSaving(null);
    }
  }

  async function createUser() {
    setSaving("new");
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          role: draft.role,
          isActive: draft.isActive,
          sortOrder: Number(draft.sortOrder)
        })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create workspace user");
      }
      setUsers((current) =>
        [...current, body.user].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
      setDraft(emptyDraft);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create workspace user"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-[rgba(224,80,96,0.4)] bg-[rgba(58,21,32,0.7)] px-4 py-3 text-sm text-white">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4">
        <p className="text-sm font-semibold text-white">Add team member</p>
        <p className="mt-2 text-sm text-text-secondary">
          Set a password here when you want a Muloo user to be able to sign in
          directly, including agent-specific operator accounts.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Name"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
          />
          <input
            value={draft.email}
            onChange={(event) =>
              setDraft((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="Email"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
          />
          <input
            type="password"
            value={draft.password}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                password: event.target.value
              }))
            }
            placeholder="Password"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
          />
          <input
            value={draft.role}
            onChange={(event) =>
              setDraft((current) => ({ ...current, role: event.target.value }))
            }
            placeholder="Role"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
          />
          <input
            value={draft.sortOrder}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sortOrder: event.target.value
              }))
            }
            placeholder="Sort order"
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void createUser()}
            disabled={saving === "new"}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
          >
            {saving === "new" ? "Adding..." : "Add user"}
          </button>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Use at least 8 characters when you set a password. Leave it blank if
          you only want the profile created for now.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4 text-sm text-text-secondary">
          Loading team...
        </div>
      ) : (
        users.map((user) => (
          <div
            key={user.id}
            className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span>
                {user.hasPassword ? "Password set" : "No password set yet"}
              </span>
              {user.isActive ? <span>Active</span> : <span>Inactive</span>}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1.1fr_1fr_180px_140px_140px]">
              <input
                value={user.name}
                onChange={(event) =>
                  updateUser(user.id, "name", event.target.value)
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
              />
              <input
                value={user.email}
                onChange={(event) =>
                  updateUser(user.id, "email", event.target.value)
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
              />
              <input
                value={user.role}
                onChange={(event) =>
                  updateUser(user.id, "role", event.target.value)
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
              />
              <input
                type="password"
                value={passwordDrafts[user.id] ?? ""}
                onChange={(event) =>
                  setPasswordDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [user.id]: event.target.value
                  }))
                }
                placeholder={
                  user.hasPassword
                    ? "Leave blank to keep password"
                    : "Set password"
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
              />
              <input
                type="number"
                value={user.sortOrder}
                onChange={(event) =>
                  updateUser(user.id, "sortOrder", Number(event.target.value))
                }
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => void saveUser(user.id)}
                disabled={saving === user.id}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-background-card px-4 py-3 text-sm font-medium text-white"
              >
                {saving === user.id ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
