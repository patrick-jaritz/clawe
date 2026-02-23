"use client";
export const dynamic = "force-dynamic";

import { mutate } from "swr";
import { PageHeader, PageHeaderRow, PageHeaderTitle } from "@dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { useWeeklyReview } from "@/lib/api/local";
import { RefreshCw, Brain, CheckSquare, Database, Calendar } from "lucide-react";

export default function WeeklyReviewPage() {
  const { data, isLoading } = useWeeklyReview();

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <div>
            <PageHeaderTitle>Weekly Review</PageHeaderTitle>
            {data && (
              <p className="text-sm text-muted-foreground">
                {new Date(data.weekOf).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} →{" "}
                {new Date(data.weekEnding).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate("/api/weekly-review")}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-4">
        {isLoading && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-48" />
          </>
        )}

        {!isLoading && data && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Brain className="h-4 w-4" />
                  <span className="text-xs">Intel Chunks</span>
                </div>
                <p className="text-3xl font-bold">{data.intelChunks}</p>
                <p className="text-xs text-muted-foreground">in knowledge base</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CheckSquare className="h-4 w-4" />
                  <span className="text-xs">Tasks Done</span>
                </div>
                <p className="text-3xl font-bold">{data.completedTasks.length}</p>
                <p className="text-xs text-muted-foreground">from daily logs</p>
              </Card>

              <Card className="p-4 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Week</span>
                </div>
                <p className="text-sm font-semibold">
                  {new Date(data.weekOf).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-xs text-muted-foreground">to {new Date(data.weekEnding).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
              </Card>
            </div>

            {/* Completed tasks */}
            {data.completedTasks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-green-500" />
                    Completed This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {data.completedTasks.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Memory stats */}
            {data.memStats && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Memory System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {data.memStats.trim()}
                  </pre>
                </CardContent>
              </Card>
            )}

            {data.completedTasks.length === 0 && !data.memStats && (
              <Card className="p-8 text-center text-muted-foreground">
                No completed tasks found in daily logs for this week.
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
