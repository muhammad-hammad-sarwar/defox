"use client";

import type { GitHubRepositoryDto, RepositorySelection } from "@defox/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiRequestError } from "@/lib/api-client";
import {
  listRepositories,
  messageForCode,
  updateRepositoryAccess,
} from "@/lib/github";
import { Alert, Badge, Button, Card, Spinner } from "./ui";

const PER_PAGE = 30;

export function RepositoryPicker({
  mode,
  onSaved,
}: {
  mode: RepositorySelection;
  onSaved: (message: string) => void;
}) {
  const [repositories, setRepositories] = useState<GitHubRepositoryDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Only the user's explicit changes are submitted, so repositories on pages
  // that were never loaded keep whatever the server already stores.
  const pendingSelect = useRef(new Set<string>());
  const pendingDeselect = useRef(new Set<string>());
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectedOnPage = repositories.filter((repository) =>
    selected.has(repository.githubRepositoryId),
  ).length;

  function deselectAllOnPage() {
    setSelected((current) => {
      const next = new Set(current);

      for (const repository of repositories) {
        next.delete(repository.githubRepositoryId);

        pendingSelect.current.delete(repository.githubRepositoryId);
        pendingDeselect.current.add(repository.githubRepositoryId);
      }

      return next;
    });

    setDirty(true);
  }

  const allCurrentPageSelected =
    repositories.length > 0 && selectedOnPage === repositories.length;

  const someCurrentPageSelected = selectedOnPage > 0 && !allCurrentPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentPageSelected;
    }
  }, [someCurrentPageSelected]);

  const load = useCallback(
    async (options: { refresh?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listRepositories({
          page,
          perPage: PER_PAGE,
          ...(search ? { search } : {}),
          ...(options.refresh ? { refresh: true } : {}),
        });
        setRepositories(result.items);
        setTotalPages(result.totalPages);
        setTotal(result.total);
        setSelected((current) => {
          const next = new Set(current);
          for (const repository of result.items) {
            const id = repository.githubRepositoryId;
            // Unsaved local changes win over the server state.
            if (pendingSelect.current.has(id)) next.add(id);
            else if (pendingDeselect.current.has(id)) next.delete(id);
            else if (repository.selected) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      } catch (cause) {
        setError(
          cause instanceof ApiRequestError
            ? messageForCode(cause.code, cause.message)
            : "Could not load repositories.",
        );
      } finally {
        setLoading(false);
      }
    },
    [page, search],
  );

  function selectAllOnPage() {
    setSelected((current) => {
      const next = new Set(current);

      for (const repository of repositories) {
        next.add(repository.githubRepositoryId);

        pendingSelect.current.add(repository.githubRepositoryId);
        pendingDeselect.current.delete(repository.githubRepositoryId);
      }

      return next;
    });

    setDirty(true);
  }

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(repositoryId: string) {
    const enabling = !selected.has(repositoryId);
    setSelected((current) => {
      const next = new Set(current);
      if (enabling) next.add(repositoryId);
      else next.delete(repositoryId);
      return next;
    });
    if (enabling) {
      pendingSelect.current.add(repositoryId);
      pendingDeselect.current.delete(repositoryId);
    } else {
      pendingSelect.current.delete(repositoryId);
      pendingDeselect.current.add(repositoryId);
    }
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateRepositoryAccess({
        mode: "selected",
        select: [...pendingSelect.current],
        deselect: [...pendingDeselect.current],
      });
      pendingSelect.current.clear();
      pendingDeselect.current.clear();
      setDirty(false);
      onSaved(
        `Saved ${result.selectedRepositoryIds?.length} selected repositories.`,
      );
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not save your selection.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Repositories</h2>
          <p className="text-xs text-slate-500">
            {total} available through your GitHub installation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => void load({ refresh: true })}
            disabled={loading}
          >
            Refresh from GitHub
          </Button>

          {mode === "selected" && (
            <Button
              onClick={() => void save()}
              disabled={saving || loading || !dirty}
            >
              {saving ? "Saving…" : "Save selection"}
            </Button>
          )}
        </div>
      </div>

      <input
        value={search}
        onChange={(event) => {
          setPage(1);
          setSearch(event.target.value);
        }}
        placeholder="Search repositories..."
        className="mt-4 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent-600 focus:outline-none"
      />

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {mode === "all" && (
        <p className="mt-3 text-xs text-accent-300">
          All repositories are enabled. Switch to “Only selected repositories”
          to choose individually.
        </p>
      )}

      <div className="mt-4">
        {/* Select and Deselect All */}
        <div className="mb-2 flex items-center gap-3 border-b border-surface-border px-1 pb-2">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allCurrentPageSelected}
            onChange={() => {
              if (allCurrentPageSelected) {
                deselectAllOnPage();
              } else {
                selectAllOnPage();
              }
            }}
            disabled={loading || saving || repositories.length === 0}
            className="h-4 w-4 cursor-pointer rounded border-surface-border bg-surface accent-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <span
            className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200"
            onClick={() => {
              if (allCurrentPageSelected) {
                deselectAllOnPage();
              } else {
                selectAllOnPage();
              }
            }}
          >
            {allCurrentPageSelected ? "Deselect all" : "Select all"}
          </span>
        </div>

        {loading ? (
          <Spinner label="Loading repositories" />
        ) : repositories.length === 0 ? (
          <p className="text-sm text-slate-500">
            {search
              ? "No repositories match your search."
              : "No repositories are available through this installation yet."}
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {repositories.map((repository) => (
              <li
                key={repository.githubRepositoryId}
                className="flex items-center gap-3 py-2"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-surface-border bg-surface accent-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={mode === "all"}
                  checked={
                    mode === "all" ||
                    selected.has(repository.githubRepositoryId)
                  }
                  onChange={() => toggle(repository.githubRepositoryId)}
                />
                <span className="flex-1 truncate text-sm text-slate-200">
                  {repository.fullName}
                </span>
                {repository.private && <Badge>Private</Badge>}
                <Badge tone="neutral">{repository.defaultBranch}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <Button
            variant="ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
