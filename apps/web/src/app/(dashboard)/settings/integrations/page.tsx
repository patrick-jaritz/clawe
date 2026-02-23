"use client";

export const dynamic = "force-dynamic";

import { useIntegrations } from "@/lib/api/local";
import { PageHeader, PageHeaderRow, PageHeaderTitle, PageHeaderActions } from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { RefreshCw } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI Providers",
  messaging: "Messaging",
  dev: "Development",
  productivity: "Productivity",
  search: "Search",
  network: "Network",
};

export default function IntegrationsPage() {
  const { data, isLoading, mutate } = useIntegrations();

  const grouped = Object.entries(CATEGORY_LABELS).map(([ id, label]) => ({
    id,
    label,
    items: (data?.integrations ?? []).filter(i => i.category === id),
  })).filter(g => g.items.length > 0);

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Integrations</PageHeaderTitle>
          <PageHeaderActions>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      <p className="text-muted-foreground text-sm mb-6">
        Live status of all connected tools and services. Status is derived from credentials in
        <code className="font-mono mx-1 text-xs bg-muted px-1 rounded">~/.openclaw/openclaw.json</code>
        and system checks.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <section key={group.id}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{group.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map(integration => (
                  <Card key={integration.id} className={`border transition-colors ${integration.status === "connected" ? "border-emerald-200 dark:border-emerald-900" : "border-border opacity-60"}`}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="text-lg">{integration.icon}</span>
                          {integration.name}
                        </CardTitle>
                        <Badge
                          className={`text-xs ${
                            integration.status === "connected"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : integration.status === "unknown"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                          variant="secondary"
                        >
                          {integration.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 pt-0 px-4">
                      <p className="text-xs text-muted-foreground font-mono">{integration.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
