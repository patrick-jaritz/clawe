"use client";

import { cn } from "@clawe/ui/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const WeeklyRoutineGrid = () => {
  const today = new Date().getDay();

  return (
    <div className="grid grid-cols-7 gap-2">
      {DAYS.map((day, dayIndex) => {
        const isToday = dayIndex === today;

        return (
          <div
            key={day}
            className="flex min-h-44 flex-col rounded-xl border p-2.5"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-medium tracking-wider uppercase",
                  isToday
                    ? "text-pink-600 dark:text-pink-400"
                    : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              {isToday && (
                <span className="rounded-full bg-pink-100 px-1.5 py-px text-[9px] font-semibold tracking-wide text-pink-600 uppercase dark:bg-pink-950/50 dark:text-pink-400">
                  today
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
