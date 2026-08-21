"use client";

import { listSessions } from "@/lib/sessions";
import { SessionResponse } from "@defox/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/repositories", label: "Repositories" },
  { href: "/settings/github", label: "GitHub" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionResponse[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (cause) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised">
      <div className="shrink-0 px-4 py-5">
        <div className="text-sm font-semibold tracking-wide text-primary-400">
          Defox Cloud
        </div>

        <Link
          href="/sessions"
          className="mt-5 block rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-500"
        >
          + New Session
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 scrollbar-thin">
        <div>
          <p className="px-1 text-xs uppercase tracking-wide text-slate-500">
            Sessions
          </p>
        </div>
        <div className="mt-3 space-y-1">
          {loading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse rounded-md bg-surface"
                />
              ))}
            </div>
          ) : (
            sessions
              ?.filter((s) => s.status !== "failed")
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className={`block truncate rounded-md px-2.5 py-2 text-sm transition-colors ${
                    pathname === `/sessions/${s.id}`
                      ? "bg-surface text-primary-300"
                      : "text-slate-300 hover:bg-surface hover:text-slate-100"
                  }`}
                >
                  {s.title || "Untitled Session"}
                </Link>
              ))
          )}

          {!loading &&
            sessions?.filter((s) => s.status !== "failed").length === 0 && (
              <p className="px-2 py-2 text-xs text-slate-500">
                No sessions yet
              </p>
            )}
        </div>

        <div className="mt-4 border-t border-surface-border pt-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded px-2 py-1.5 text-sm ${
                      active
                        ? "bg-surface text-primary-300"
                        : "text-slate-300 hover:bg-surface hover:text-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}
