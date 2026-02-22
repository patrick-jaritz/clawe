"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Inbox,
  CircleDot,
  Play,
  Eye,
  CircleCheck,
  Mail,
  Moon,
  Target,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";
import { KanbanCard } from "./kanban-card";
import { columnVariants, type KanbanColumnDef, type KanbanTask } from "./types";
import { ScrollArea } from "@clawe/ui/components/scroll-area";

const columnIconComponents: Record<
  KanbanColumnDef["variant"],
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  inbox: Inbox,
  assigned: CircleDot,
  "in-progress": Play,
  review: Eye,
  done: CircleCheck,
};

const emptyStateIcons: Record<
  KanbanColumnDef["variant"],
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  inbox: Mail,
  assigned: Moon,
  "in-progress": Moon,
  review: Moon,
  done: Target,
};

const EmptyState = ({ variant }: { variant: KanbanColumnDef["variant"] }) => {
  const EmptyIcon = emptyStateIcons[variant];
  const variantStyles = columnVariants[variant];

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <EmptyIcon
        className={cn("h-8 w-8", variantStyles.icon, "opacity-70")}
        strokeWidth={1}
      />
      <span className="text-muted-foreground mt-2 text-sm">Empty</span>
    </div>
  );
};

export type KanbanColumnProps = {
  column: KanbanColumnDef;
  onTaskClick: (task: KanbanTask) => void;
  onTaskCreate?: (columnId: string, title: string) => Promise<void>;
};

export const KanbanColumn = ({ column, onTaskClick, onTaskCreate }: KanbanColumnProps) => {
  const variant = columnVariants[column.variant];
  const IconComponent = columnIconComponents[column.variant];
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleCreate = async () => {
    const title = inputValue.trim();
    if (!title || !onTaskCreate) { setAdding(false); setInputValue(""); return; }
    setIsCreating(true);
    try {
      await onTaskCreate(column.id, title);
    } finally {
      setIsCreating(false);
      setAdding(false);
      setInputValue("");
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-w-48 flex-1 flex-col rounded-lg p-2 transition-colors",
        variant.column,
        isOver && "ring-2 ring-inset ring-primary/40",
      )}
    >
      {/* Header */}
      <div className="mb-2 flex w-full items-center gap-2">
        <IconComponent
          className={cn("h-4 w-4", variant.icon)}
          strokeWidth={2}
        />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            variant.badge,
          )}
        >
          {column.title}
        </span>
        <span className="text-muted-foreground ml-1 text-sm font-medium">
          {column.tasks.length}
        </span>
        {onTaskCreate && (
          <button
            onClick={() => setAdding(true)}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
            title="Add task"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Inline add input */}
      {adding && (
        <div className="mb-2 flex gap-1">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setAdding(false); setInputValue(""); }
            }}
            placeholder="Task title..."
            disabled={isCreating}
            className="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
          ) : (
            <button
              onClick={handleCreate}
              className="rounded bg-primary px-1.5 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Add
            </button>
          )}
        </div>
      )}

      {/* Task list */}
      <ScrollArea className="min-h-0 flex-1">
        {column.tasks.length === 0 ? (
          <EmptyState variant={column.variant} />
        ) : (
          <div className="space-y-2">
            {column.tasks.map((task) => (
              <KanbanCard key={task.id} task={task} onTaskClick={onTaskClick} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
