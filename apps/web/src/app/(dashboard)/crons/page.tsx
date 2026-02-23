"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useCrons } from "@/lib/api/local";
import type { CronJob } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { cn } from "@clawe/ui/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { getCronOwner } from "@/lib/owner";
import { OwnerBadge } from "@/components/owner-badge";
import { mutate } from "swr";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    badge: (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
        OK
      </Badge>
    ),
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

// ── Page ──────────────────────────────────────────────────────────────────────

type OwnerFilter = "all" | "aurel" | "soren";
const OWNER_FILTERS: { label: string; value: OwnerFilter; emoji: string }[] = [
  { label: "All",   value: "all",   emoji: "" },
  { label: "Aurel", value: "aurel", emoji: "🏛️" },
  { label: "Søren", value: "soren", emoji: "🧠" },
];

const CronsPage = () => {
  const { data, isLoading } = useCrons();
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");

  const crons = data?.crons ?? [];

  // Errors first, then by name
  const sorted = useMemo(() => {
    const base = [...crons].sort((a, b) =>
      a.status === "error" ? -1 : b.status === "error" ? 1 : 0,
    );
    if (ownerFilter === "all") return base;
    return base.filter((c) => getCronOwner(c.name, c.agent) === ownerFilter);
  }, [crons, ownerFilter]);

  const errorCount = sorted.filter((c) => c.status === "error").length;
  const okCount = sorted.filter((c) => c.status === "ok").length;

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Cron Health</PageHeaderTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {OWNER_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={ownerFilter === f.value ? "default" : "ghost"}
                  onClick={() => setOwnerFilter(f.value)}
                  className="h-7 text-xs capitalize"
                >
                  {f.emoji && <span className="mr-1">{f.emoji}</span>}{f.label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => mutate("/api/crons")}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
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
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">
                  {errorCount} cron job{errorCount > 1 ? "s" : ""}
                </span>{" "}
                need attention. Check individual error messages below.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading skeletons */}
        {(isLoading || !data) && (
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
        )}

        {/* Empty state */}
        {data && crons.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No cron jobs found.</p>
            </CardContent>
          </Card>
        )}

        {/* Cron list */}
        {data && sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map((cron: CronJob) => {
              const isOk = cron.status === "ok";
              const isError = cron.status === "error";
              const hasDeliveryWarn = !isError && !!cron.errorMsg;
              const config = statusConfig[cron.status] ?? statusConfig.unknown;
              const owner = getCronOwner(cron.name, cron.agent);
              const lastRun = cron.lastRun ?? cron.last;
              const nextRun = cron.nextRun ?? cron.next;
              const errorDetail = cron.lastError ?? cron.errorMsg;

              return (
                <Card
                  key={cron.id}
                  className={cn(
                    "transition-colors",
                    isError && "border-red-200 dark:border-red-800",
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{config.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium capitalize">{cron.name || cron.id}</p>
                          {config.badge}
                          <OwnerBadge owner={owner} size="sm" />
                        </div>
                        {cron.schedule && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {cron.schedule}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {lastRun && <span>Last: {formatTs(lastRun)}</span>}
                          {nextRun && <span>Next: {nextRun}</span>}
                          {cron.agent && <span>Agent: {cron.agent}</span>}
                          {cron.target && cron.target !== cron.agent && (
                            <span>Target: {cron.target}</span>
                          )}
                          {(cron.errorCount ?? 0) > 0 && (
                            <span className="text-red-600">
                              {cron.errorCount} error{(cron.errorCount ?? 0) > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Execution error */}
                        {isError && errorDetail && (
                          <div className="mt-2 flex items-start gap-1.5 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                            <span className="shrink-0 font-medium">Error:</span>
                            <span className="break-all font-mono">{errorDetail}</span>
                          </div>
                        )}

                        {/* Delivery warning (ran ok but had delivery issue) */}
                        {hasDeliveryWarn && (
                          <div className="mt-2 flex items-start gap-1.5 rounded bg-yellow-50 px-2 py-1.5 text-xs text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
                            <span className="shrink-0 font-medium">⚠ Delivery:</span>
                            <span className="break-all">{cron.errorMsg}</span>
                          </div>
                        )}

                        {/* Last output (when ok and no errors) */}
                        {isOk && cron.lastOutput && !errorDetail && (
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {cron.lastOutput}
                          </p>
                        )}
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
          <p className="text-right text-xs text-muted-foreground">
            State last updated: {formatTs(data.lastUpdated)}
          </p>
        )}
      </div>
    </>
  );
};

export default CronsPage;
