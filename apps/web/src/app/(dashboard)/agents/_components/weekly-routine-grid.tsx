"use client";

import { cn } from "@clawe/ui/lib/utils";
import { useAgents } from "@/lib/api/local";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type RoutineEntry = { time: string; task: string };

// Color by task type
function entryColor(task: string) {
  if (task.includes("brief") || task.includes("Brief")) return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
  if (task.includes("Twitter") || task.includes("tweet")) return "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300";
  if (task.includes("Reddit")) return "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300";
  if (task.includes("watchlist") || task.includes("GitHub")) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
  if (task.includes("content") || task.includes("Content") || task.includes("arbitrage")) return "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300";
  if (task.includes("Memory") || task.includes("memory") || task.includes("knowledge") || task.includes("Skill")) return "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
  if (task.includes("build log") || task.includes("weekly")) return "bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300";
  return "bg-muted text-muted-foreground";
}

export const WeeklyRoutineGrid = () => {
  const today = new Date().getDay();
  const { data: agents } = useAgents();

  // Collect routines from all agents
  const routines: Record<string, { agent: string; emoji: string; entries: RoutineEntry[] }[]> = {};

  for (const day of DAYS) {
    routines[day] = [];
  }

  for (const agent of agents ?? []) {
    const routine = (agent as Record<string, unknown>).routine as Record<string, RoutineEntry[]> | null | undefined;
    if (!routine) continue;
    for (const day of DAYS) {
      const entries = routine[day] ?? [];
      if (entries.length > 0) {
        (routines[day] ??= []).push({ agent: agent.name, emoji: agent.emoji, entries });
      }
    }
  }

  const hasAnyData = Object.values(routines).some((d) => d.some((a) => a.entries.length > 0));

  if (!hasAnyData) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
        No routine data yet. Agents push weekly schedules via heartbeat.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAYS.map((day, dayIndex) => {
        const isToday = dayIndex === today;
        const agentEntries = routines[day] ?? [];
        const allEntries = agentEntries.flatMap((a) =>
          a.entries.map((e) => ({ ...e, agentEmoji: a.emoji }))
        ).sort((a, b) => a.time.localeCompare(b.time));

        return (
          <div
            key={day}
            className={cn(
              "flex min-h-44 flex-col rounded-xl border p-2",
              isToday && "border-pink-300 bg-pink-50/30 dark:border-pink-700 dark:bg-pink-950/10",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wider uppercase",
                  isToday
                    ? "text-pink-600 dark:text-pink-400"
                    : "text-muted-foreground",
                )}
              >
                {DAY_SHORT[dayIndex]}
              </span>
              {isToday && (
                <span className="rounded-full bg-pink-100 px-1.5 py-px text-[8px] font-semibold tracking-wide text-pink-600 uppercase dark:bg-pink-950/50 dark:text-pink-400">
                  today
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {allEntries.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded px-1.5 py-1 text-[9px] leading-tight",
                    entryColor(entry.task),
                  )}
                >
                  <span className="font-mono font-medium">{entry.time}</span>{" "}
                  <span className="opacity-90">{entry.task}</span>
                  {entry.agentEmoji && (
                    <span className="ml-0.5 opacity-60">{entry.agentEmoji}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
