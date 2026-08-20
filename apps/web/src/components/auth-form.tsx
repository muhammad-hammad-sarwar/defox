"use client";

import type { AuthUserDto } from "@defox/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiRequestError, apiFetch } from "@/lib/api-client";
import { Alert, Button, Card } from "./ui";

type Mode = "login" | "signup";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<{ user: AuthUserDto }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "signup" ? { email, name, password } : { email, password },
        ),
      });
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Could not sign you in right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent-600 focus:outline-none";

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-lg font-semibold text-slate-100">Defox Cloud</h1>
      <p className="mt-1 text-sm text-slate-400">
        {mode === "login"
          ? "Sign in to continue."
          : "Create an account to get started."}
      </p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        {mode === "signup" && (
          <input
            className={inputClass}
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        )}
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={mode === "signup" ? 8 : 1}
          required
        />

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm text-accent-400 hover:text-accent-300"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
      >
        {mode === "login" ? "Create an account" : "I already have an account"}
      </button>
    </Card>
  );
}
