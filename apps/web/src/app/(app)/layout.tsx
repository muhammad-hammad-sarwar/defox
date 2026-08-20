import { redirect } from "next/navigation";

import { Sidebar } from "@/components/sidebar";
import { getCurrentUser } from "@/lib/server-api";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen gap-4 bg-surface p-4">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-surface-border bg-surface-raised px-8 py-8 scrollbar-thin">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
