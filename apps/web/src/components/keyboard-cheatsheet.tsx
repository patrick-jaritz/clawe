"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@clawe/ui/components/dialog";

const shortcuts: Array<{ group: string; keys: Array<{ combo: string; desc: string }> }> = [
  {
    group: "Global",
    keys: [
      { combo: "⌘K", desc: "Open command palette" },
      { combo: "?", desc: "Show keyboard shortcuts" },
      { combo: "Esc", desc: "Close any open panel / dialog" },
    ],
  },
  {
    group: "Navigation",
    keys: [
      { combo: "G H", desc: "Go to Home" },
      { combo: "G B", desc: "Go to Board" },
      { combo: "G I", desc: "Go to Intelligence" },
      { combo: "G P", desc: "Go to Projects" },
      { combo: "G D", desc: "Go to DBA Papers" },
      { combo: "G W", desc: "Go to Weekly Review" },
    ],
  },
  {
    group: "Board",
    keys: [
      { combo: "N", desc: "New task (focus inline input)" },
      { combo: "1 / 2 / 3", desc: "Filter: All / Patrick / Aurel" },
    ],
  },
  {
    group: "Intelligence",
    keys: [
      { combo: "Tab", desc: "Switch Browse / Ask tabs" },
      { combo: "⌘↵", desc: "Submit question" },
    ],
  },
];

function KbdKey({ combo }: { combo: string }) {
  return (
    <div className="flex items-center gap-1">
      {combo.split(" ").map((part, i) => (
        <span key={i}>
          <kbd className="inline-flex items-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
            {part}
          </kbd>
          {i < combo.split(" ").length - 1 && (
            <span className="mx-0.5 text-xs text-muted-foreground">then</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function KeyboardCheatsheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only fire if not in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-sm">?</kbd>
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {shortcuts.map((group) => (
            <div key={group.group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.group}
              </p>
              <div className="space-y-1.5">
                {group.keys.map((s) => (
                  <div key={s.combo} className="flex items-center justify-between">
                    <span className="text-sm">{s.desc}</span>
                    <KbdKey combo={s.combo} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">?</kbd> anywhere to toggle this panel.
        </p>
      </DialogContent>
    </Dialog>
  );
}
