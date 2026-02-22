"use client";

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
} from "lucide-react";
import { useSystemHealth, useRecentIntel, useProjects } from "@/lib/api/local";

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

export default function HomePage() {
  const { data: healthData } = useSystemHealth();
  const { data: intelData } = useRecentIntel();
  const { data: projectsData } = useProjects();

  const runningProjects = projectsData?.projects?.filter((p) => p.running) || [];

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
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <a
                      href={`http://localhost:${project.port}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground"
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
                href="http://localhost:3016"
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
                href="http://localhost:3007"
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
