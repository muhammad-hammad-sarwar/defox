import type { SessionResponse } from "@defox/shared";

import { apiFetch } from "./api-client";

export function createSession(input: {
  repositoryIds: string[];
  title?: string;
}): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSessions(): Promise<SessionResponse[]> {
  return apiFetch<SessionResponse[]>("/api/sessions");
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}
