"use client";

import { useState } from "react";
import { Bell, X, AlertTriangle, BotIcon, Brain, Info } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";
import { useNotifications, type AppNotification } from "@/lib/api/local";

const typeConfig: Record<
  AppNotification["type"],
  { icon: React.ElementType; color: string; bg: string }
> = {
  deadline: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  agent: {
    icon: BotIcon,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  intel: {
    icon: Brain,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  info: {
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 0) {
    // Future (deadline)
    const days = Math.ceil(-diff / (1000 * 60 * 60 * 24));
    return `in ${days}d`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const NotificationsPanel = () => {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();

  const unread = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];
  const urgent = notifications.filter((n) => n.urgent);
  const normal = notifications.filter((n) => !n.urgent);

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
              urgent.length > 0 ? "bg-red-500" : "bg-blue-500"
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div className="fixed right-4 top-14 z-50 w-80 rounded-xl border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Notifications</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No notifications
              </p>
            ) : (
              <>
                {urgent.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-red-500">
                      Urgent
                    </p>
                    {urgent.map((n) => (
                      <NotificationRow key={n.id} n={n} />
                    ))}
                  </div>
                )}
                {normal.length > 0 && (
                  <div>
                    {urgent.length > 0 && (
                      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Info
                      </p>
                    )}
                    {normal.map((n) => (
                      <NotificationRow key={n.id} n={n} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2 text-xs text-muted-foreground text-center">
            Refreshes every minute
          </div>
        </div>
      )}
    </>
  );
};

const NotificationRow = ({ n }: { n: AppNotification }) => {
  const cfg = typeConfig[n.type] ?? typeConfig.info;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        n.urgent && "border-l-2 border-red-500"
      )}
    >
      <div className={cn("mt-0.5 flex-shrink-0 rounded-full p-1.5", cfg.bg)}>
        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{n.title}</p>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {n.body}
          </p>
        )}
        {n.time && (
          <p className="text-xs text-muted-foreground/60 mt-1">
            {formatTime(n.time)}
          </p>
        )}
      </div>
    </div>
  );
};
