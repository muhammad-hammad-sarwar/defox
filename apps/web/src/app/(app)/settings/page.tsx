import Link from "next/link";

import { Card } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
      <Card>
        <Link href="/settings/github" className="text-sm text-accent-400 hover:text-accent-300">
          GitHub integration
        </Link>
        <p className="mt-2 text-sm text-slate-400">
          Other settings will be added alongside future milestones.
        </p>
      </Card>
    </div>
  );
}
