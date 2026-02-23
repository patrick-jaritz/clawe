"use client";

export const dynamic = "force-dynamic";

import { useCrons } from "@/lib/api/local";
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
          </p>
        )}
      </div>
    </>
  );
};

export default CronsPage;
