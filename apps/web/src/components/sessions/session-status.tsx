import type { SessionResponse } from "@defox/shared";

import { Badge, Card } from "../ui";

export function SessionStatus({ session }: { session: SessionResponse }) {
  const ready = session.status === "ready";
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Session
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100">
              {session.title}
            </h1>
          </div>
          <Badge tone={ready ? "primary" : "neutral"}>
            {session.status[0].toUpperCase() + session.status.slice(1)}
          </Badge>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-slate-200">Repositories</h2>
        <ul className="mt-3 divide-y divide-surface-border">
          {session.repositories.map((repository) => (
            <li
              key={repository.githubRepositoryId}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span className="text-slate-200">{repository.fullName}</span>
              <span className="text-primary-300">
                {ready ? "✓ Ready" : session.status}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-200">Sandbox</h2>
          <span className="text-sm text-primary-300">
            {session.sandbox.status[0].toUpperCase() +
              session.sandbox.status.slice(1)}
          </span>
        </div>
      </Card>
    </div>
  );
}
