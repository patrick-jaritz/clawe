/**
 * Configurable Quick Actions — definitions and localStorage helpers
 */

export type QuickActionDef = {
  id: string;
  label: string;
  icon: string; // lucide icon name for display
  href: string;
  external?: boolean;
  defaultEnabled: boolean;
};

export const ALL_QUICK_ACTIONS: QuickActionDef[] = [
  { id: "board",       label: "Board",       icon: "ClipboardList", href: "/board",          defaultEnabled: true },
  { id: "intelligence",label: "Intelligence", icon: "Brain",         href: "/intelligence",   defaultEnabled: true },
  { id: "projects",    label: "Projects",    icon: "Rocket",        href: "/projects",       defaultEnabled: true },
  { id: "crons",       label: "Crons",       icon: "Timer",         href: "/crons",          defaultEnabled: true },
  { id: "memory",      label: "Memory",      icon: "Database",      href: "/memory",         defaultEnabled: true },
  { id: "dba",         label: "DBA Paper",   icon: "FileText",      href: "PORT:3016",       external: true,  defaultEnabled: true },
  { id: "bac",         label: "BAC Run",     icon: "CheckSquare",   href: "PORT:3007",       external: true,  defaultEnabled: true },
  { id: "mindwtr",     label: "Mindwtr",     icon: "Layers",        href: "PORT:3013",       external: true,  defaultEnabled: false },
  { id: "byl",         label: "BYL App",     icon: "Globe",         href: "PORT:3008",       external: true,  defaultEnabled: false },
  { id: "newtask",     label: "New Task",    icon: "Plus",          href: "/board",          defaultEnabled: true },
];

const STORAGE_KEY = "clawe-quick-actions";

export function getEnabledActionIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set(ALL_QUICK_ACTIONS.filter((a) => a.defaultEnabled).map((a) => a.id));
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return new Set(ALL_QUICK_ACTIONS.filter((a) => a.defaultEnabled).map((a) => a.id));
    }
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return new Set(ALL_QUICK_ACTIONS.filter((a) => a.defaultEnabled).map((a) => a.id));
  }
}

export function setEnabledActionIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}
