"use client";

import { useSessions } from "@/lib/api/local";
import type { SessionItem } from "@/lib/api/local";
import { cn } from "@clawe/ui/lib/utils";
import { Badge } from "@clawe/ui/components/badge";
import { ScrollArea } from "@clawe/ui/components/scroll-area";
import {
  Bot,
  Timer,
  MessageSquare,
  Users,
  Circle,
  Activity,
  Loader2,
  Zap,
} from "lucide-react";
import { useMemo } from "react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;

function isActive(updatedAt: number): boolean {
  return Date.now() - updatedAt < ACTIVE_THRESHOLD_MS;
}

function getOwner(s: SessionItem): string {
  if (s.owner) return s.owner.toLowerCase();
  // Infer from key pattern
  if (s.key.includes("soren")) return "soren";
  return "aurel";
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "cron") return <Timer className="w-3 h-3" />;
  if (kind === "subagent") return <Bot className="w-3 h-3" />;
  if (kind === "group") return <Users className="w-3 h-3" />;
  return <MessageSquare className="w-3 h-3" />;
}

const KIND_COLORS: Record<string, string> = {
  cron: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  subagent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  group: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  direct: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-6": "text-orange-600 dark:text-orange-400",
  "claude-opus-4-6": "text-red-600 dark:text-red-400",
  "grok-4.1-fast": "text-purple-600 dark:text-purple-400",
  "gpt-4o": "text-green-600 dark:text-green-400",
  "gemini-2.5-flash": "text-blue-600 dark:text-blue-400",
};

function fmt(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function shortModel(model: string) {
  return model.split("/").pop() ?? model;
}

function shortLabel(s: SessionItem) {
  // Make label more readable
  if (s.origin) return s.origin;
  return s.label;
}

// ─── component ───────────────────────────────────────────────────────────────

export type ProcessTrackerProps = {
  className?: string;
  collapsed?: boolean;
};

export function ProcessTracker({ className, collapsed = false }: ProcessTrackerProps) {
  const { data, isLoading } = useSessions();

  const { activeProcesses, stats } = useMemo(() => {
    if (!data?.sessions) return { activeProcesses: [], stats: { active: 0, crons: 0, subagents: 0, total: 0 } };

    // Filter: active only, exclude Soren
    const active = data.sessions.filter((s) => {
      if (!isActive(s.updatedAt)) return false;
      if (getOwner(s) === "soren") return false;
      return true;
    });

    // Deduplicate: for cron runs, keep only the parent (shorter key)
    const deduped: SessionItem[] = [];
    const seen = new Set<string>();
    for (const s of active) {
      // Skip cron run children (key contains :run:)
      if (s.key.includes(":run:")) continue;
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      deduped.push(s);
    }

    // Sort: subagents first, then crons, then by recency
    const kindOrder: Record<string, number> = { subagent: 0, cron: 1, direct: 2, group: 3 };
    deduped.sort((a, b) => {
      const ka = kindOrder[a.kind] ?? 9;
      const kb = kindOrder[b.kind] ?? 9;
      if (ka !== kb) return ka - kb;
      return b.updatedAt - a.updatedAt;
    });

    return {
      activeProcesses: deduped,
      stats: {
        active: deduped.length,
        crons: deduped.filter((s) => s.kind === "cron").length,
        subagents: deduped.filter((s) => s.kind === "subagent").length,
        total: data.total,
      },
    };
  }, [data]);

  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-3", className)}>
        <Activity className="w-4 h-4 text-muted-foreground" />
        {stats.active > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
            {stats.active}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Processes</span>
        </div>
        <div className="flex items-center gap-1.5">
          {stats.active > 0 ? (
            <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.active} active
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">idle</span>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
      ) : stats.active === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1.5">
          <Circle className="w-4 h-4 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground">No active processes</span>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {activeProcesses.map((s) => (
              <ProcessItem key={s.key} session={s} />
            ))}
          </div>

          {/* Stats footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t text-[10px] text-muted-foreground">
            <span>{stats.total} total sessions</span>
            <div className="flex items-center gap-2">
              {stats.crons > 0 && (
                <span className="flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" /> {stats.crons}
                </span>
              )}
              {stats.subagents > 0 && (
                <span className="flex items-center gap-1">
                  <Bot className="w-2.5 h-2.5" /> {stats.subagents}
                </span>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── process item ────────────────────────────────────────────────────────────

function ProcessItem({ session: s }: { session: SessionItem }) {
  const model = shortModel(s.model);
  const modelColor = MODEL_COLORS[s.model] ?? "text-muted-foreground";

  return (
    <div className="rounded-lg border bg-card p-2 space-y-1.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium ${KIND_COLORS[s.kind] ?? ""}`}>
            <KindIcon kind={s.kind} />
            {s.kind}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{s.ageLabel}</span>
      </div>

      <p className="text-[11px] font-medium truncate" title={shortLabel(s)}>
        {shortLabel(s)}
      </p>

      <div className="flex items-center justify-between text-[10px]">
        <span className={cn("font-mono", modelColor)}>{model}</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" />
            {fmt(s.outputTokens)} out
          </span>
        </div>
      </div>

      {s.aborted && (
        <span className="text-[10px] text-red-500 font-medium">⚠ Aborted</span>
      )}
    </div>
  );
}
