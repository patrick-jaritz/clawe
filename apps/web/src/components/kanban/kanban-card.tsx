"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  AlignLeft,
  User,
  FileText,
  Circle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@clawe/ui/components/popover";
import type { KanbanTask } from "./types";
import { Button } from "@clawe/ui/components/button";

export type KanbanCardProps = {
  task: KanbanTask;
  onTaskClick: (task: KanbanTask) => void;
  isSubtask?: boolean;
  parentTitle?: string;
};

const priorityStyles: Record<string, string> = {
  high: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

function formatDueDate(iso: string): { label: string; urgent: boolean; overdue: boolean } {
  const due = new Date(iso);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true, overdue: true };
  if (diffDays === 0) return { label: "due today", urgent: true, overdue: false };
  if (diffDays === 1) return { label: "due tomorrow", urgent: true, overdue: false };
  if (diffDays <= 7) return { label: `in ${diffDays}d`, urgent: false, overdue: false };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    urgent: false,
    overdue: false,
  };
}

export const KanbanCard = ({
  task,
  onTaskClick,
  isSubtask = false,
  parentTitle,
}: KanbanCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: isSubtask,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  const hasSubtasks = task.subtasks.length > 0;
  const dueDateInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  const showMetadata = (task.priority && task.priority !== "low") || task.assignee || dueDateInfo;

  const handleCardClick = () => {
    onTaskClick(task);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div ref={setNodeRef} style={style} className="w-full touch-none">
      <div
        onClick={handleCardClick}
        {...(isSubtask ? {} : { ...listeners, ...attributes })}
        className="bg-background cursor-grab overflow-hidden rounded-lg border border-gray-900/10 p-3 transition-colors hover:bg-gray-50 active:cursor-grabbing dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {/* Parent title for subtasks */}
        {isSubtask && parentTitle && (
          <p className="mb-1 truncate text-xs text-gray-400">{parentTitle}</p>
        )}

        {/* Title */}
        <h3 className="text-sm leading-snug font-medium text-gray-900 dark:text-gray-100">
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <div className="mt-2">
            <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {task.description}
            </p>
          </div>
        )}

        {/* Metadata row: popover button on left, priority & assignee on right */}
        {(task.description || showMetadata) && (
          <div className="mt-1.5 flex items-center justify-between">
            {task.description ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hover:bg-muted h-fit w-0 p-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlignLeft className="h-4 w-4 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="center"
                  className="w-80 bg-white dark:bg-zinc-900"
                >
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {task.description}
                  </p>
                </PopoverContent>
              </Popover>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {task.priority && task.priority !== "low" && priorityStyles[task.priority] && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    priorityStyles[task.priority],
                  )}
                >
                  {task.priority}
                </span>
              )}

              {dueDateInfo && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    dueDateInfo.overdue
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : dueDateInfo.urgent
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  <Circle className="h-2 w-2 fill-current" />
                  {dueDateInfo.label}
                </span>
              )}

              {task.assignee && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <User className="h-3 w-3" />
                  {task.assignee}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Subtask toggle and document badge */}
        {(hasSubtasks || (task.documentCount && task.documentCount > 0)) &&
          !isSubtask && (
            <div className="mt-3 flex items-center gap-3">
              {hasSubtasks && (
                <Button
                  variant="ghost"
                  onClick={handleToggleClick}
                  className="h-auto gap-1 p-1 px-1.5! text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {expanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {task.subtasks.filter((st) => st.done).length}/
                  {task.subtasks.length} subtask
                  {task.subtasks.length !== 1 && "s"}
                </Button>
              )}

              {task.documentCount && task.documentCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <FileText className="h-3 w-3" />
                  {task.documentCount} doc
                  {task.documentCount !== 1 && "s"}
                </span>
              )}
            </div>
          )}
      </div>

      {/* Expanded subtasks */}
      {expanded && hasSubtasks && (
        <ul className="mt-2 ml-3 space-y-1">
          {task.subtasks.map((subtask) => {
            const status =
              subtask.status ?? (subtask.done ? "done" : "pending");
            return (
              <li
                key={subtask.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                  status === "done" && "text-muted-foreground",
                  status === "blocked" && "text-red-600 dark:text-red-400",
                )}
              >
                {status === "done" && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                )}
                {status === "in_progress" && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
                )}
                {status === "blocked" && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                {status === "pending" && (
                  <Circle className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                )}
                <span className={status === "done" ? "line-through" : ""}>
                  {subtask.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
