"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { mutate } from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Badge } from "@clawe/ui/components/badge";
import {
  Layers,
  Brain,
  Rocket,
  FileText,
  CheckSquare,
  ClipboardList,
  Circle,
  CheckCircle2,
  XCircle,
  Mail,
  Github,
  MessageCircle,
  AlertTriangle,
  Clock,
  Zap,
  CheckCheck,
  Sparkles,
  RefreshCw,
  Send,
  Timer,
  Database,
  Globe,
  Plus,
  Wifi,
  WifiOff,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import {
  ALL_QUICK_ACTIONS,
  getEnabledActionIds,
} from "@/lib/quick-actions-config";
import { useTailscaleStatus, useDBAProgress } from "@/lib/api/local";
import {
  useSystemHealth,
  useRecentIntel,
  useProjects,
  useTasks,
  updateTaskStatus,
  generateDailyDigest,
  askIntel,
  type LocalTask,
} from "@/lib/api/local";
import { cn } from "@clawe/ui/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "1d ago";
    return `${diffDays}d ago`;
  } catch {
    return "recently";
  }
}

function getSourceIcon(source: string) {
  switch (source.toLowerCase()) {
    case "gmail": return <Mail className="h-4 w-4" />;
    case "github": return <Github className="h-4 w-4" />;
    case "reddit":
    case "twitter": return <MessageCircle className="h-4 w-4" />;
    default: return <Circle className="h-4 w-4" />;
  }
}

// ── Deadline helpers ──────────────────────────────────────────────────────────

const DBA_DEADLINE = new Date("2026-03-31T23:59:59+03:00"); // End of March, Jerusalem time

