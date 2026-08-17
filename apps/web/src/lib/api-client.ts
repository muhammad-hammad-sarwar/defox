import type { ApiResponse } from "@defox/shared";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Calls the Express backend through the Next.js /api proxy so the session
 * cookie stays same-origin and HTTP-only.
 */
export async function apiFetch<TData>(
  path: string,
  init: RequestInit = {},
): Promise<TData> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    ...init,
  });

  let body: ApiResponse<TData> | null = null;
  try {
    body = (await response.json()) as ApiResponse<TData>;
  } catch {
    body = null;
  }

  if (!body) {
    throw new ApiRequestError(response.status, "INTERNAL_ERROR", "Unexpected server response");
  }
  if (!body.ok) {
    throw new ApiRequestError(response.status, body.error.code, body.error.message);
  }
  return body.data;
}
