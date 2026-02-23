"use client";

export const dynamic = "force-dynamic";

import { useAgents, useCrons, useCoordinationFeed, useAgentSSE } from "@/lib/api/local";
import { AgentProfileModal } from "@/components/agent-profile-modal";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { deriveStatus, type AgentStatus } from "@clawe/shared/agents";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  Clock,
  ChevronRight,
  Timer,
} from "lucide-react";
import { useState, useMemo } from "react";
import { WeeklyRoutineGrid } from "./_components/weekly-routine-grid";

// ─── types ────────────────────────────────────────────────────────────────────

interface AgentSession {
  model: string;
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  updatedAt: number;
}

interface Agent {
  _id: string;
  name: string;
  role: string;
  emoji: string;
  status: string;
  health: string;
  currentActivity: string | null;
  blockers: string[];
  needsAttention: string[];
  completedToday: string[];
  lastHeartbeat: number | null;
  session: AgentSession | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function timeAgo(ms: number | null): string {
  if (!ms) return "Never";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const formatLastSeen = timeAgo;

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-6": "text-orange-600 dark:text-orange-400",
  "claude-opus-4-6": "text-red-600 dark:text-red-400",
  "grok-4.1-fast": "text-purple-600 dark:text-purple-400",
  "gpt-4o": "text-green-600 dark:text-green-400",
};

function healthDot(health: string) {
  if (health === "green") return "bg-emerald-500";
  if (health === "yellow") return "bg-yellow-500";
  return "bg-red-500";
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const status = deriveStatus({ ...agent, lastHeartbeat: agent.lastHeartbeat ?? undefined });
  const isOnline = status === "online";

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200 w-full max-w-sm"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{agent.emoji}</span>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge
              variant={isOnline ? "default" : "secondary"}
              className={`text-xs ${isOnline ? "bg-emerald-500 text-white" : ""}`}
            >
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${isOnline ? "bg-white" : "bg-gray-400"}`} />
              {isOnline ? "Online" : "Offline"}
            </Badge>
            {agent.health && (
              <span className={`h-2 w-2 rounded-full inline-block ${healthDot(agent.health)}`} title={`Health: ${agent.health}`} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Session info */}
        {agent.session ? (
          <div className="rounded-lg bg-muted/50 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Cpu className="w-3 h-3" /> Model</span>
              <span className={`font-medium ${MODEL_COLORS[agent.session.model] ?? "text-foreground"}`}>
                {agent.session.model}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3" /> Tokens</span>
              <span className="font-mono">{fmt(agent.session.contextTokens)} ctx · {fmt(agent.session.totalTokens)} total</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground italic">No active session</div>
        )}

        {/* Current activity */}
        {agent.currentActivity && (
          <div className="flex items-start gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
            <span className="line-clamp-2">{agent.currentActivity}</span>
          </div>
        )}

        {/* Needs attention */}
        {agent.needsAttention.length > 0 && (
          <div className="space-y-1">
            {agent.needsAttention.slice(0, 2).map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="line-clamp-1">{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Blockers */}
        {agent.blockers.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Blocked: {agent.blockers[0]}</span>
          </div>
        )}

        {/* Completed today */}
        {agent.completedToday.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{agent.completedToday.length} completed today</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(agent.lastHeartbeat)}
          </span>
          <span className="flex items-center gap-0.5 text-primary text-xs">
            View profile <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function AgentCardSkeleton() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader><Skeleton className="h-12 w-3/4" /></CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const healthDotColors: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
  offline: "bg-gray-400",
};

const statusConfig: Record<string, { label: string; bgColor: string; textColor: string; dotColor: string }> = {
  online: {
    label: "Online",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    textColor: "text-emerald-800 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
  },
  idle: {
    label: "Idle",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-800 dark:text-amber-300",
    dotColor: "bg-amber-400",
  },
  offline: {
    label: "Offline",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-600 dark:text-gray-400",
    dotColor: "bg-gray-400",
  },
};

const AgentsPage = () => {
  const { data: agents } = useAgents();
  const [profileId, setProfileId] = useState<string | null>(null);
  const { data: feedData } = useCoordinationFeed();
  useAgentSSE();

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Squad</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-10">
        {/* Agent cards */}
        <section>
          <p className="text-muted-foreground mb-4 text-sm">
            Click an agent to view their full profile, SOUL, and IDENTITY.
          </p>

          {agents === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground">No agents registered.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {agents.map((agent) => {
                const status = deriveStatus({ ...agent, lastHeartbeat: agent.lastHeartbeat ?? undefined });
                const config = (statusConfig[status] ?? statusConfig.offline)!;
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
                    className="flex w-80 flex-col rounded-xl border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setProfileId(agent._id)}
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

        {/* Weekly Routines */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Weekly Routines</h2>
          </div>
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

      <AgentProfileModal agentId={profileId} onClose={() => setProfileId(null)} />
    </>
  );
};

export default AgentsPage;
