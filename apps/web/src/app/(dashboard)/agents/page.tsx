"use client";

export const dynamic = "force-dynamic";

import { useAgents, useCoordinationFeed, useAgentSSE } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawe/ui/components/card";
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
  const { data: feedData } = useCoordinationFeed();
  useAgentSSE();

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

                const ext = agent as Record<string, unknown>;
                const profile = ext.profile as Record<string, string> | null;
                const skills = (ext.skills as string[] | undefined) ?? [];
                const session = ext.session as Record<string, unknown> | null;
                const memStats = ext.memory_stats as Record<string, unknown> | null;
                const cronSummary = ext.crons_summary as Record<string, unknown> | null;
                const fleet = ext.fleet as Record<string, unknown> | null;
                const machineMetrics = ext.machine_metrics as Record<string, unknown> | null;

                return (
                  <div
                    key={agent._id}
                    className="flex w-80 flex-col rounded-xl border bg-card shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b p-4 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{agent.emoji}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{agent.name}</h3>
                            <span className={`h-2 w-2 rounded-full ${healthDot}`} title={`Health: ${agent.health ?? status}`} />
                          </div>
                          <p className="text-xs text-muted-foreground">{profile?.role ?? agent.role}</p>
                          {profile?.timezone && (
                            <p className="text-[10px] text-muted-foreground">{profile.timezone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {status === "offline" ? (
                          <Badge variant="outline" className="text-xs">{config.label}</Badge>
                        ) : (
                          <Badge variant="secondary" className={`text-xs ${config.bgColor} ${config.textColor}`}>
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
                            {config.label}
                          </Badge>
                        )}
                        {completedCount > 0 && (
                          <Badge variant="secondary" className="text-[10px]">✓ {completedCount} today</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 text-xs">
                      {/* Active focus */}
                      {activeFocus && (
                        <p className="italic text-muted-foreground line-clamp-2">💭 {activeFocus}</p>
                      )}

                      {/* Blockers / Attention */}
                      {hasBlockers && (
                        <div className="rounded bg-amber-50 px-2 py-1 dark:bg-amber-900/20">
                          <p className="truncate text-amber-700 dark:text-amber-400">
                            ⚠ {agent.blockers![0]}
                          </p>
                        </div>
                      )}
                      {hasAttention && (
                        <div className="rounded bg-red-50 px-2 py-1 dark:bg-red-900/20">
                          <p className="font-medium text-red-700 dark:text-red-400">🔴 Needs attention</p>
                          {Array.isArray(agent.needsAttention) && agent.needsAttention[0] && (
                            <p className="truncate text-red-600 dark:text-red-300">{agent.needsAttention[0]}</p>
                          )}
                        </div>
                      )}

                      {/* Session */}
                      {session && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Session</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="text-muted-foreground">Model</span>
                            <span className="font-mono truncate">{String(session.model ?? "—").split("/").pop()}</span>
                            {session.memory_chunks != null && <>
                              <span className="text-muted-foreground">Memory</span>
                              <span>{String(session.memory_chunks)} chunks</span>
                            </>}
                            {session.sessions_total != null && <>
                              <span className="text-muted-foreground">Sessions</span>
                              <span>{String(session.sessions_total)}</span>
                            </>}
                            {session.totalTokens != null && <>
                              <span className="text-muted-foreground">Tokens today</span>
                              <span>{Number(session.totalTokens).toLocaleString()}</span>
                            </>}
                          </div>
                        </div>
                      )}

                      {/* Memory stats */}
                      {memStats && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Memory</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="text-muted-foreground">Vector chunks</span>
                            <span>{String(memStats.vector_chunks ?? "—")}</span>
                            <span className="text-muted-foreground">Daily files</span>
                            <span>{String(memStats.daily_files ?? "—")}</span>
                            <span className="text-muted-foreground">Backend</span>
                            <span>{String(memStats.backend ?? "—")}</span>
                          </div>
                        </div>
                      )}

                      {/* Cron summary */}
                      {cronSummary && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Crons</p>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {String(cronSummary.ok ?? 0)} ok
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {String(cronSummary.error ?? 0)} error
                            </span>
                            <span className="text-muted-foreground">/ {String(cronSummary.total ?? 0)} total</span>
                          </div>
                          {(cronSummary.errors as string[] | undefined)?.slice(0,2).map((e, i) => (
                            <p key={i} className="truncate text-[10px] text-red-600 dark:text-red-400">⚠ {e}</p>
                          ))}
                        </div>
                      )}

                      {/* Machine metrics */}
                      {machineMetrics && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Fleet</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="text-muted-foreground">Disk free</span>
                            <span>{String(machineMetrics.disk_free ?? "—")} ({String(machineMetrics.disk_used_pct ?? "—")} used)</span>
                            <span className="text-muted-foreground">Load</span>
                            <span>{String(machineMetrics.load_avg_1m ?? "—")}</span>
                            <span className="text-muted-foreground">Uptime</span>
                            <span>{String(machineMetrics.uptime ?? "—")}</span>
                          </div>
                        </div>
                      )}

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                            Skills ({skills.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {skills.slice(0, 12).map((s) => (
                              <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {s}
                              </span>
                            ))}
                            {skills.length > 12 && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                +{skills.length - 12} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Completed today */}
                      {completedCount > 0 && (
                        <div className="space-y-1">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Shipped today</p>
                          <ul className="space-y-0.5">
                            {agent.completedToday!.map((item, i) => (
                              <li key={i} className="flex gap-1 text-[11px]">
                                <span className="text-emerald-500 shrink-0">✓</span>
                                <span className="text-muted-foreground line-clamp-1">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="mt-auto text-[10px] text-muted-foreground border-t pt-2">
                        Last heartbeat: {formatLastSeen(agent.lastHeartbeat)}
                        {profile?.machine && <span className="ml-2">· {profile.machine}</span>}
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

        {/* Coordination Feed */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Coordination Feed</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Recent messages between agents.
          </p>
          {!feedData ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : feedData.messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No messages yet.</p>
          ) : (
            <div className="space-y-2">
              {feedData.messages.map((msg) => (
                <Card key={msg.id} className="transition-colors hover:bg-muted/30">
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xl">{msg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{msg.agent}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-muted-foreground text-xs">{msg.date}</span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium leading-snug">{msg.title}</p>
                        {msg.preview && (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">{msg.preview}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
