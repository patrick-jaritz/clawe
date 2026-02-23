"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { mutate } from "swr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Badge } from "@clawe/ui/components/badge";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  GraduationCap,
  Github,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import {
  useSystemHealth,
  useRecentIntel,
  useProjects,
  useTasks,
  useAgents,
  useAgentSSE,
  useDBAProgress,
  updateTaskStatus,
  askIntel,
  generateDailyDigest,
  type LocalTask,
} from "@/lib/api/local";
import { cn } from "@clawe/ui/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Date/time helpers ─────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  } catch { return "recently"; }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-02-23"
}

// ── Daily Brief (auto-loads once per day, cached in localStorage) ─────────────

function useDailyBrief() {
  const [brief, setBrief] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [generatedAt, setGeneratedAt] = React.useState<string>("");

  const generate = React.useCallback(async (force = false) => {
    const key = `brief:${todayKey()}`;
    if (!force) {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const { text, ts } = JSON.parse(cached) as { text: string; ts: string };
          setBrief(text);
          setGeneratedAt(ts);
          return;
        } catch { /* bad cache */ }
      }
    }
    setLoading(true);
    setBrief("");
    try {
      const result = await generateDailyDigest();
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setBrief(result.brief);
      setGeneratedAt(ts);
      localStorage.setItem(key, JSON.stringify({ text: result.brief, ts }));
    } catch {
      setBrief("*Brief unavailable — check API connection.*");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { generate(); }, [generate]);

  return { brief, loading, generatedAt, refresh: () => generate(true) };
}

// ── Source icon ───────────────────────────────────────────────────────────────

function SourceIcon({ source }: { source: string }) {
  const s = source.toLowerCase();
  if (s === "gmail") return <Mail className="h-3.5 w-3.5" />;
  if (s === "github") return <Github className="h-3.5 w-3.5" />;
  if (s === "reddit" || s === "twitter") return <MessageCircle className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}

// ── Situation strip ───────────────────────────────────────────────────────────

