"use client";

import { useEffect, useState } from "react";

import { SessionStatus } from "@/components/sessions/session-status";
import { Spinner } from "@/components/ui";
import { ApiRequestError } from "@/lib/api-client";
import { getSession } from "@/lib/sessions";

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const [session, setSession] = useState<Awaited<
    ReturnType<typeof getSession>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params
      .then(({ sessionId }) => getSession(sessionId))
      .then(setSession)
      .catch((cause: unknown) =>
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : "Could not load this session.",
        ),
      );
  }, [params]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!session) return <Spinner label="Loading session" />;
  return <SessionStatus session={session} />;
}