function getDaysUntil(target: Date): number {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getDeadlineColor(days: number): string {
  if (days <= 14) return "text-red-600 dark:text-red-400";
  if (days <= 30) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getDeadlineBg(days: number): string {
  if (days <= 14) return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30";
  if (days <= 30) return "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30";
  return "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30";
}

// ── DBA Countdown Widget ───────────────────────────────────────────────────

function DBACountdownWidget() {
  const { data } = useDBAProgress();
  if (!data) return null;

  const deadline = data.papers[0]?.deadline ?? "2026-03-31";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const total = data.papers.reduce((s, p) => s + p.sections.length, 0);
  const done = data.papers.reduce((s, p) => s + p.sections.filter((x) => x.done).length, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const urgencyColor = days <= 14 ? "text-destructive border-destructive/40 bg-destructive/5"
    : days <= 30 ? "text-orange-500 border-orange-400/40 bg-orange-50/30 dark:bg-orange-950/20"
    : "text-foreground";

  return (
    <Link href="/dba">
      <Card className={cn("p-4 hover:shadow-md transition-shadow cursor-pointer", urgencyColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">DBA Papers</p>
              <p className="text-xs text-muted-foreground">3 papers · due {new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{days}d</p>
            <p className="text-xs text-muted-foreground">{pct}% done</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-current rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>
    </Link>
  );
}

// ── Tailscale Widget ───────────────────────────────────────────────────────

function TailscaleWidget() {
  const { data, error } = useTailscaleStatus();

  if (error || !data) return null; // Silent fail if tailscale not available

  const allDevices = data.self ? [data.self, ...data.peers] : data.peers;
  const online = allDevices.filter((d) => d.online);
  const offline = allDevices.filter((d) => !d.online);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" />
            Tailscale Network
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {online.length}/{allDevices.length} online
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {allDevices.map((d) => (
            <div key={d.id || d.name} className="flex items-center gap-2 text-sm">
              {d.online ? (
                <Wifi className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn("flex-1 truncate", !d.online && "text-muted-foreground")}>
                {d.name || "unnamed"}
                {d.isSelf && <span className="ml-1 text-xs text-muted-foreground">(this device)</span>}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{d.ip}</span>
              {d.os && (
                <span className="text-xs text-muted-foreground hidden sm:inline">{d.os}</span>
              )}
            </div>
          ))}
          {offline.length > 0 && online.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {offline.length} device{offline.length !== 1 ? "s" : ""} offline
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Icon map for quick actions ─────────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, Brain, Rocket, FileText, CheckSquare,
  Layers, Timer, Database, Globe, Plus,
};

// ── Configurable Quick Actions ─────────────────────────────────────────────

function ConfigurableQuickActions({ hostname }: { hostname: string }) {
  const [enabledIds, setEnabledIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setEnabledIds(getEnabledActionIds());
  }, []);

  const actions = ALL_QUICK_ACTIONS.filter((a) => enabledIds.has(a.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to common tasks — or press ⌘K</CardDescription>
          </div>
          <Link href="/settings/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Customize →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {actions.map((action) => {
            const Icon = ACTION_ICON_MAP[action.icon] ?? ClipboardList;
            const href = action.external
              ? `http://${hostname}:${action.href.replace("PORT:", "")}`
              : action.href;
            return (
              <Button key={action.id} variant="outline" size="sm" asChild>
                {action.external ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{action.label}</span>
                  </a>
                ) : (
                  <Link href={href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{action.label}</span>
                  </Link>
                )}
              </Button>
            );
          })}
          {actions.length === 0 && (
            <Link href="/settings/dashboard" className="col-span-full text-sm text-muted-foreground hover:text-foreground">
              No quick actions configured. Click to add →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatUptime(startedAt: number): string {
  const diff = Date.now() - startedAt;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

// ── Quick Ask (Home RAG widget) ───────────────────────────────────────────────

function QuickAsk() {
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [asked, setAsked] = React.useState(false);
  const abortRef = React.useRef<(() => void) | null>(null);

  const handleAsk = () => {
    const q = query.trim();
    if (!q || loading) return;
    setAnswer("");
    setAsked(true);
    setLoading(true);

    const abort = askIntel(q, {
      onSources: () => {},
      onDelta: (text) => setAnswer((prev) => prev + text),
      onDone: () => { setLoading(false); abortRef.current = null; },
      onError: (msg) => { setAnswer(`Error: ${msg}`); setLoading(false); },
    });
    abortRef.current = abort;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Quick Ask
        </CardTitle>
        <CardDescription>Ask your knowledge base · powered by RAG + Claude</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask anything about your knowledge base..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={handleAsk} disabled={!query.trim() || loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {asked && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed min-h-[60px]">
            {answer || (loading && (
              <span className="flex gap-1 text-muted-foreground">
                <span className="animate-bounce">·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </span>
            ))}
            {loading && answer && (
              <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-current" />
            )}
          </div>
        )}
        {!asked && (
          <div className="flex flex-wrap gap-2">
            {["What's in my recent emails?", "Latest GitHub updates?", "BYL progress?"].map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Daily Digest button ───────────────────────────────────────────────────────

function DailyDigestButton() {
  const [brief, setBrief] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [shown, setShown] = React.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateDailyDigest();
      setBrief(result.brief);
      setShown(true);
    } catch {
      setBrief("Failed to generate brief. Check API.");
      setShown(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <><RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="mr-1.5 h-4 w-4" /> Morning Brief</>
        )}
      </Button>
      {shown && brief && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {brief}
        </div>
      )}
    </div>
  );
}

// ── Situation Panel ───────────────────────────────────────────────────────────

function SituationPanel({
  daysLeft,
  runningCount,
  chunkCount,
  lastIngest,
  activeTasks,
}: {
  daysLeft: number;
  runningCount: number;
  chunkCount: number;
  lastIngest?: string;
  activeTasks: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* DBA Deadline */}
      <div className={cn("flex items-center gap-3 rounded-lg border p-4", getDeadlineBg(daysLeft))}>
        <AlertTriangle className={cn("h-5 w-5 flex-shrink-0", getDeadlineColor(daysLeft))} />
        <div>
          <p className={cn("text-lg font-bold leading-none", getDeadlineColor(daysLeft))}>
            {daysLeft} days
          </p>
          <p className="mt-1 text-xs text-muted-foreground">DBA papers due Mar 31</p>
        </div>
      </div>

      {/* Running Projects */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <Zap className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="text-lg font-bold leading-none text-blue-600 dark:text-blue-400">
            {runningCount} running
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeTasks} task{activeTasks !== 1 ? "s" : ""} active
          </p>
        </div>
      </div>

      {/* Intel */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Brain className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div>
          <p className="text-lg font-bold leading-none">{chunkCount} chunks</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lastIngest ? `Last: ${formatTimeAgo(lastIngest)}` : "No ingest yet"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Today's Focus ─────────────────────────────────────────────────────────────

function TodaysFocus({ tasks }: { tasks: LocalTask[] }) {
  const [toggling, setToggling] = React.useState<string | null>(null);

  const activeTasks = tasks
    .filter((t) => t.status !== "done")
    .slice(0, 3);

  const handleDone = async (task: LocalTask) => {
    setToggling(task._id);
    try {
      await updateTaskStatus(task._id, "done");
      mutate("/api/tasks");
    } catch (err) {
      console.error("Failed to mark done:", err);
    } finally {
      setToggling(null);
    }
  };

  if (activeTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCheck className="h-5 w-5 text-green-600" />
            Today's Focus
          </CardTitle>
          <CardDescription>Top tasks to move forward</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            All clear — no active tasks.{" "}
            <Link href="/board" className="font-medium text-pink-600 hover:underline">
              Check the board
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today's Focus
            </CardTitle>
            <CardDescription>Top {activeTasks.length} active tasks</CardDescription>
          </div>
          <Link href="/board">
            <Button variant="ghost" size="sm" className="text-xs">
              Full board →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeTasks.map((task) => (
          <div
            key={task._id}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
          >
            <button
              onClick={() => handleDone(task)}
              disabled={toggling === task._id}
              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-green-600 disabled:opacity-50"
              title="Mark done"
            >
              {toggling === task._id ? (
                <Circle className="h-5 w-5 animate-pulse" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{task.title}</p>
              {task.assignees?.[0] && (
                <p className="text-xs text-muted-foreground">
                  {task.assignees[0].emoji} {task.assignees[0].name}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                "flex-shrink-0 text-xs",
                task.status === "in_progress" && "border-blue-300 text-blue-600",
                task.status === "review" && "border-purple-300 text-purple-600",
                task.status === "inbox" && "border-gray-300 text-gray-500",
              )}
            >
              {task.status === "in_progress" ? "In Progress" :
               task.status === "review" ? "Review" : "Inbox"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: healthData } = useSystemHealth();
  const { data: intelData } = useRecentIntel();
  const { data: projectsData } = useProjects();
  const { data: tasks } = useTasks();
  const [hostname, setHostname] = React.useState("localhost");

  React.useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  const runningProjects = projectsData?.projects?.filter((p) => p.running) || [];
  const activeTasks = tasks?.filter((t) => t.status !== "done") || [];
  const daysLeft = getDaysUntil(DBA_DEADLINE);
  const lastIngestDate = intelData?.chunks?.[0]?.date;
  const chunkCount = healthData?.services?.lancedb?.chunks ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, Patrick
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate()}</p>
        </div>
        <DailyDigestButton />
      </div>

      {/* Situation Panel */}
      <SituationPanel
        daysLeft={daysLeft}
        runningCount={runningProjects.length}
        chunkCount={chunkCount}
        lastIngest={lastIngestDate}
        activeTasks={activeTasks.length}
      />

      {/* Today's Focus */}
      {tasks && <TodaysFocus tasks={tasks} />}

      {/* System Health + Running Projects */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Core services status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthData ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {healthData.services.api.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {healthData.services.api.label}
                    </span>
                  </div>
                  <Badge variant={healthData.services.api.ok ? "default" : "destructive"}>
                    {healthData.services.api.ok ? "Online" : "Offline"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {healthData.services.qdrant.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {healthData.services.qdrant.label}
                    </span>
                  </div>
                  <Badge variant={healthData.services.qdrant.ok ? "default" : "destructive"}>
                    {healthData.services.qdrant.ok ? "Online" : "Offline"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {healthData.services.lancedb.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {healthData.services.lancedb.label}
                    </span>
                  </div>
                  <Badge variant={healthData.services.lancedb.ok ? "default" : "destructive"}>
                    {healthData.services.lancedb.ok
                      ? `${healthData.services.lancedb.chunks} chunks`
                      : "Offline"}
                  </Badge>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Next ingest:{" "}
                    <span className="font-medium">{healthData.next_ingest}</span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Running Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Running Projects ({runningProjects.length})</CardTitle>
            <CardDescription>Currently active project servers</CardDescription>
          </CardHeader>
          <CardContent>
            {runningProjects.length > 0 ? (
              <div className="space-y-2">
                {runningProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className="h-2 w-2 flex-shrink-0 fill-green-600 text-green-600" />
                      <span className="font-medium truncate">{project.name}</span>
                      {project.startedAt && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                          <Timer className="h-3 w-3" />
                          {formatUptime(project.startedAt)}
                        </span>
                      )}
                    </div>
                    <a
                      href={`http://${hostname}:${project.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
                    >
                      :{project.port}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No projects running. Start one from the{" "}
                <Link href="/projects" className="font-medium text-pink-600 hover:underline">
                  Projects
                </Link>{" "}
                page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Intelligence</CardTitle>
          <CardDescription>Latest ingested chunks</CardDescription>
        </CardHeader>
        <CardContent>
          {intelData && intelData.chunks.length > 0 ? (
            <div className="space-y-2">
              {intelData.chunks.map((chunk) => (
                <Link
                  key={chunk.id}
                  href={chunk.url || "/intelligence"}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {getSourceIcon(chunk.source)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-medium leading-none">{chunk.title}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {chunk.source}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(chunk.date)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No intelligence chunks yet. Check back after the next ingestion.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Ask */}
      <QuickAsk />

      {/* Quick Actions */}
      <ConfigurableQuickActions hostname={hostname} />

      {/* DBA Countdown */}
      <DBACountdownWidget />

      {/* Tailscale Network */}
      <TailscaleWidget />
    </div>
  );
}
