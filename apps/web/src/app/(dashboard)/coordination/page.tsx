"use client";

export const dynamic = "force-dynamic";

import { useCoordStatus, useCoordFile } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  PageHeaderActions,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Skeleton } from "@clawe/ui/components/skeleton";
import {
  RefreshCw,
  GitBranch,
  User,
  FileText,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  ChevronRight,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | number | null): string {
  if (!iso) return "—";
  const ms = typeof iso === "number" ? (iso > 1e12 ? iso : iso * 1000) : new Date(iso).getTime();
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function healthColor(h: string) {
  if (h === "green") return "bg-emerald-500 text-white";
  if (h === "yellow") return "bg-yellow-500 text-white";
  return "bg-red-500 text-white";
}

// ─── Lightweight markdown renderer ───────────────────────────────────────────

function Markdown({ content }: { content: string }) {
  const html = content
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2 class='text-base font-semibold mt-4 mb-1'>$2</h2>")
    .replace(/^### (.+)$/gm, "<h3 class='text-sm font-semibold mt-3 mb-1'>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-xs font-mono'>$1</code>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm'>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-2 pl-3 italic text-muted-foreground text-sm my-1'>$1</blockquote>")
    .replace(/^---$/gm, "<hr class='border-border my-3' />")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── File viewer panel ────────────────────────────────────────────────────────

function FilePanel({ relPath, onClose }: { relPath: string; onClose: () => void }) {
  const { data, isLoading } = useCoordFile(relPath);
  return (
    <div className="fixed inset-y-0 right-0 w-[48rem] max-w-full bg-background border-l shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-mono text-muted-foreground">{relPath}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        ) : data?.content ? (
          <Markdown content={data.content} />
        ) : (
          <p className="text-muted-foreground text-sm italic">File not found or empty.</p>
        )}
      </div>
    </div>
  );
}

// ─── File list ────────────────────────────────────────────────────────────────

function FileList({
  files,
  prefix,
  onSelect,
  selected,
}: {
  files: string[];
  prefix: string;
  onSelect: (path: string) => void;
  selected: string | null;
}) {
  if (files.length === 0) return <p className="text-sm text-muted-foreground italic px-2">No files.</p>;
  return (
    <div className="space-y-1">
      {files.map((f) => {
        const relPath = `${prefix}/${f}`;
        const isSelected = selected === relPath;
        return (
          <button
            key={f}
            onClick={() => onSelect(relPath)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <span className="truncate font-mono text-xs">{f}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
          </button>
        );
      })}
    </div>
  );
}

// ─── Søren status card ────────────────────────────────────────────────────────

function SorenStatusCard({ status }: { status: import("@/lib/api/local").CoordSorenStatus }) {
  const hbTime = status.timestamp ? timeAgo(status.timestamp) : "—";
  const metrics = status.machine_metrics;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <CardTitle className="text-base">Søren</CardTitle>
              <p className="text-xs text-muted-foreground">Strategist</p>
            </div>
          </div>
          <Badge className={healthColor(status.health)}>{status.health}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Last heartbeat: {hbTime}
          {status.next_heartbeat && <span className="ml-1 opacity-60">· next {timeAgo(status.next_heartbeat)}</span>}
        </div>

        {status.active_tasks.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Active</p>
            {status.active_tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        )}

        {status.blockers.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {status.blockers[0]}
          </div>
        )}

        {metrics && (
          <div className="rounded-lg bg-muted/50 p-2.5 space-y-1 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground mb-1.5">
              <Server className="w-3 h-3" /> {metrics.hostname as string}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>Disk free <strong className="text-foreground">{metrics.disk_free as string}</strong></span>
              <span>Disk used <strong className="text-foreground">{metrics.disk_used_pct as string}</strong></span>
              <span>Mem free <strong className="text-foreground">{metrics.mem_free_mb as number}MB</strong></span>
              <span>Uptime <strong className="text-foreground">{metrics.uptime as string}</strong></span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

type Tab = "sync" | "daily" | "outbox";

export default function CoordinationPage() {
  const { data, isLoading, mutate } = useCoordStatus();
  const [activeTab, setActiveTab] = useState<Tab>("sync");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count: number }> = [
    { id: "sync", label: "Sync Notes", icon: <GitBranch className="w-3.5 h-3.5" />, count: data?.syncFiles.length ?? 0 },
    { id: "daily", label: "Søren's Daily", icon: <User className="w-3.5 h-3.5" />, count: data?.sorenDailyFiles.length ?? 0 },
    { id: "outbox", label: "Aurel Outbox", icon: <Inbox className="w-3.5 h-3.5" />, count: data?.aurelOutbox.length ?? 0 },
  ];

  const currentFiles = useMemo(() => {
    if (!data) return [];
    if (activeTab === "sync") return data.syncFiles;
    if (activeTab === "daily") return data.sorenDailyFiles;
    return data.aurelOutbox;
  }, [data, activeTab]);

  const currentPrefix = activeTab === "sync" ? "sync" : activeTab === "daily" ? "soren/daily" : "aurel/outbox";

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Coordination</PageHeaderTitle>
          <PageHeaderActions>
            <div className="flex items-center gap-3">
              {data && (
                <span className="text-xs text-muted-foreground font-mono">
                  {data.pullResult === "Already up to date." ? "✓ up to date" : data.pullResult}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Pull &amp; Refresh
              </Button>
            </div>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 mt-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-2">

          {/* Left column */}
          <div className="space-y-4">
            {/* Søren status */}
            {data?.sorenStatus ? (
              <SorenStatusCard status={data.sorenStatus} />
            ) : (
              <Card className="p-4 text-sm text-muted-foreground">No status file.</Card>
            )}

            {/* Git log */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4" /> Recent commits
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {(data?.gitLog ?? []).map((c) => (
                  <div key={c.hash} className="text-xs flex gap-2 items-start">
                    <span className="font-mono text-muted-foreground shrink-0">{c.hash}</span>
                    <span className="truncate">{c.msg}</span>
                    <span className="text-muted-foreground shrink-0">{c.date}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Write capability box */}
            <Card className="border-dashed">
              <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> Søren write access
                </p>
                <p>Søren can POST directly to CLAWE via Tailscale:</p>
                <code className="block bg-muted rounded p-2 font-mono text-[10px] leading-relaxed break-all">
                  POST http://100.117.151.74:3001/api/coordination/sync
                  <br />{"{"} "from": "soren", "message": "..." {"}"}
                </code>
                <p>Or push status heartbeat:</p>
                <code className="block bg-muted rounded p-2 font-mono text-[10px] leading-relaxed break-all">
                  POST /api/agents/soren/heartbeat
                  <br />{"{"} "health": "green", "active_tasks": [...] {"}"}
                </code>
              </CardContent>
            </Card>
          </div>

          {/* Right 2 columns — file browser */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 border-b pb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeTab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.icon}
                  {t.label}
                  <span className={`text-xs ${activeTab === t.id ? "opacity-70" : "opacity-50"}`}>({t.count})</span>
                </button>
              ))}
            </div>

            {/* File list */}
            <Card>
              <CardContent className="p-3">
                <FileList
                  files={currentFiles}
                  prefix={currentPrefix}
                  onSelect={setSelectedFile}
                  selected={selectedFile}
                />
              </CardContent>
            </Card>

            {/* Preview the most recent file inline */}
            {!selectedFile && currentFiles[0] && (
              <QuickPreview relPath={`${currentPrefix}/${currentFiles[0]}`} />
            )}
          </div>
        </div>
      )}

      {/* Slide-in file panel */}
      {selectedFile && (
        <FilePanel relPath={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </>
  );
}

// ─── inline preview of latest file ───────────────────────────────────────────

function QuickPreview({ relPath }: { relPath: string }) {
  const { data, isLoading } = useCoordFile(relPath);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> {relPath}
          <span className="ml-auto text-[10px] opacity-50">(latest)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div>
        ) : data?.content ? (
          <Markdown content={data.content} />
        ) : null}
      </CardContent>
    </Card>
  );
}
