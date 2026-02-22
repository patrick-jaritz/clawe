"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@clawe/ui/components/command";
import {
  Home,
  SquareKanban,
  Brain,
  LayoutGrid,
  Settings,
  Play,
  ExternalLink,
  Database,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useProjects } from "@/lib/api/local";
import { notify } from "@/lib/toast";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { data: projectsData } = useProjects();

  // ⌘K / Ctrl+K to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runAction = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const openProject = (projectId: string) => {
    const project = projectsData?.projects.find((p) => p.id === projectId);
    if (!project) return;

    if (project.running) {
      window.open(`http://localhost:${project.port}`, "_blank");
    } else {
      notify.info(`${project.name} is not running. Start it from the Projects page.`);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, projects, or navigate..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAction(() => navigateTo("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/board"))}>
            <SquareKanban className="mr-2 h-4 w-4" />
            <span>Board</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/intelligence"))}>
            <Brain className="mr-2 h-4 w-4" />
            <span>Intelligence</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/projects"))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {projectsData?.projects && projectsData.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projectsData.projects
              .filter((p) => p.status === "available")
              .map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => runAction(() => openProject(project.id))}
                >
                  {project.running ? (
                    <ExternalLink className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Play className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{project.name}</span>
                  {project.running && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      :{project.port}
                    </span>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAction(() => navigateTo("/intelligence"))}>
            <Database className="mr-2 h-4 w-4" />
            <span>Run Ingestion</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/business/dba"))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Open DBA Assistant</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => navigateTo("/business/bac"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Open BAC</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
