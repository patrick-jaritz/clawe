"use client";

export const dynamic = "force-dynamic";

import { useAgents } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { deriveStatus, type AgentStatus } from "@clawe/shared/agents";
import { WeeklyRoutineGrid } from "./_components/weekly-routine-grid";

const statusConfig: Record<
  AgentStatus,
  { dotColor: string; bgColor: string; textColor: string; label: string }
> = {
  online: {
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    label: "Online",
  },
  offline: {
    dotColor: "bg-gray-400",
    bgColor: "",
    textColor: "",
    label: "Offline",
  },
};

const formatLastSeen = (timestamp?: number): string => {
  if (!timestamp) return "Never";
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const healthDotColors: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
  offline: "bg-gray-400",
};

const AgentsPage = () => {
  const { data: agents } = useAgents();

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Squad</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-8">
        {/* Agents section */}
        <section>
          <p className="text-muted-foreground mb-4 text-sm">
            Your AI agents and their current status.
          </p>

          {agents === undefined ? (
            <div className="flex flex-wrap gap-4">
              {[1, 2, 3, 4].map((i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground">No agents registered yet.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {agents.map((agent) => {
                const status = deriveStatus(agent);
                const config = statusConfig[status] ?? statusConfig.offline;
                const healthDot = healthDotColors[agent.health ?? status] ?? healthDotColors.offline;
                const hasBlockers = (agent.blockers?.length ?? 0) > 0;
                const hasAttention = agent.needsAttention && (
                  Array.isArray(agent.needsAttention)
                    ? agent.needsAttention.length > 0
                    : true
                );
                const completedCount = agent.completedToday?.length ?? 0;
                const activeFocus = agent.activeFocus ?? agent.currentActivity;

                return (
                  <div
                    key={agent._id}
                    className="flex w-72 flex-col rounded-lg border p-4"
                  >
                    {/* Header row */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{agent.emoji}</span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${healthDot}`}
                          title={`Health: ${agent.health ?? status}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {completedCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            ✓ {completedCount} today
                          </Badge>
                        )}
                        {status === "offline" ? (
                          <Badge variant="outline">{config.label}</Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={`${config.bgColor} ${config.textColor}`}
                          >
                            <span
                              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${config.dotColor}`}
                            />
                            {config.label}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h3 className="mb-0.5 font-medium">{agent.name}</h3>
                    <p className="text-muted-foreground text-sm">{agent.role}</p>

                    {/* Active focus */}
                    {activeFocus && (
                      <p className="text-muted-foreground mt-2 truncate text-xs italic">
                        {activeFocus}
                      </p>
                    )}

                    {/* Blockers warning */}
                    {hasBlockers && (
                      <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-900/20">
                        <p className="truncate text-xs text-amber-700 dark:text-amber-400">
                          ⚠ {agent.blockers![0]}
                          {agent.blockers!.length > 1 && ` +${agent.blockers!.length - 1} more`}
                        </p>
                      </div>
                    )}

                    {/* Needs attention banner */}
                    {hasAttention && (
                      <div className="mt-2 rounded-md bg-red-50 px-2 py-1 dark:bg-red-900/20">
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">
                          🔴 Needs attention
                        </p>
                        {Array.isArray(agent.needsAttention) && agent.needsAttention.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-300">
                            {agent.needsAttention[0]}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-3">
                      <p className="text-muted-foreground text-xs">
                        Last seen: {formatLastSeen(agent.lastHeartbeat)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Weekly Routines section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Weekly Routines</h2>
          <WeeklyRoutineGrid />
        </section>
      </div>
    </>
  );
};

const AgentCardSkeleton = () => {
  return (
    <div className="flex w-52 flex-col rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-1 h-5 w-20" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-auto h-3 w-32 pt-4" />
    </div>
  );
};

export default AgentsPage;
