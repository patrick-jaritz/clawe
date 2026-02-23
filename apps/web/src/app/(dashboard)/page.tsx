"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
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
} from "lucide-react";
import { useSystemHealth, useRecentIntel, useProjects, useAgents, useAgentSSE, useMachines } from "@/lib/api/local";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
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
    case "gmail":
      return <Mail className="h-4 w-4" />;
    case "github":
      return <Github className="h-4 w-4" />;
    case "reddit":
    case "twitter":
      return <MessageCircle className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

// DBA papers deadline: end of March 2026
const DBA_DEADLINE = new Date("2026-03-31T23:59:00");
const DBA_PAPERS = ["Paper 1: Innovation & Technology", "Paper 2: Leadership", "Paper 3: Strategy"];

function getDbaCountdown() {
  const now = new Date();
  const diff = DBA_DEADLINE.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, urgent: true, overdue: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, urgent: days <= 14, overdue: false };
}

export default function HomePage() {
  const { data: healthData } = useSystemHealth();
  const { data: intelData } = useRecentIntel();
  const { data: projectsData } = useProjects();
  const { data: agentsData } = useAgents();
  const { data: machinesData } = useMachines();
  useAgentSSE();

  const runningProjects = projectsData?.projects?.filter((p) => p.running) || [];
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

  const needsAttentionAgents = (agentsData ?? []).filter((a) => {
    if (!a.needsAttention) return false;
    if (Array.isArray(a.needsAttention)) return a.needsAttention.length > 0;
    return true;
  });

  const dba = getDbaCountdown();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, Patrick
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate()}</p>
        </div>
      </div>

      {/* Needs Attention Banner */}
      {needsAttentionAgents.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttentionAgents.map((agent) => (
              <div key={agent._id} className="flex items-start gap-3">
                <span className="text-lg">{agent.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {agent.name}
                  </p>
                  {Array.isArray(agent.needsAttention) && agent.needsAttention.length > 0 ? (
                    <ul className="mt-0.5 space-y-0.5">
                      {agent.needsAttention.map((item, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Review required
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Grid: System Health + Running Projects */}
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
                    Next ingest: <span className="font-medium">{healthData.next_ingest}</span>
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
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-green-600 text-green-600" />
                      <span className="font-medium text-sm">{project.name}</span>
                    </div>
                    <a
                      href={`http://${hostname}:${project.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground font-mono"
                    >
                      :{project.port} ↗
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

      {/* DBA Deadline Countdown */}
      <Card className={dba.urgent ? "border-orange-300 dark:border-orange-700" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              DBA Papers Deadline
            </CardTitle>
            <Badge variant={dba.overdue ? "destructive" : dba.urgent ? "secondary" : "outline"}
              className={dba.urgent && !dba.overdue ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" : ""}>
              {dba.overdue ? "OVERDUE" : `${dba.days}d ${dba.hours}h left`}
            </Badge>
          </div>
          <CardDescription>End of March 2026 · 3 papers required</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {DBA_PAPERS.map((paper, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span>{paper}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Deadline: 31 March 2026 ·{" "}
            <a href={`http://${hostname}:3016`} target="_blank" rel="noopener noreferrer"
              className="text-pink-600 hover:underline">
              Open DBA Assistant →
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Infrastructure / Machines */}
      {machinesData && machinesData.machines.some((m) => m.metrics) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Infrastructure</CardTitle>
            <CardDescription>Machine health across the network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {machinesData.machines.map((machine) => (
                <div key={machine.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{machine.emoji}</span>
                      <span className="font-medium text-sm">{machine.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {machine.metrics?.hostname ?? machine.id}
                    </span>
                  </div>
                  {machine.metrics ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Disk free: <span className="text-foreground font-medium">{machine.metrics.disk_free ?? "—"}</span></span>
                      <span>Used: <span className="text-foreground font-medium">{machine.metrics.disk_used_pct ?? "—"}</span></span>
                      <span>Load: <span className="text-foreground font-medium">{machine.metrics.load_avg_1m ?? "—"}</span></span>
                      <span>Mem free: <span className="text-foreground font-medium">{machine.metrics.mem_free_mb ? `${machine.metrics.mem_free_mb} MB` : "—"}</span></span>
                      <span className="col-span-2">Uptime: <span className="text-foreground font-medium">{machine.metrics.uptime ?? "—"}</span></span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No metrics pushed yet</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Intelligence</CardTitle>
          <CardDescription>Latest 5 ingested chunks</CardDescription>
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump to common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <Button variant="outline" asChild>
              <Link href="/board" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span>Board</span>
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/intelligence" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span>Intelligence</span>
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/projects" className="flex items-center gap-2">
                <Rocket className="h-4 w-4" />
                <span>Projects</span>
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <a
                href={`http://${hostname}:3016`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span>DBA Paper</span>
              </a>
            </Button>

            <Button variant="outline" asChild>
              <a
                href={`http://${hostname}:3007`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <CheckSquare className="h-4 w-4" />
                <span>BAC Run</span>
              </a>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/board" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span>New Task</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
