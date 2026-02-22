"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { mutate } from "swr";
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
  type Project 
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
} from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startupLogs, setStartupLogs] = useState<Record<string, string[]>>({});
  const [logConnections, setLogConnections] = useState<Record<string, EventSource>>({});

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

  // Separate planned projects
  const availableProjects = data?.projects.filter((p) => p.status !== 'planned') || [];
  const plannedProjects = data?.projects.filter((p) => p.status === 'planned') || [];

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
