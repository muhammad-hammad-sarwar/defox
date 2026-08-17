"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLACEHOLDER_SESSIONS = [
  "Fix authentication",
  "Add product API",
  "Refactor dashboard",
];

const NAV_ITEMS = [
  { href: "/repositories", label: "Repositories" },
  { href: "/settings/github", label: "GitHub" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 border-r border-surface-border bg-surface-raised px-4 py-5">
      <div className="text-sm font-semibold tracking-wide text-primary-400">Cloud Agent</div>

      <Link
        href="/sessions"
        className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-500"
      >
        + New Session
      </Link>

      <div>
        <p className="px-1 text-xs uppercase tracking-wide text-slate-500">Sessions</p>
        <ul className="mt-2 space-y-1">
          {PLACEHOLDER_SESSIONS.map((session) => (
            <li
              key={session}
              className="cursor-not-allowed truncate rounded px-2 py-1.5 text-sm text-slate-500"
              title="Coding sessions are not implemented yet"
            >
              {session}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-surface-border pt-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </aside>
  );
}