function SituationStrip() {
  const { data: healthData } = useSystemHealth();
  const { data: projectsData } = useProjects();
  const { data: tasksData } = useTasks();
  const { data: dbaData } = useDBAProgress();

  const DBA_DEADLINE = new Date("2026-03-31T23:59:00");
  const daysLeft = Math.max(0, Math.ceil((DBA_DEADLINE.getTime() - Date.now()) / 86400000));
  const runningCount = projectsData?.projects?.filter((p) => p.running).length ?? 0;
  const activeTaskCount = tasksData?.filter((t) => t.status !== "done").length ?? 0;
  const chunkCount = healthData?.services?.lancedb?.chunks ?? 0;

  const dbaTotal = dbaData?.papers?.reduce((s, p) => s + p.sections.length, 0) ?? 0;
  const dbaDone = dbaData?.papers?.reduce((s, p) => s + p.sections.filter((x) => x.done).length, 0) ?? 0;
  const dbaPct = dbaTotal > 0 ? Math.round((dbaDone / dbaTotal) * 100) : 0;

  const urgency = daysLeft <= 14 ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
    : daysLeft <= 30 ? "text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
    : "text-foreground border-border bg-muted/30";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Link href="/dba">
        <div className={cn("rounded-xl border px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow", urgency)}>
          <div className="flex items-center gap-2 mb-0.5">
            <GraduationCap className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">DBA</span>
          </div>
          <p className="text-xl font-bold leading-none">{daysLeft}d</p>
          <p className="text-xs text-muted-foreground mt-0.5">{dbaPct}% done</p>
        </div>
      </Link>

      <Link href="/board">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-0.5">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks</span>
          </div>
          <p className="text-xl font-bold leading-none">{activeTaskCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">active</p>
        </div>
      </Link>

      <Link href="/projects">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Running</span>
          </div>
          <p className="text-xl font-bold leading-none">{runningCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">projects</p>
        </div>
      </Link>

      <Link href="/intelligence">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 cursor-pointer hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-2 mb-0.5">
            <Brain className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intel</span>
          </div>
          <p className="text-xl font-bold leading-none">{chunkCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">chunks</p>
        </div>
      </Link>
    </div>
  );
}

// ── Today's Focus ─────────────────────────────────────────────────────────────

function TodaysFocus() {
  const { data: tasks } = useTasks();
  const [toggling, setToggling] = React.useState<string | null>(null);

  const activeTasks = (tasks ?? []).filter((t) => t.status !== "done").slice(0, 5);

  const handleDone = async (task: LocalTask) => {
    setToggling(task._id);
    try {
      await updateTaskStatus(task._id, "done");
      mutate("/api/tasks");
    } finally {
      setToggling(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Today's Focus</CardTitle>
          <Link href="/board">
            <Button variant="ghost" size="sm" className="text-xs h-7">Board →</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {activeTasks.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            All clear — no active tasks.
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <div key={task._id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                <button
                  onClick={() => handleDone(task)}
                  disabled={toggling === task._id}
                  className="text-muted-foreground hover:text-green-500 flex-shrink-0 transition-colors disabled:opacity-40"
                >
                  {toggling === task._id
                    ? <Circle className="h-4 w-4 animate-pulse" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <span className="flex-1 truncate text-sm">{task.title}</span>
                <Badge variant="outline" className={cn(
                  "text-xs flex-shrink-0",
                  task.status === "in_progress" && "border-blue-300 text-blue-600",
                  task.status === "review" && "border-purple-300 text-purple-600",
                )}>
                  {task.status === "in_progress" ? "In Progress"
                    : task.status === "review" ? "Review" : "Inbox"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Needs Attention ───────────────────────────────────────────────────────────

function NeedsAttentionBanner() {
  useAgentSSE();
  const { data: agentsData } = useAgents();

  const flagged = (agentsData ?? []).filter((a) => {
    if (!a.needsAttention) return false;
    if (Array.isArray(a.needsAttention)) return a.needsAttention.length > 0;
    return true;
  });

  if (flagged.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {flagged.map((agent) => (
          <div key={agent._id} className="flex items-start gap-3">
            <span className="text-base">{agent.emoji}</span>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{agent.name}</p>
              {Array.isArray(agent.needsAttention) && agent.needsAttention.length > 0 && (
                <ul className="mt-0.5 space-y-0.5">
                  {agent.needsAttention.map((item: string, i: number) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">• {item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Intel Highlights ──────────────────────────────────────────────────────────

function IntelHighlights() {
  const { data: intelData } = useRecentIntel();
  const chunks = intelData?.chunks?.slice(0, 6) ?? [];

  if (chunks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Intel Highlights</CardTitle>
          <Link href="/intelligence">
            <Button variant="ghost" size="sm" className="text-xs h-7">All intel →</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {chunks.map((chunk) => (
            <Link
              key={chunk.id}
              href={chunk.url || "/intelligence"}
              className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
            >
              <span className="mt-0.5 text-muted-foreground flex-shrink-0">
                <SourceIcon source={chunk.source} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{chunk.title}</p>
                <p className="text-xs text-muted-foreground">{chunk.source} · {formatTimeAgo(chunk.date)}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── System Health (compact) ───────────────────────────────────────────────────

function SystemHealthBar() {
  const { data: healthData } = useSystemHealth();
  if (!healthData) return null;

  const services = [
    healthData.services.api,
    healthData.services.qdrant,
    healthData.services.lancedb,
  ];

  const allOk = services.every((s) => s.ok);

  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm">
      <span className="flex-shrink-0">
        {allOk
          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
          : <XCircle className="h-4 w-4 text-red-500" />}
      </span>
      <span className="font-medium">{allOk ? "All systems operational" : "Degraded"}</span>
      <span className="text-muted-foreground">·</span>
      {services.map((svc) => (
        <span key={svc.label} className={cn("text-xs", svc.ok ? "text-muted-foreground" : "text-red-500 font-medium")}>
          {svc.ok ? `${svc.label} ✓` : `${svc.label} ✗`}
        </span>
      ))}
      {healthData.next_ingest && (
        <>
          <span className="text-muted-foreground ml-auto text-xs">Next ingest: {healthData.next_ingest}</span>
        </>
      )}
    </div>
  );
}

// ── Quick Ask ─────────────────────────────────────────────────────────────────

function QuickAsk() {
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [asked, setAsked] = React.useState(false);
  const abortRef = React.useRef<(() => void) | null>(null);

  const handleAsk = () => {
    const q = query.trim();
    if (!q || loading) return;
    setAnswer(""); setAsked(true); setLoading(true);
    const abort = askIntel(q, {
      onSources: () => {},
      onDelta: (t) => setAnswer((p) => p + t),
      onDone: () => { setLoading(false); abortRef.current = null; },
      onError: (msg) => { setAnswer(`Error: ${msg}`); setLoading(false); },
    });
    abortRef.current = abort;
  };

  const SUGGESTIONS = ["What's in my recent emails?", "BYL progress?", "Latest GitHub?"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Quick Ask
          <span className="text-xs font-normal text-muted-foreground ml-1">RAG + Claude</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask your knowledge base..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={handleAsk} disabled={!query.trim() || loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {asked ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed min-h-[60px]">
            {answer ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
              </div>
            ) : loading && (
              <span className="flex gap-1 text-muted-foreground">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="animate-bounce" style={{ animationDelay: `${d}ms` }}>·</span>
                ))}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setQuery(s)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { brief, loading, generatedAt, refresh } = useDailyBrief();

  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}, Patrick</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatDate()}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="text-xs text-muted-foreground flex-shrink-0">
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
          {generatedAt ? `Refreshed ${generatedAt}` : "Generate brief"}
        </Button>
      </div>

      {/* System Health Bar */}
      <SystemHealthBar />

      {/* Needs Attention */}
      <NeedsAttentionBanner />

      {/* Daily Brief — the main event */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Daily Brief</CardTitle>
            {generatedAt && (
              <span className="text-xs text-muted-foreground ml-1">· {generatedAt}</span>
            )}
          </div>
          <CardDescription className="text-xs">Auto-generated once per day · cached until midnight</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[90, 70, 80, 60, 75].map((w, i) => (
                <div key={i} className="h-3.5 bg-muted rounded-full" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : brief ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>No brief yet. Click "Generate brief" above.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Situation strip */}
      <SituationStrip />

      {/* Today's Focus + Intel side by side on large screens */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TodaysFocus />
        <IntelHighlights />
      </div>

      {/* Quick Ask */}
      <QuickAsk />

    </div>
  );
}
