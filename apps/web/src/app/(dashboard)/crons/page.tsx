"use client";

export const dynamic = "force-dynamic";

import { useCrons } from "@/lib/api/local";
import type { CronJob } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { cn } from "@clawe/ui/lib/utils";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { getCronOwner } from "@/lib/owner";
import { OwnerBadge } from "@/components/owner-badge";
import { mutate } from "swr";
import { Button } from "@clawe/ui/components/button";

const CronsPage = () => {
  const { data, error, isLoading } = useCrons();
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

function formatTs(ts: string | null | undefined): string {
  if (!ts) return "Never";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}

const statusConfig = {
  ok: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    badge: <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">OK</Badge>,
  },
  error: {
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    badge: <Badge variant="destructive">Error</Badge>,
  },
  unknown: {
    icon: <Clock className="h-4 w-4 text-gray-400" />,
    badge: <Badge variant="outline">Unknown</Badge>,
  },
};

const CronsPage = () => {
  const { data, isLoading } = useCrons() as { data: import("@/lib/api/local").CronsResponse | undefined; isLoading?: boolean };

  const crons = data?.crons ?? [];
  const errorCount = crons.filter((c) => c.status === "error").length;
  const okCount = crons.filter((c) => c.status === "ok").length;

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Cron Jobs</PageHeaderTitle>
          <Button size="sm" variant="outline" onClick={() => mutate("/api/crons")}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-3">
        {error && (
          <Card className="p-4 text-destructive text-sm">
            Failed to load cron jobs.
          </Card>
        )}

        {(isLoading || !data) && !error && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {data && data.crons.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No cron jobs found.
          </Card>
        )}

        {data && data.crons.map((cron) => {
          const isOk = cron.status === "ok";
          const isError = cron.status === "error";
          const hasDeliveryWarn = !isError && !!(cron as { errorMsg?: string }).errorMsg;
          const owner = getCronOwner(cron.name, cron.agent);

          return (
            <Card key={cron.id} className={cn(
              "p-4 transition-colors",
              isError && "border-red-200 dark:border-red-900"
            )}>
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isOk ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : isError ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{cron.name || cron.id}</p>
                    <Badge
                      variant={isOk ? "secondary" : isError ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {cron.status || "unknown"}
                    </Badge>
                    <OwnerBadge owner={owner} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                    {cron.schedule}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                    {cron.next && (
                      <span>
                        <span className="font-medium">Next:</span> {cron.next}
                      </span>
                    )}
                    {cron.last && (
                      <span>
                        <span className="font-medium">Last:</span> {cron.last}
                      </span>
                    )}
                    {cron.agent && (
                      <span>
                        <span className="font-medium">Agent:</span> {cron.agent}
                      </span>
                    )}
                    {cron.target && cron.target !== cron.agent && (
                      <span>
                        <span className="font-medium">Target:</span> {cron.target}
                      </span>
                    )}
                  </div>
                  {isError && cron.errorMsg && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5">
                      <span className="font-medium shrink-0">Error:</span>
                      <span className="break-all">{cron.errorMsg}</span>
                    </div>
                  )}
                  {hasDeliveryWarn && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 rounded px-2 py-1.5">
                      <span className="font-medium shrink-0">⚠ Delivery:</span>
                      <span className="break-all">{(cron as { errorMsg?: string }).errorMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {data && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {data.total} job{data.total !== 1 ? "s" : ""} · refreshes every minute
          <PageHeaderTitle>Cron Health</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-6">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Total</p>
              <p className="mt-1 text-3xl font-bold">{crons.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-emerald-600">Healthy</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">{okCount}</p>
            </CardContent>
          </Card>
          <Card className={errorCount > 0 ? "border-red-300 dark:border-red-700" : ""}>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-red-600">Errors</p>
              <p className="mt-1 text-3xl font-bold text-red-600">{errorCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Error banner */}
        {errorCount > 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{errorCount} cron job{errorCount > 1 ? "s" : ""}</span> need attention.
                Check individual error messages below.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cron list */}
        {data === undefined ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : crons.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No cron state found. Aurel&apos;s machine needs{" "}
                <code className="rounded bg-muted px-1">~/clawd/crons/state.json</code> or{" "}
                <code className="rounded bg-muted px-1">~/clawd/crons/logs/</code>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Show errors first */}
            {[...crons].sort((a, b) => (a.status === "error" ? -1 : b.status === "error" ? 1 : 0)).map((cron: CronJob) => {
              const config = statusConfig[cron.status] ?? statusConfig.unknown;
              return (
                <Card key={cron.id} className={cron.status === "error" ? "border-red-200 dark:border-red-800" : ""}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">{config.icon}</div>
                        <div className="min-w-0">
                          <p className="font-medium capitalize">{cron.name}</p>
                          {cron.schedule && (
                            <p className="text-muted-foreground text-xs font-mono mt-0.5">{cron.schedule}</p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Last run: {formatTs(cron.lastRun)}</span>
                            {cron.nextRun && <span>Next: {formatTs(cron.nextRun)}</span>}
                            {cron.errorCount > 0 && (
                              <span className="text-red-600">{cron.errorCount} error{cron.errorCount > 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {cron.lastError && (
                            <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400 font-mono break-all">
                              {cron.lastError}
                            </p>
                          )}
                          {cron.lastOutput && !cron.lastError && (
                            <p className="text-muted-foreground mt-1 truncate text-xs font-mono">{cron.lastOutput}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">{config.badge}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {data?.lastUpdated && (
          <p className="text-muted-foreground text-right text-xs">
            State last updated: {formatTs(data.lastUpdated)}
          </p>
        )}
      </div>
    </>
  );
};

export default CronsPage;
