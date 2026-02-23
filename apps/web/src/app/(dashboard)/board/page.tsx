"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { mutate } from "swr";
import { cn } from "@clawe/ui/lib/utils";
import { useTasks, updateTaskStatus, createNotionTask } from "@/lib/api/local";
import type { LocalTask } from "@/lib/api/local";
import { Bell } from "lucide-react";
import { Button } from "@clawe/ui/components/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@clawe/ui/components/resizable";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  PageHeaderActions,
} from "@dashboard/page-header";
import {
  KanbanBoard,
  type KanbanTask,
  type KanbanColumnDef,
} from "@/components/kanban";
import { LiveFeed, LiveFeedTitle } from "@/components/live-feed";
import { useDrawer } from "@/providers/drawer-provider";
import { AgentsPanel } from "./_components/agents-panel";
import { NewTaskDialog } from "./_components/new-task-dialog";

// Map priority to Kanban format
function mapPriority(priority?: string): "low" | "medium" | "high" {
  switch (priority) {
    case "urgent":
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

// Map LocalTask to KanbanTask format
function mapTask(task: LocalTask): KanbanTask {
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status as KanbanTask["status"],
    priority: mapPriority(task.priority),
    dueDate: task.dueDate ?? undefined,
    assignee: task.assignees?.[0]
      ? `${task.assignees[0].emoji || ""} ${task.assignees[0].name}`.trim()
      : undefined,
    subtasks: [],
    documentCount: task.documentCount,
  };
}

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

function isValidStatus(status: string): status is TaskStatus {
  return ["inbox", "assigned", "in_progress", "review", "done"].includes(
    status,
  );
}

// Panel sizes in pixels
const COLLAPSED_SIZE = "48px";
const DEFAULT_SIZE = "220px";
const MIN_SIZE = "180px";
const MAX_SIZE = "280px";

const STORAGE_KEY = "board-agents-panel-collapsed";

const getInitialCollapsed = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
};

type AssigneeFilter = "all" | "patrick" | "aurel" | "unassigned";

const BoardPage = () => {
  const { openDrawer } = useDrawer();
  const { data: tasks } = useTasks();
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  // Filter tasks by selected agents AND assignee quick-filter
  const filteredTasks = tasks?.filter((task) => {
    // Agent panel filter (desktop)
    if (selectedAgentIds.length > 0 && !task.assignees?.some((a) => selectedAgentIds.includes(a._id))) {
      return false;
    }
    // Quick assignee filter
    if (assigneeFilter === "unassigned") return !task.assignees?.length;
    if (assigneeFilter === "patrick") {
      return task.assignees?.some((a) => a.name?.toLowerCase().includes("patrick"));
    }
    if (assigneeFilter === "aurel") {
      return task.assignees?.some((a) => a.name?.toLowerCase().includes("aurel"));
    }
    return true;
  });

  // Group tasks by status
  const groupedTasks: Record<TaskStatus, KanbanTask[]> = {
    inbox: [],
    assigned: [],
    in_progress: [],
    review: [],
    done: [],
  };

  if (filteredTasks) {
    for (const task of filteredTasks) {
      if (isValidStatus(task.status)) {
        groupedTasks[task.status].push(mapTask(task));
      }
    }
  }

  const columns: KanbanColumnDef[] = [
    {
      id: "inbox",
      title: "Inbox",
      variant: "inbox",
      tasks: groupedTasks.inbox,
    },
    {
      id: "assigned",
      title: "Assigned",
      variant: "assigned",
      tasks: groupedTasks.assigned,
    },
    {
      id: "in_progress",
      title: "In Progress",
      variant: "in-progress",
      tasks: groupedTasks.in_progress,
    },
    {
      id: "review",
      title: "Review",
      variant: "review",
      tasks: groupedTasks.review,
    },
    { id: "done", title: "Done", variant: "done", tasks: groupedTasks.done },
  ];

  const handleTaskMove = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      mutate("/api/tasks");
    } catch (err) {
      console.error("Failed to move task:", err);
    }
  };

  const handleTaskCreate = async (columnId: string, title: string) => {
    try {
      await createNotionTask(title, columnId);
      mutate("/api/tasks");
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleOpenFeed = () => {
    openDrawer(<LiveFeed className="h-full" />, <LiveFeedTitle />);
  };

  const handlePanelResize = (size: {
    asPercentage: number;
    inPixels: number;
  }) => {
    const collapsed = size.inPixels <= 60;
    setIsCollapsed(collapsed);
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* Agents Panel */}
      <ResizablePanel
        defaultSize={isCollapsed ? COLLAPSED_SIZE : DEFAULT_SIZE}
        minSize={MIN_SIZE}
        maxSize={MAX_SIZE}
        collapsible
        collapsedSize={COLLAPSED_SIZE}
        onResize={handlePanelResize}
        className="hidden md:block"
      >
        <AgentsPanel
          collapsed={isCollapsed}
          selectedAgentIds={selectedAgentIds}
          onSelectionChange={setSelectedAgentIds}
        />
      </ResizablePanel>

      <ResizableHandle className="hover:bg-border hidden w-px bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:flex" />

      {/* Main Content */}
      <ResizablePanel minSize="400px">
        <div className="flex h-full flex-col p-6">
          <PageHeader className="mb-0">
            <PageHeaderRow>
              <PageHeaderTitle>Board</PageHeaderTitle>
              <PageHeaderActions>
                <NewTaskDialog />
                <Button variant="outline" size="sm" onClick={handleOpenFeed}>
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Live Feed</span>
                </Button>
              </PageHeaderActions>
            </PageHeaderRow>
            {/* Assignee quick-filter */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {(["all", "patrick", "aurel", "unassigned"] as AssigneeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setAssigneeFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    assigneeFilter === f
                      ? "bg-foreground text-background"
                      : "border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "all" ? "All" : f === "patrick" ? "👤 Patrick" : f === "aurel" ? "🤖 Aurel" : "Unassigned"}
                </button>
              ))}
              {assigneeFilter !== "all" && (
                <span className="text-xs text-muted-foreground">
                  · {filteredTasks?.length ?? 0} tasks
                </span>
              )}
            </div>
          </PageHeader>

          <div className="min-h-0 flex-1 overflow-hidden pt-6">
            <KanbanBoard columns={columns} onTaskMove={handleTaskMove} onTaskCreate={handleTaskCreate} className="h-full" />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default BoardPage;
