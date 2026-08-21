import type { SessionResponse } from "@defox/shared";

import { apiFetch } from "./api-client";
import axios from "axios";

export async function createSession(input: {
  repositoryIds: string[];
  title?: string;
}): Promise<SessionResponse> {
  const response = await axios.post(
    "http://localhost:4000/api/sessions",
    input,
    { withCredentials: true },
  );

  return response.data?.data;
}

export async function listSessions(): Promise<SessionResponse[]> {
  const response = await axios.get("http://localhost:4000/api/sessions", {
    withCredentials: true,
  });
  return response.data?.data;
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const response = await axios.get(
    `http://localhost:4000/api/sessions/${sessionId}`,
    {
      withCredentials: true,
    },
  );
  return response.data?.data;
}
