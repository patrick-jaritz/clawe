"use client";

export const dynamic = "force-dynamic";

import { useAgents, useCrons } from "@/lib/api/local";
import { AgentProfileModal } from "@/components/agent-profile-modal";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { deriveStatus } from "@clawe/shared/agents";
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

// ─── cron schedule parser ─────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cronMatchesDay(cronExpr: string, dayIndex: number): boolean {
  if (!cronExpr) return false;
  // "daily" shorthand
  if (cronExpr.includes("daily") || cronExpr === "@daily") return true;
  // Standard cron: min hour day-of-month month day-of-week
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const dow = parts[4]; // day-of-week field
  if (dow === "*") return true; // every day
  // Comma-separated list
  const days = dow.split(",");
  return days.some((d) => {
    const n = parseInt(d);
    return !isNaN(n) && n === dayIndex;
  });
}

// ─── Weekly Routines ─────────────────────────────────────────────────────────

function WeeklyRoutineGrid() {
  const { data } = useCrons();
  const today = new Date().getDay();

  // Build a day→crons map
  const dayMap = useMemo(() => {
    const map: Record<number, Array<{ name: string; status: string }>> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    if (!data?.crons) return map;
    for (const cron of data.crons) {
      for (let d = 0; d < 7; d++) {
        if (cronMatchesDay(cron.schedule ?? "", d)) {
          map[d].push({ name: cron.name, status: cron.status });
        }
      }
    }
    return map;
  }, [data?.crons]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day, dayIndex) => {
        const isToday = dayIndex === today;
        const crons = dayMap[dayIndex] ?? [];
        return (
          <div key={day} className={`flex min-h-44 flex-col rounded-xl border p-2.5 ${isToday ? "border-primary/40 bg-primary/5" : ""}`}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className={`text-xs font-medium tracking-wider uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {day}
              </span>
              {isToday && (
                <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-semibold text-primary uppercase">today</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {crons.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">—</p>
              ) : (
                crons.map((c, i) => (
                  <div key={i} className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate ${c.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30" : "bg-muted text-muted-foreground"}`} title={c.name}>
                    {c.name}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const status = deriveStatus(agent);
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

const AgentsPage = () => {
  const { data: agents } = useAgents();
  const [profileId, setProfileId] = useState<string | null>(null);

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(agents as unknown as Agent[]).map((agent) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  onClick={() => setProfileId(agent._id)}
                />
              ))}
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
      </div>

      <AgentProfileModal agentId={profileId} onClose={() => setProfileId(null)} />
    </>
  );
};

export default AgentsPage;
