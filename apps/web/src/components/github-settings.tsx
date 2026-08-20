"use client";

import type { GitHubConnectionDto, RepositorySelection } from "@defox/shared";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "@/lib/api-client";
import {
  disconnectGitHub,
  getConnection,
  messageForCode,
  updateRepositoryAccess,
} from "@/lib/github";
import { RepositoryPicker } from "./repository-picker";
import { Alert, Badge, Button, Card, Spinner } from "./ui";

export function GitHubSettings() {
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("github");
  const callbackReason = searchParams.get("reason");

  const [connection, setConnection] = useState<GitHubConnectionDto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<RepositorySelection>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConnection();
      console.log(data);
      setConnection(data);
      setMode(data.repositorySelection ?? "all");
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not load your GitHub connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeMode(next: RepositorySelection) {
    if (next === mode) return;
    setMode(next);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (next === "all") {
        await updateRepositoryAccess({ mode: "all" });
        setNotice("All repositories are now available to Defox Cloud.");
      } else {
        // Switching to "selected" keeps the current per-repository choices;
        // the picker below writes the final list.
        await updateRepositoryAccess({ mode: "selected" });
        setNotice("Choose the repositories Defox Cloud may use.");
      }
      await load();
    } catch (cause) {
      setMode(mode);
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not update repository access.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDisconnect() {
    if (
      !window.confirm("Disconnect GitHub? Repository metadata will be removed.")
    )
      return;
    setSaving(true);
    try {
      await disconnectGitHub();
      setNotice("GitHub disconnected.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? messageForCode(cause.code, cause.message)
          : "Could not disconnect GitHub.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">GitHub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Defox Cloud uses a GitHub App. Credentials stay on the backend and are
          generated on demand.
        </p>
      </header>

      {callbackStatus === "connected" && (
        <Alert tone="success">GitHub connected successfully.</Alert>
      )}
      {callbackStatus === "pending" && (
        <Alert tone="info">
          Installation requested. An organization owner has to approve it before
          repositories appear here.
        </Alert>
      )}
      {callbackStatus === "error" && (
        <Alert tone="error">
          {messageForCode(
            callbackReason ?? "",
            "GitHub connection failed. Please try again.",
          )}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {loading ? (
        <Spinner label="Loading GitHub connection" />
      ) : !connection?.connected || !connection.installation ? (
        <Card>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-600" />
            <span className="text-sm text-slate-300">Not connected</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Install the GitHub App to pick an account or organization and the
            repositories Defox Cloud may access.
          </p>
          <a
            className="mt-4 inline-flex rounded-md bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-500"
            href="/api/github/install?redirect=/settings/github"
          >
            Connect GitHub
          </a>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-primary-300">
                  <span className="h-2 w-2 rounded-full bg-primary-500" />
                  Connected
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                  Connected account
                </p>
                <p className="text-sm text-slate-100">
                  @{connection.account?.login}{" "}
                  <Badge tone="accent">{connection.account?.type}</Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex rounded-md border border-surface-border bg-surface-raised px-3.5 py-2 text-sm text-slate-200 hover:border-slate-600"
                  href={connection.installation.manageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage on GitHub
                </a>
                <a
                  className="inline-flex rounded-md border border-surface-border bg-surface-raised px-3.5 py-2 text-sm text-slate-200 hover:border-slate-600"
                  href="/api/github/install?redirect=/settings/github"
                >
                  Reconnect GitHub
                </a>
                <Button
                  variant="danger"
                  onClick={onDisconnect}
                  disabled={saving}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-medium text-slate-200">
              Repository access
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              GitHub grants this installation{" "}
              {connection.installation.githubRepositorySelection === "all"
                ? "every repository"
                : "a selected set of repositories"}
              . Choose how much of that Defox Cloud may use.
            </p>

            <div className="mt-4 space-y-2">
              {(["all", "selected"] as const).map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-surface-border px-3 py-2 text-sm hover:border-slate-600"
                >
                  <input
                    type="radio"
                    name="repository-access"
                    className="accent-emerald-500"
                    checked={mode === option}
                    disabled={saving}
                    onChange={() => void changeMode(option)}
                  />
                  <span>
                    {option === "all"
                      ? "All repositories"
                      : "Only selected repositories"}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <RepositoryPicker
            mode={mode}
            onSaved={(message) => {
              setNotice(message);
              void load();
            }}
          />
        </>
      )}
    </div>
  );
}
