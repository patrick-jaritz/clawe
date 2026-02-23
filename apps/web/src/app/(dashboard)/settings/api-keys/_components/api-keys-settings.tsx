"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@clawe/ui/components/button";
import { Input } from "@clawe/ui/components/input";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Eye, EyeOff, Pencil, Check, X, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetcher } from "@/lib/api/local";

// ─── types ────────────────────────────────────────────────────────────────────

interface SecretEntry {
  name: string;
  masked: string;
  set: boolean;
}

interface KeysResponse {
  keys: SecretEntry[];
}

// ─── category config ──────────────────────────────────────────────────────────

const CATEGORIES: Array<{
  id: string;
  label: string;
  emoji: string;
  prefixes: string[];
}> = [
  { id: "ai",          label: "AI Providers",   emoji: "🤖", prefixes: ["ANTHROPIC", "OPENAI", "GROQ", "GOOGLE_AI", "PERPLEXITY"] },
  { id: "social",      label: "Social",          emoji: "🐦", prefixes: ["TWITTER", "X_", "BIRD"] },
  { id: "search",      label: "Search",          emoji: "🔍", prefixes: ["BRAVE", "EXA", "SERP"] },
  { id: "productivity",label: "Productivity",    emoji: "📝", prefixes: ["NOTION", "GOOGLE_CLIENT", "GOOGLE_REFRESH", "GOOGLE_TOKEN"] },
  { id: "messaging",   label: "Messaging",       emoji: "💬", prefixes: ["TELEGRAM", "DISCORD", "SLACK", "WHATSAPP"] },
  { id: "infra",       label: "Infrastructure",  emoji: "⚙️", prefixes: ["DATABASE", "SUPABASE", "NEON", "REDIS", "LANCEDB", "MEMORY", "QDRANT"] },
  { id: "other",       label: "Other",           emoji: "🔑", prefixes: [] },
];

function categorize(name: string): string {
  const upper = name.toUpperCase();
  for (const cat of CATEGORIES) {
    if (cat.prefixes.some((p) => upper.startsWith(p))) return cat.id;
  }
  return "other";
}

// ─── single row ───────────────────────────────────────────────────────────────

function SecretRow({ entry, onSaved }: { entry: SecretEntry; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/keys/${encodeURIComponent(entry.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success(`${entry.name} updated`);
      setEditing(false);
      setValue("");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono font-medium">{entry.name}</p>
          {entry.set ? (
            <p className="text-muted-foreground font-mono text-[11px] truncate mt-0.5">{entry.masked}</p>
          ) : (
            <p className="text-muted-foreground text-[11px] italic mt-0.5">Not configured</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.set ? (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">set</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">missing</Badge>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border px-3 py-2.5 space-y-2">
      <p className="text-xs font-mono font-medium">{entry.name}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste new value…"
            className="pr-8 h-8 text-xs font-mono"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button size="sm" className="h-8" onClick={save} disabled={!value.trim() || saving}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── add new secret ───────────────────────────────────────────────────────────

function AddSecretRow({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/keys/${encodeURIComponent(name.toUpperCase().trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success(`${name.toUpperCase()} added`);
      setOpen(false);
      setName("");
      setValue("");
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center gap-1.5"
      >
        <Plus className="h-3 w-3" /> Add new secret
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed px-3 py-2.5 space-y-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
          placeholder="KEY_NAME"
          className="h-8 text-xs font-mono uppercase"
          autoFocus
        />
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="h-8 text-xs font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
        />
        <Button size="sm" className="h-8" onClick={save} disabled={!name.trim() || !value.trim() || saving}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Name must be uppercase letters, numbers, underscores. Writes to openclaw.json env.vars.</p>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export const ApiKeysSettings = () => {
  const { data, isLoading, mutate } = useSWR<KeysResponse>("/api/settings/keys", fetcher);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["ai", "messaging"]));

  function toggleCat(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="space-y-1"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-64" /></div>
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    entries: data.keys.filter((k) => categorize(k.name) === cat.id),
  })).filter((c) => c.entries.length > 0 || c.id === "other");

  const totalSet = data.keys.filter((k) => k.set).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Secrets Vault</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            {totalSet}/{data.keys.length} configured · stored in ~/.openclaw/openclaw.json
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {grouped.map((cat) => {
        const isOpen = expandedCats.has(cat.id);
        const missingCount = cat.entries.filter((e) => !e.set).length;
        return (
          <div key={cat.id} className="space-y-2">
            <button
              onClick={() => toggleCat(cat.id)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{cat.emoji}</span>
                <span className="text-sm font-medium">{cat.label}</span>
                <span className="text-xs text-muted-foreground">({cat.entries.length})</span>
                {missingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-yellow-600 border-yellow-300">
                    {missingCount} missing
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="space-y-1.5 pl-1">
                {cat.entries.map((entry) => (
                  <SecretRow key={entry.name} entry={entry} onSaved={() => mutate()} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <AddSecretRow onAdded={() => mutate()} />

      <p className="text-xs text-muted-foreground border-t pt-3">
        ⚠️ Changes write directly to <code className="font-mono">~/.openclaw/openclaw.json</code>.
        Restart affected agents or crons for changes to take effect.
      </p>
    </div>
  );
};
