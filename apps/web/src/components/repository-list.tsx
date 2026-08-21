"use client";
import type { GitHubRepositoryDto } from "@defox/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "@/lib/api-client";
import {
  authorizeRepository,
  listRepositories,
  messageForCode,
} from "@/lib/github";
import { Alert, Badge, Button, Card, Spinner } from "./ui";

export function RepositoryList() {
  const [repositories, setRepositories] = useState<GitHubRepositoryDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRepositories({
        perPage: 50,
        selectedOnly: true,
        ...(search ? { search } : {}),
      });
      setRepositories(result.items);
      setNotConnected(false);
    } catch (cause) {
      if (
        cause instanceof ApiRequestError &&
        cause.code === "GITHUB_NOT_CONNECTED"
      ) {
        setNotConnected(true);
      } else {
        setError(
          cause instanceof ApiRequestError
            ? messageForCode(cause.code, cause.message)
            : "Could not load repositories.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * "Start Session" only asks the backend to authorize the repository for the
   * signed-in user. No sandbox is created in this milestone.
   */
  async function startSession(repository: GitHubRepositoryDto) {
    setPendingId(repository.githubRepositoryId);
    setStatus(null);
    setError(null);
    try {
      const result = await authorizeRepository(repository.githubRepositoryId);
      setStatus(
        `${result.repository.fullName} is authorized for this account (default branch ${result.repository.defaultBranch}). Sandboxes arrive in a later milestone.`,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not verify repository access.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Repositories</h1>
        <p className="mt-1 text-sm text-slate-400">
          Repositories enabled for Defox Cloud through your GitHub App
          installation.
        </p>
      </header>

      {status && <Alert tone="success">{status}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {notConnected ? (
        <Card>
          <p className="text-sm text-slate-400">GitHub is not connected yet.</p>
          <Link
            href="/settings/github"
            className="mt-3 inline-flex rounded-md bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            Connect GitHub
          </Link>
        </Card>
      ) : (
        <>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent-600 focus:outline-none"
          />

          {loading ? (
            <Spinner label="Loading repositories" />
          ) : repositories.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">
                No repositories are enabled yet. Choose them in{" "}
                <Link
                  href="/settings/github"
                  className="text-accent-400 hover:text-accent-300"
                >
                  GitHub settings
                </Link>
                .
              </p>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {repositories.map((repository) => (
                <li key={repository.githubRepositoryId}>
                  <Card>
                    <p className="truncate text-sm font-medium text-slate-100">
                      {repository.fullName}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Badge>{repository.private ? "Private" : "Public"}</Badge>
                      <Badge tone="accent">{repository.defaultBranch}</Badge>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <a
                        className="rounded-md border border-surface-border px-3 py-1.5 text-sm text-slate-200 hover:border-slate-600"
                        href={repository.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                      <Button
                        onClick={() => void startSession(repository)}
                        disabled={pendingId === repository.githubRepositoryId}
                      >
                        {pendingId === repository.githubRepositoryId
                          ? "Checking…"
                          : "Start Session"}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
