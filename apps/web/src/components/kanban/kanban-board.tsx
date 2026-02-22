"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@clawe/ui/lib/utils";
import { ScrollArea, ScrollBar } from "@clawe/ui/components/scroll-area";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { TaskDetailModal } from "./task-detail-modal";
import type { KanbanBoardProps, KanbanTask } from "./types";

export const KanbanBoard = ({ columns, onTaskMove, onTaskCreate, className }: KanbanBoardProps) => {
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before drag starts (preserves click)
      activationConstraint: { distance: 8 },
    }),
  );

  // Flat map of all tasks for overlay lookup
  const allTasks = columns.flatMap((col) => col.tasks);

  const handleDragStart = (event: DragStartEvent) => {
    const task = allTasks.find((t) => t.id === String(event.active.id));
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !onTaskMove) return;

    const taskId = String(active.id);
    const newColumnId = String(over.id);

    // Find which column the task is currently in
    const sourceColumn = columns.find((col) =>
      col.tasks.some((t) => t.id === taskId),
    );
    if (!sourceColumn || sourceColumn.id === newColumnId) return;

    // Validate target column exists
    const targetColumn = columns.find((col) => col.id === newColumnId);
    if (!targetColumn) return;

    await onTaskMove(taskId, newColumnId);
  };

  const handleTaskClick = (task: KanbanTask) => {
    setSelectedTask(task);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) setSelectedTask(null);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea
          type="scroll"
          className={cn("h-full w-full", className)}
          data-kanban-board
        >
          <div className="flex h-full gap-2 pb-4">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onTaskClick={handleTaskClick}
                onTaskCreate={onTaskCreate}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Drag Overlay — shown while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-48 rotate-1 opacity-90 shadow-xl">
              <KanbanCard
                task={activeTask}
                onTaskClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailModal
        task={selectedTask}
        open={selectedTask !== null}
        onOpenChange={handleModalClose}
      />
    </>
  );
};
