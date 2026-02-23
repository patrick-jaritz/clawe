"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { mutate } from "swr";
import { cn } from "@clawe/ui/lib/utils";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { 
  useProjects, 
  startProject, 
  stopProject, 
  getProjectStatus,
  projectLogsUrl,
  saveProjectNotes,
  setProjectAutoRestart,
  rebuildProject,
  searchProjectLogs,
  getProjectEnv,
  type Project,
  type EnvVar,
} from "@/lib/api/local";
import { 
  Play, 
  Square, 
  ExternalLink, 
  X, 
  Monitor, 
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Search,
  StickyNote,
  RefreshCw,
  AlertTriangle,
  Activity,
  GitBranch,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Input } from "@clawe/ui/components/input";

type CategoryKey = 'byl' | 'tools' | 'intelligence' | 'external';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  byl: "BYL Ecosystem",
  tools: "Tools",
  intelligence: "Intelligence",
  external: "External / Research",
};

const ProjectsPage = () => {
  const { data, error } = useProjects();
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [confirmingStop, setConfirmingStop] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [logViewProject, setLogViewProject] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [logConnection, setLogConnection] = useState<EventSource | null>(null);
  const logBottomRef = React.useRef<HTMLDivElement>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startupLogs, setStartupLogs] = useState<Record<string, string[]>>({});
  const [logConnections, setLogConnections] = useState<Record<string, EventSource>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [notesExpanded, setNotesExpanded] = useState<Record<string, boolean>>({});
  const [togglingRestart, setTogglingRestart] = useState<string | null>(null);
  const [rebuildLogs, setRebuildLogs] = useState<Record<string, string[]>>({});
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState<Record<string, string>>({});
  const [logSearchResults, setLogSearchResults] = useState<Record<string, string[]>>({});
  const [envData, setEnvData] = useState<Record<string, EnvVar[]>>({});
  const [envExpanded, setEnvExpanded] = useState<Record<string, boolean>>({});
  const [envRevealed, setEnvRevealed] = useState<Record<string, boolean>>({});

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setErrors({});
    }, 5000);
    return () => clearTimeout(timer);
  }, [errors]);

  // Auto-clear stop confirmation after 3 seconds
  useEffect(() => {
    if (confirmingStop) {
      const timer = setTimeout(() => {
        setConfirmingStop(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingStop]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  // Open log stream for a running project
  const openLogs = (id: string) => {
    // Close existing
    if (logConnection) { logConnection.close(); setLogConnection(null); }
    setLiveLogs([]);
    setLogViewProject(id);

    const url = projectLogsUrl(id);
    const es = new EventSource(url);
    es.onmessage = (event) => {
      setLiveLogs((prev) => [...prev, event.data].slice(-200));
    };
    es.onerror = () => es.close();
    setLogConnection(es);
  };

  const closeLogs = () => {
    logConnection?.close();
    setLogConnection(null);
    setLogViewProject(null);
    setLiveLogs([]);
  };

  // Mobile detection
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const setError = (id: string, message: string) => {
    setErrors((prev) => ({ ...prev, [id]: message }));
  };

  const connectToLogs = (id: string) => {
    // Close existing connection
    if (logConnections[id]) {
      logConnections[id].close();
    }

    const url = projectLogsUrl(id);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const line = event.data;
      setStartupLogs((prev) => {
        const logs = prev[id] || [];
        const updated = [...logs, line];
        // Keep only last 8 lines
        return { ...prev, [id]: updated.slice(-8) };
      });
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLogConnections((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    };

    setLogConnections((prev) => ({ ...prev, [id]: eventSource }));
  };

  const disconnectLogs = (id: string) => {
    if (logConnections[id]) {
      logConnections[id].close();
      setLogConnections((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }
    setStartupLogs((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleStart = async (id: string) => {
    setStarting(id);
    setStartupLogs((prev) => ({ ...prev, [id]: [] }));

    try {
      // Connect to logs
      connectToLogs(id);

      await startProject(id);

      // Poll for status until running or timeout
      const startTime = Date.now();
      const pollInterval = setInterval(async () => {
        try {
          const status = await getProjectStatus(id);
          if (status.running) {
            clearInterval(pollInterval);
            disconnectLogs(id);
            setStarting(null);
            mutate("/api/projects");
          } else if (Date.now() - startTime > 60000) {
            // 60s timeout
            clearInterval(pollInterval);
            disconnectLogs(id);
            setStarting(null);
            setError(id, "Startup timeout - check logs");
          }
        } catch (err) {
          // Continue polling on error
        }
      }, 3000);

      // Cleanup on unmount
      return () => {
        clearInterval(pollInterval);
        disconnectLogs(id);
      };
    } catch (err) {
      console.error("Failed to start project:", err);
      setError(id, `Failed to start: ${err instanceof Error ? err.message : "Unknown error"}`);
      disconnectLogs(id);
      setStarting(null);
    }
  };

  const handleStopClick = (id: string) => {
    setConfirmingStop(id);
  };

  const handleStopConfirm = async (id: string) => {
    setStopping(id);
    setConfirmingStop(null);
    try {
      await stopProject(id);
      mutate("/api/projects");
    } catch (err) {
      console.error("Failed to stop project:", err);
      setError(id, `Failed to stop: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setStopping(null);
    }
  };

  const handleStopCancel = () => {
    setConfirmingStop(null);
  };

  const handlePreview = (id: string, port: number) => {
    if (isMobile) {
      // Open in new tab on mobile
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      window.open(`http://${hostname}:${port}`, '_blank');
    } else {
      setPreviewProject(id);
    }
  };

  const getStatusDot = (status: string, running: boolean) => {
    if (status === 'planned') {
      return <span className="h-2 w-2 rounded-full bg-blue-500" />;
    }
    if (running) {
      return (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      );
    }
    return <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />;
  };

  // Group projects by category
  const groupedProjects = data?.projects.reduce((acc, project) => {
    const category = project.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(project);
    return acc;
  }, {} as Record<CategoryKey, Project[]>);

  // Separate planned projects (with search filter)
  const searchLower = projectSearch.toLowerCase();
  const matchesSearch = (p: Project) =>
    !searchLower ||
    p.name.toLowerCase().includes(searchLower) ||
    (p.techStack ?? []).some((t) => t.toLowerCase().includes(searchLower)) ||
    (p.description ?? "").toLowerCase().includes(searchLower);

  const availableProjects = (data?.projects.filter((p) => p.status !== 'planned') || []).filter(matchesSearch);
  const plannedProjects = (data?.projects.filter((p) => p.status === 'planned') || []).filter(matchesSearch);

  const runningCount = data?.projects.filter((p) => p.running).length || 0;

  const previewProjectData = data?.projects.find((p) => p.id === previewProject);

  const renderProjectCard = (project: Project) => {
    const isStarting = starting === project.id;
    const isStopping = stopping === project.id;
    const isConfirming = confirmingStop === project.id;
    const hasError = errors[project.id];
    const logs = startupLogs[project.id] || [];
    const showLogs = isStarting && logs.length > 0;

    if (compactMode) {
      // Compact mode: single row
      return (
        <div
          key={project.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 transition-colors",
            "hover:bg-muted/50"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusDot(project.status, project.running)}
            <span className="font-medium truncate">{project.name}</span>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            :{project.port}
          </span>

          <div className="flex items-center gap-2">
            {project.status === 'available' && !project.running && (
              <Button
                size="sm"
                onClick={() => handleStart(project.id)}
                disabled={isStarting}
                className="h-7"
              >
                {isStarting ? "Starting..." : "Start"}
              </Button>
            )}

            {project.status === 'available' && project.running && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStopClick(project.id)}
                disabled={isStopping}
                className="h-7"
              >
                {isStopping ? "Stopping..." : "Stop"}
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Expanded mode: full card
    return (
      <Card key={project.id} className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              {getStatusDot(project.status, project.running)}
              <h3 className="font-semibold">{project.name}</h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              :{project.port}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>

          {/* Tech Stack */}
          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <Badge
                key={tech}
                variant="secondary"
                className="text-xs text-muted-foreground"
              >
                {tech}
              </Badge>
            ))}
          </div>

          {/* Error Message */}
          {hasError && (
            <p className="text-xs text-destructive">{hasError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {project.status === 'available' && !project.running && (
              <Button
                size="sm"
                onClick={() => handleStart(project.id)}
                disabled={isStarting}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {isStarting ? "Starting..." : "Start"}
              </Button>
            )}

            {project.status === 'available' && project.running && (
              <>
                {isConfirming ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStopConfirm(project.id)}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStopCancel}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStopClick(project.id)}
                      disabled={isStopping}
                    >
                      <Square className="mr-1.5 h-3.5 w-3.5" />
                      {isStopping ? "Stopping..." : "Stop"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a
                        href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${project.port}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Open
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(project.id, project.port)}
                    >
                      <Monitor className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLogs(project.id)}
                    >
                      <Terminal className="mr-1.5 h-3.5 w-3.5" />
                      Logs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rebuilding === project.id}
                      onClick={() => {
                        setRebuilding(project.id);
                        setRebuildLogs((p) => ({ ...p, [project.id]: [] }));
                        const es = rebuildProject(project.id);
                        es.onmessage = (e) => setRebuildLogs((p) => ({ ...p, [project.id]: [...(p[project.id] ?? []), e.data].slice(-30) }));
                        es.onerror = () => { es.close(); setRebuilding(null); mutate("/api/projects"); };
                      }}
                    >
                      <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                      {rebuilding === project.id ? "Building..." : "Rebuild"}
                    </Button>
                  </>
                )}
              </>
            )}

            {project.status === 'no-ui' && (
              <Badge variant="outline" className="text-muted-foreground">
                No web UI
              </Badge>
            )}

            {project.status === 'planned' && (
              <Badge variant="outline" className="text-muted-foreground">
                Coming soon
              </Badge>
            )}
          </div>

          {/* Startup Logs Panel */}
          {showLogs && (
            <div className="mt-2 rounded-md bg-black/80 p-3 font-mono text-xs text-green-400">
              <div className="space-y-0.5">
                {logs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* Health + Crash status */}
          {project.running && (
            <div className="flex items-center gap-3 text-xs">
              {project.health != null ? (
                project.health.ok ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                    {project.health.latencyMs != null && (
                      <span className="text-muted-foreground ml-1">{project.health.latencyMs}ms</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> Unhealthy
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /> Checking...
                </span>
              )}
              {(project.crashCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-orange-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {project.crashCount} crash{project.crashCount !== 1 ? "es" : ""}
                </span>
              )}
            </div>
          )}

          {/* Auto-restart toggle */}
          {project.status === 'available' && (
            <div className="flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Auto-restart on crash
              </div>
              <button
                disabled={togglingRestart === project.id}
                onClick={async () => {
                  setTogglingRestart(project.id);
                  try {
                    const newVal = !(project.autoRestart ?? false);
                    await setProjectAutoRestart(project.id, newVal);
                    mutate("/api/projects");
                  } catch { /* ignore */ }
                  setTogglingRestart(null);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                  project.autoRestart ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  project.autoRestart ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="border-t pt-2">
            <button
              onClick={() => setNotesExpanded((p) => ({ ...p, [project.id]: !p[project.id] }))}
              className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Notes
              {project.notes && !notesExpanded[project.id] && (
                <span className="ml-1 truncate text-foreground/70 max-w-[200px]">{project.notes.split('\n')[0]}</span>
              )}
            </button>
            {notesExpanded[project.id] && (
              <textarea
                className="mt-2 w-full resize-none rounded border bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-ring min-h-[60px]"
                placeholder="Deployment commands, env gotchas, reminders..."
                value={notesDraft[project.id] ?? (project.notes || "")}
                onChange={(e) => setNotesDraft((p) => ({ ...p, [project.id]: e.target.value }))}
                onBlur={async () => {
                  const val = notesDraft[project.id] ?? (project.notes || "");
                  try {
                    await saveProjectNotes(project.id, val);
                    mutate("/api/projects");
                  } catch { /* ignore */ }
                }}
              />
            )}
          </div>
          {/* Rebuild log output */}
          {(rebuildLogs[project.id] ?? []).length > 0 && (
            <div className="rounded-md bg-black/80 p-3 font-mono text-xs text-green-400 space-y-0.5">
              {(rebuildLogs[project.id] ?? []).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}

          {/* Log search */}
          {project.running && (
            <div className="border-t pt-2 space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    className="w-full rounded border bg-background pl-7 pr-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Search logs..."
                    value={logSearch[project.id] ?? ""}
                    onChange={(e) => setLogSearch((p) => ({ ...p, [project.id]: e.target.value }))}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        try {
                          const r = await searchProjectLogs(project.id, logSearch[project.id] ?? "");
                          setLogSearchResults((p) => ({ ...p, [project.id]: r.results }));
                        } catch { /* ok */ }
                      }
                    }}
                  />
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground px-2"
                  onClick={async () => {
                    try {
                      const r = await searchProjectLogs(project.id, logSearch[project.id] ?? "");
                      setLogSearchResults((p) => ({ ...p, [project.id]: r.results }));
                    } catch { /* ok */ }
                  }}
                >Search</button>
              </div>
              {(logSearchResults[project.id] ?? []).length > 0 && (
                <div className="rounded bg-muted p-2 font-mono text-xs space-y-0.5 max-h-32 overflow-auto">
                  {(logSearchResults[project.id] ?? []).map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}
            </div>
          )}

          {/* .env viewer */}
          <div className="border-t pt-2">
            <button
              onClick={async () => {
                const next = !envExpanded[project.id];
                setEnvExpanded((p) => ({ ...p, [project.id]: next }));
                if (next && !envData[project.id]) {
                  try {
                    const r = await getProjectEnv(project.id, envRevealed[project.id]);
                    setEnvData((p) => ({ ...p, [project.id]: r.vars }));
                  } catch { /* ok */ }
                }
              }}
              className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              .env
              {(envData[project.id] ?? []).length > 0 && !envExpanded[project.id] && (
                <span className="text-muted-foreground">{(envData[project.id] ?? []).length} vars</span>
              )}
            </button>
            {envExpanded[project.id] && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-end">
                  <button
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                    onClick={async () => {
                      const next = !envRevealed[project.id];
                      setEnvRevealed((p) => ({ ...p, [project.id]: next }));
                      try {
                        const r = await getProjectEnv(project.id, next);
                        setEnvData((p) => ({ ...p, [project.id]: r.vars }));
                      } catch { /* ok */ }
                    }}
                  >
                    {envRevealed[project.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {envRevealed[project.id] ? "Hide" : "Reveal"}
                  </button>
                </div>
                {(envData[project.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No .env file found</p>
                ) : (
                  <div className="rounded border font-mono text-xs overflow-hidden">
                    {(envData[project.id] ?? []).map((v) => (
                      <div key={v.key} className="flex gap-2 px-2 py-1 odd:bg-muted/30">
                        <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">{v.key}</span>
                        <span className="text-muted-foreground truncate">{v.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <div>
            <PageHeaderTitle>Projects</PageHeaderTitle>
            <p className="text-sm text-muted-foreground">
              Web app launcher and preview hub
            </p>
          </div>

          <div className="flex items-center gap-2">
            {runningCount > 0 && (
              <Badge variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700">
                {runningCount} running ●
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompactMode(!compactMode)}
            >
              {compactMode ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </PageHeaderRow>
      </PageHeader>

      {/* Search / filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects by name, tech, or description..."
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {projectSearch && (
          <button
            onClick={() => setProjectSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* Loading State */}
        {!data && !error && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-4">
            <p className="text-destructive">Failed to load projects.</p>
          </Card>
        )}

        {/* Projects by Category */}
        {groupedProjects && (
          <>
            {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((category) => {
              const projects = groupedProjects[category]?.filter((p) => p.status !== 'planned') || [];
              if (projects.length === 0) return null;

              return (
                <div key={category} className="space-y-4">
                  <h2 className="text-lg font-semibold">
                    {CATEGORY_LABELS[category]}
                  </h2>
                  <div className={cn(
                    compactMode ? "space-y-2" : "grid gap-4 lg:grid-cols-2"
                  )}>
                    {projects.map(renderProjectCard)}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Coming Soon Section */}
        {plannedProjects.length > 0 && (
          <div className="space-y-4">
            <button
              onClick={() => setShowComingSoon(!showComingSoon)}
              className="flex items-center gap-2 text-lg font-semibold hover:text-muted-foreground transition-colors"
            >
              Coming Soon
              {showComingSoon ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showComingSoon && (
              <div className={cn(
                compactMode ? "space-y-2" : "grid gap-4 lg:grid-cols-2"
              )}>
                {plannedProjects.map(renderProjectCard)}
              </div>
            )}
          </div>
        )}

        {/* Log Viewer Panel */}
        {logViewProject && (
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 bg-background border-l shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b p-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {data?.projects.find((p) => p.id === logViewProject)?.name ?? logViewProject} — Logs
                </span>
                <span className="text-xs text-muted-foreground">
                  ({liveLogs.length} lines)
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={closeLogs}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto bg-black p-3 font-mono text-xs text-green-400">
              {liveLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Waiting for logs...
                </p>
              ) : (
                <div className="space-y-0.5">
                  {liveLogs.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        line.includes("[ERROR]") && "text-red-400",
                        line.includes("warn") && "text-yellow-400",
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
              <div ref={logBottomRef} />
            </div>
          </div>
        )}

        {/* Split Preview Panel */}
        {previewProject && previewProjectData && !isMobile && (
          <div className="fixed right-0 top-0 bottom-0 w-1/2 z-50 bg-background border-l shadow-lg">
            <div className="flex items-center justify-between border-b p-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {previewProjectData.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  :{previewProjectData.port}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewProject(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <iframe
              src={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${previewProjectData.port}`}
              className="w-full h-[calc(100%-49px)] border-0"
              title={`Preview of ${previewProjectData.name}`}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;
