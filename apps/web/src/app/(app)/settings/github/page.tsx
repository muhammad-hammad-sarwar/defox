import { Suspense } from "react";

import { GitHubSettings } from "@/components/github-settings";
import { Spinner } from "@/components/ui";

export default function GitHubSettingsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading GitHub settings" />}>
      <GitHubSettings />
    </Suspense>
  );
}
