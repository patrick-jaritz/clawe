"use client";

import { useState } from "react";
import { mutate } from "swr";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  PageHeaderDescription,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { useProjects, startProject, stopProject } from "@/lib/api/local";
import { Play, Square, ExternalLink, X, Monitor } from "lucide-react";

const ProjectsPage = () => {
  const { data, error } = useProjects();
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<string | null>(null);

  const handleStart = async (id: string) => {
    setStarting(id);
    try {
      await startProject(id);
      // Poll for status update
      setTimeout(() => {
        mutate("/api/projects");
      }, 2000);
    } catch (err) {
      console.error("Failed to start project:", err);
      alert(`Failed to start project: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setStarting(null);
    }
  };

  const handleStop = async (id: string) => {
    setStopping(id);
    try {
      await stopProject(id);
      mutate("/api/projects");
    } catch (err) {
      console.error("Failed to stop project:", err);
      alert(`Failed to stop project: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setStopping(null);
    }
  };

  const getStatusBadge = (status: string, running: boolean) => {
    if (status === 'planned') {
      return (
        <Badge variant="outline" className="gap-1.5">
          🔜 Planned
        </Badge>
      );
    }
    if (status === 'no-ui') {
      return (
        <Badge variant="outline" className="gap-1.5">
          🚫 No UI
        </Badge>
      );
    }
    if (running) {
      return (
        <Badge variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700">
          🟢 Running
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1.5">
        ⚫ Stopped
      </Badge>
    );
  };

  const previewProjectData = data?.projects.find((p) => p.id === previewProject);

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <div>
            <PageHeaderTitle>Projects</PageHeaderTitle>
            <PageHeaderDescription>
              Web app launcher and preview hub
            </PageHeaderDescription>
          </div>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-6">
        {/* Projects Grid */}
        {error ? (
          <Card className="p-4">
            <p className="text-destructive">Failed to load projects.</p>
          </Card>
        ) : !data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.projects.map((project) => (
              <Card key={project.id} className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold">{project.name}</h3>
                    {getStatusBadge(project.status, project.running)}
                  </div>

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

                  {/* Description */}
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>

                  {/* Port (when running) */}
                  {project.running && (
                    <p className="text-xs text-muted-foreground font-mono">
                      :{project.port}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {project.status === 'available' && !project.running && (
                      <Button
                        size="sm"
                        onClick={() => handleStart(project.id)}
                        disabled={starting === project.id}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        {starting === project.id ? "Starting..." : "Start"}
                      </Button>
                    )}

                    {project.status === 'available' && project.running && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStop(project.id)}
                          disabled={stopping === project.id}
                        >
                          <Square className="mr-1.5 h-3.5 w-3.5" />
                          {stopping === project.id ? "Stopping..." : "Stop"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a
                            href={`http://localhost:${project.port}`}
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
                          onClick={() => setPreviewProject(project.id)}
                        >
                          <Monitor className="mr-1.5 h-3.5 w-3.5" />
                          Preview
                        </Button>
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
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Preview Panel */}
        {previewProject && previewProjectData && (
          <Card className="relative overflow-hidden">
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {previewProjectData.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  http://100.117.151.74:{previewProjectData.port}
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
              src={`http://100.117.151.74:${previewProjectData.port}`}
              className="w-full border-0"
              style={{ height: "600px" }}
              title={`Preview of ${previewProjectData.name}`}
            />
          </Card>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;
