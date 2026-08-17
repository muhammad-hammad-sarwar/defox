import type { ApiResponse, AuthUserDto } from "@defox/shared";
import { cookies } from "next/headers";

const apiUrl = process.env.API_URL ?? "http://localhost:4000";

/** Server-side call to the Express backend, forwarding the session cookie. */
export async function serverApiFetch<TData>(path: string): Promise<TData | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const response = await fetch(`${apiUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as ApiResponse<TData> | null;
  if (!body || !body.ok) return null;
  return body.data;
}

export async function getCurrentUser(): Promise<AuthUserDto | null> {
  const data = await serverApiFetch<{ user: AuthUserDto }>("/api/auth/me");
  return data?.user ?? null;
}
