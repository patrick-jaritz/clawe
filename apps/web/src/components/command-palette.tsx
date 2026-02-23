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
  GraduationCap,
  BarChart2,
  Loader2,
  Send,
} from "lucide-react";
import { useProjects, askIntel } from "@/lib/api/local";
import { notify } from "@/lib/toast";
import { cn } from "@clawe/ui/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [askMode, setAskMode] = React.useState(false);
  const [askQuery, setAskQuery] = React.useState("");
  const [askAnswer, setAskAnswer] = React.useState("");
  const [askLoading, setAskLoading] = React.useState(false);
  const askInputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<(() => void) | null>(null);

  const router = useRouter();
  const { data: projectsData } = useProjects();

  // ⌘K / Ctrl+K to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset state on close
  React.useEffect(() => {
    if (!open) {
      setInputValue("");
      setAskMode(false);
      setAskQuery("");
      setAskAnswer("");
      setAskLoading(false);
      abortRef.current?.();
    }
  }, [open]);

  // Auto-focus ask input when entering ask mode
  React.useEffect(() => {
    if (askMode) setTimeout(() => askInputRef.current?.focus(), 50);
  }, [askMode]);

  const runAction = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const openProject = (projectId: string) => {
    const project = projectsData?.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.running) {
      window.open(`http://${window.location.hostname}:${project.port}`, "_blank");
    } else {
      notify.info(`${project.name} is not running.`);
    }
  };

  const handleAsk = () => {
    const q = askQuery.trim();
    if (!q || askLoading) return;
    setAskAnswer("");
    setAskLoading(true);
    const abort = askIntel(q, {
      onDelta: (text) => setAskAnswer((prev) => prev + text),
      onDone: () => { setAskLoading(false); abortRef.current = null; },
      onError: (msg) => { setAskAnswer(`Error: ${msg}`); setAskLoading(false); },
      onSources: () => {},
    });
    abortRef.current = abort;
  };

  if (askMode) {
    return (
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-col p-4 gap-3" style={{ minHeight: 200 }}>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={askInputRef}
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk();
                if (e.key === "Escape") setAskMode(false);
              }}
              placeholder="Ask your knowledge base..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button
              onClick={handleAsk}
              disabled={!askQuery.trim() || askLoading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          {(askAnswer || askLoading) && (
            <div className="rounded-md bg-muted p-3 text-sm leading-relaxed max-h-64 overflow-y-auto">
              {askAnswer}
              {askLoading && <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" />}
            </div>
          )}

          {!askAnswer && !askLoading && (
            <p className="text-xs text-muted-foreground">
              Press Enter to ask · Esc to go back
            </p>
          )}

          {askAnswer && !askLoading && (
            <div className="flex gap-2">
              <button
                onClick={() => runAction(() => router.push("/intelligence"))}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open full Intel →
              </button>
              <button
                onClick={() => { setAskAnswer(""); setAskQuery(""); }}
                className="text-xs text-muted-foreground hover:text-foreground ml-auto"
              >
                Ask another
              </button>
            </div>
          )}
        </div>
      </CommandDialog>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search commands, projects, or navigate..."
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAction(() => router.push("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/board"))}>
            <SquareKanban className="mr-2 h-4 w-4" />
            <span>Board</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/intelligence"))}>
            <Brain className="mr-2 h-4 w-4" />
            <span>Intelligence</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/projects"))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/dba"))}>
            <GraduationCap className="mr-2 h-4 w-4" />
            <span>DBA Papers</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/weekly-review"))}>
            <BarChart2 className="mr-2 h-4 w-4" />
            <span>Weekly Review</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Ask Intelligence">
          <CommandItem onSelect={() => setAskMode(true)}>
            <Brain className="mr-2 h-4 w-4 text-purple-500" />
            <span>Ask Intel inline…</span>
            <span className="ml-auto text-xs text-muted-foreground">RAG</span>
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
                    <span className="ml-auto text-xs text-muted-foreground">:{project.port}</span>
                  )}
                </CommandItem>
              ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runAction(() => router.push("/intelligence"))}>
            <Database className="mr-2 h-4 w-4" />
            <span>Run Ingestion</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => router.push("/dba"))}>
            <GraduationCap className="mr-2 h-4 w-4" />
            <span>Open DBA Tracker</span>
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => window.open(`http://${window.location.hostname}:3016`, "_blank"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Open DBA Assistant</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
