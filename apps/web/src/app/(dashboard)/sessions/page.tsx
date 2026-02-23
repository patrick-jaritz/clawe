"use client";

export const dynamic = "force-dynamic";

import { useSessions, type SessionItem } from "@/lib/api/local";
import { AgentProfileModal } from "@/components/agent-profile-modal";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  PageHeaderActions,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { RefreshCw, Bot, Timer, MessageSquare, Users, Zap, XCircle, Circle, Info } from "lucide-react";
import { getSessionOwner } from "@/lib/owner";
import { OwnerBadge } from "@/components/owner-badge";
import { useState, useMemo } from "react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-6": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "claude-opus-4-6":   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "grok-4.1-fast":     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "gpt-4o":            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "gemini-2.5-flash":  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "gemini-1.5-pro":    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

function modelColor(model: string) {
  return MODEL_COLORS[model] ?? "bg-muted text-muted-foreground";
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "cron")     return <Timer className="w-3 h-3" />;
  if (kind === "subagent") return <Bot className="w-3 h-3" />;
  if (kind === "group")    return <Users className="w-3 h-3" />;
  return <MessageSquare className="w-3 h-3" />;
}

const KIND_COLORS: Record<string, string> = {
  direct:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  group:    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  cron:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  subagent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${KIND_COLORS[kind] ?? ""}`}>
      <KindIcon kind={kind} />{kind}
    </span>
  );
}

function fmt(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

// A session is "active" if updated within the last 30 minutes
const ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;
function isActiveSession(updatedAt: number): boolean {
  return Date.now() - updatedAt < ACTIVE_THRESHOLD_MS;
}

type Filter = "all" | "direct" | "group" | "cron" | "subagent";
type OwnerFilter = "all" | "Aurel" | "Søren";

const OWNER_FILTERS: { label: string; value: OwnerFilter; emoji: string }[] = [
  { label: "All", value: "all", emoji: "" },
  { label: "Aurel", value: "Aurel", emoji: "🏛️" },
  { label: "Søren", value: "Søren", emoji: "🧠" },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { data, isLoading, mutate } = useSessions();
  const [filter, setFilter] = useState<Filter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [profileId, setProfileId] = useState<string | null>(null);

  const FILTERS: Filter[] = ["all", "direct", "group", "subagent", "cron"];

  const filtered = useMemo(() => {
    if (!data?.sessions) return [];
    return data.sessions.filter((s) => {
      if (filter !== "all" && s.kind !== filter) return false;
      if (ownerFilter !== "all" && getSessionOwner(s.key, s.label, s.kind) !== ownerFilter) return false;
      return true;
    });
  }, [data?.sessions, filter, ownerFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const s of data?.sessions ?? []) {
      c.all = (c.all ?? 0) + 1;
      c[s.kind] = (c[s.kind] ?? 0) + 1;
    }
    return c;
  }, [data?.sessions]);

  const topModels = useMemo(
    () => Object.entries(data?.modelSummary ?? {}).sort((a, b) => b[1] - a[1]),
    [data?.modelSummary]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader><PageHeaderRow><PageHeaderTitle>Sessions</PageHeaderTitle></PageHeaderRow></PageHeader>
        <div className="space-y-2 mt-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Sessions</PageHeaderTitle>
          <PageHeaderActions>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{data?.total ?? 0} sessions</span>
              <Button variant="ghost" size="icon" onClick={() => mutate()} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      {/* Model summary pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {topModels.map(([model, count]) => (
          <span key={model} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${modelColor(model)}`}>
            <Zap className="w-3 h-3" />
            {model}
            <span className="font-bold ml-0.5">{count}</span>
          </span>
        ))}
      </div>

      {/* Kind + Owner filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button key={f} variant={filter === f ? "default" : "ghost"} size="sm" onClick={() => setFilter(f)} className="capitalize text-xs h-7">
              {f}{counts[f] !== undefined ? <span className="ml-1 opacity-60">{counts[f]}</span> : null}
            </Button>
          ))}
        </div>
        <div className="w-px h-5 bg-border hidden sm:block" />
        <div className="flex gap-1">
          {OWNER_FILTERS.map((f) => (
            <Button key={f.value} variant={ownerFilter === f.value ? "default" : "ghost"} size="sm" onClick={() => setOwnerFilter(f.value)} className="text-xs h-7">
              {f.emoji && <span className="mr-1">{f.emoji}</span>}{f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Explainer */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 mb-4 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p><span className="text-foreground font-medium">What you're seeing:</span> All sessions stored in sessions.json — current and historical. Sessions are never auto-deleted by OpenClaw.</p>
          <p><span className="text-foreground font-medium">Active vs ceased:</span> 🟢 = updated within 30 min (currently running). ⚫ = finished or idle.</p>
          <p><span className="text-foreground font-medium">Subagents:</span> One-shot tasks spawned to handle a specific job. They finish and stop. The same key can be reused if a new subagent with the same purpose is spawned — it will show as active again when it runs.</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto text-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium w-8"></th>
              <th className="px-3 py-2 text-left font-medium w-20">Owner</th>
              <th className="px-3 py-2 text-left font-medium w-24">Kind</th>
              <th className="px-3 py-2 text-left font-medium">Session</th>
              <th className="px-3 py-2 text-left font-medium w-44">Model</th>
              <th className="px-3 py-2 text-right font-medium w-20">Age</th>
              <th className="px-3 py-2 text-right font-medium w-24">In</th>
              <th className="px-3 py-2 text-right font-medium w-24">Out</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isMain = s.key === "agent:main:main";
              const active = isActiveSession(s.updatedAt);
              const owner = getSessionOwner(s.key, s.label, s.kind);
              return (
                <tr key={s.key} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isMain ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 text-center">
                    <Circle
                      className={`w-2 h-2 inline ${active ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/30 text-muted-foreground/30"}`}
                      aria-label={active ? "Active (updated < 30 min ago)" : "Ceased / idle"}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <OwnerBadge owner={owner} size="sm" />
                  </td>
                  <td className="px-3 py-2"><KindBadge kind={s.kind} /></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {isMain ? (
                        <button
                          onClick={() => setProfileId("aurel")}
                          className="font-mono text-xs text-primary hover:underline text-left"
                        >
                          {s.label} 👈 click for profile
                        </button>
                      ) : s.kind === "direct" && !s.key.includes(":cron:") ? (
                        <button
                          onClick={() => setProfileId("aurel")}
                          className="font-mono text-xs text-primary hover:underline text-left"
                        >
                          {s.label}
                        </button>
                      ) : (
                        <span className="font-mono text-xs">{s.label}</span>
                      )}
                      {s.origin && <span className="text-xs text-muted-foreground truncate max-w-xs mt-0.5 block">{s.origin}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${modelColor(s.model)}`}>
                      {s.model}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{s.ageLabel}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmt(s.inputTokens)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmt(s.outputTokens)}</td>
                  <td className="px-3 py-2 text-center">
                    {s.aborted && <XCircle className="w-4 h-4 text-red-500 inline" aria-label="Aborted" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AgentProfileModal agentId={profileId} onClose={() => setProfileId(null)} />
    </>
  );
}
