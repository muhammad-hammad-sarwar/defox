"use client";

import type { GitHubRepositoryDto } from "@defox/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiRequestError } from "@/lib/api-client";
import { listRepositories, messageForCode } from "@/lib/github";
import { createSession } from "@/lib/sessions";
import { Alert, Button, Card, Spinner } from "../ui";

export function CreateSessionDialog() {
  const [repositories, setRepositories] = useState<GitHubRepositoryDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listRepositories({ perPage: 100, selectedOnly: true })
      .then((result) => setRepositories(result.items))
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiRequestError
            ? messageForCode(cause.code, cause.message)
            : "Could not load repositories.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleRepositories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? repositories.filter((repository) =>
          repository.fullName.toLowerCase().includes(query),
        )
      : repositories;
  }, [repositories, search]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setCreating(true);
    setError(null);
    try {
      const session = await createSession({
        repositoryIds: [...selected],
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      window.location.assign(`/sessions/${session.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not create the coding session.",
      );
      setCreating(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">
          Create Coding Session
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose the repositories to prepare in one isolated sandbox.
        </p>
      </header>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {creating ? (
        <div className="mt-8">
          <Spinner label="Creating sandbox and preparing repositories..." />
        </div>
      ) : (
        <>
          <label className="mt-6 block text-sm text-slate-300">
            Session name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New Coding Session"
              className="mt-2 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent-600 focus:outline-none"
            />
          </label>
          <div className="mt-6">
            <label
              className="text-sm text-slate-300"
              htmlFor="repository-search"
            >
              Select repositories
            </label>
            <input
              id="repository-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search repositories..."
              className="mt-2 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent-600 focus:outline-none"
            />
          </div>
          <div className="mt-4">
            {loading ? (
              <Spinner label="Loading repositories" />
            ) : visibleRepositories.length === 0 ? (
              <p className="text-sm text-slate-500">
                No enabled repositories found. Check GitHub settings.
              </p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {visibleRepositories.map((repository) => (
                  <li
                    key={repository.githubRepositoryId}
                    className="flex items-center gap-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(repository.githubRepositoryId)}
                      onChange={() => toggle(repository.githubRepositoryId)}
                      className="h-4 w-4 accent-primary-500"
                    />
                    <span className="flex-1 text-sm text-slate-200">
                      {repository.fullName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {repository.defaultBranch}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link
              href="/repositories"
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Manage repositories
            </Link>
            <Button
              variant="accent"
              onClick={() => void submit()}
              disabled={loading || selected.size === 0}
            >
              Create Session{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
