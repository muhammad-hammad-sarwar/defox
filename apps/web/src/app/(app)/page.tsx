import Link from "next/link";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/server-api";

export default async function OverviewPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">Defox Cloud</h1>
        <p className="mt-1 text-sm text-slate-400">
          Signed in as {user?.email}
        </p>
      </header>

      <Card>
        <h2 className="text-sm font-medium text-slate-200">Get started</h2>
        <p className="mt-1 text-sm text-slate-400">
          Connect GitHub to choose the repositories this platform may use.
          Coding sessions and sandboxes arrive in a later milestone.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/settings/github"
            className="rounded-md bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            GitHub settings
          </Link>
          <Link
            href="/repositories"
            className="rounded-md border border-surface-border px-3.5 py-2 text-sm text-slate-200 hover:border-slate-600"
          >
            Repositories
          </Link>
        </div>
      </Card>
    </div>
  );
}
