import useSWR from "swr";

// Use relative URLs — Next.js proxy routes /api/* → localhost:3001
// This works from any device (Tailscale, mobile, etc.)
const API_BASE = "";

export const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });

export type LocalAgent = {
  _id: string;
  name: string;
  role: string;
  emoji: string;
  sessionKey: string;
  status: "online" | "offline";
  health?: "green" | "yellow" | "red" | "offline";
  currentActivity: string | null;
  activeFocus?: string | null;
  activeTasks?: string[];
  completedToday?: string[];
  blockers?: string[];
  needsAttention?: boolean | string[];
  notes?: string;
  lastHeartbeat: number;
};

export type LocalTask = {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: "low" | "medium" | "high" | "normal";
  dueDate?: string | null;
  assigneeIds: string[];
  assignees: { _id: string; name: string; emoji: string }[];
  subtasks: unknown[];
  documentCount: number;
};

export type LocalActivity = {
  _id: string;
  type: string;
  agentId: string;
  message: string;
  createdAt: number;
};

export function useAgents() {
  return useSWR<LocalAgent[]>("/api/agents", fetcher, {
    refreshInterval: 15000,
  });
}

export function useTasks() {
  return useSWR<LocalTask[]>("/api/tasks", fetcher, {
    refreshInterval: 30000,
  });
}

export function useActivities(limit = 50) {
  return useSWR<LocalActivity[]>(`/api/activities?limit=${limit}`, fetcher, {
    refreshInterval: 10000,
  });
}

export type IntelChunk = {
  id: string;
  title: string;
  source: string;
  date: string;
  url: string;
  content_preview: string;
  entity_type: string;
};

export type IntelStats = {
  total: number;
  by_source: Record<string, number>;
  last_ingest: string | null;
  source_last_dates?: Record<string, string>;
};

export type IntelChunksResponse = {
  chunks: IntelChunk[];
  total: number;
  page: number;
  pages: number;
  query?: string;
};

export type IngestStatus = {
  last_run: string | null;
  chunk_count: number;
  next_run: string;
};

export function useIntelChunks(page = 1, limit = 20, source = "all") {
  return useSWR<IntelChunksResponse>(
    `/api/intel/chunks?page=${page}&limit=${limit}&source=${source}`,
    fetcher,
    {
      refreshInterval: 30000,
    }
  );
}

export function useIntelSearch(query: string, page = 1, limit = 20, source = "all") {
  return useSWR<IntelChunksResponse>(
    query.trim()
      ? `/api/intel/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&source=${source}`
      : null,
    fetcher,
    {
      refreshInterval: 30000,
    }
  );
}

export function useIngestStatus() {
  return useSWR<IngestStatus>("/api/intel/ingest/status", fetcher, {
    refreshInterval: 30000,
  });
}

export function useIntelStats() {
  return useSWR<IntelStats>("/api/intel/stats", fetcher, {
    refreshInterval: 60000,
  });
}

export async function createIntelChunk(data: {
  text: string;
  title: string;
  source: string;
  url?: string;
}): Promise<{ id: string; stored: boolean }> {
  const res = await fetch(`${API_BASE}/api/intel/chunks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to create intel chunk: ${res.status}`);
  }

  return res.json();
}

export async function triggerIngest(): Promise<{ started: boolean; pid?: number; message?: string }> {
  const res = await fetch(`${API_BASE}/api/intel/ingest/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to trigger ingestion: ${res.status}`);
  }

  return res.json();
}

export type FullIntelChunk = IntelChunk & {
  content: string;
  vector: number[];
  tags: string[];
};

export async function getIntelChunk(id: string): Promise<FullIntelChunk> {
  const res = await fetch(`${API_BASE}/api/intel/chunks/${id}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch intel chunk: ${res.status}`);
  }

  return res.json();
}

export type ProjectHealth = { ok: boolean; lastChecked: number; latencyMs?: number };
export type CrashEvent = { ts: number; code: number | null };

export type Project = {
  id: string;
  name: string;
  description: string;
  path: string;
  port: number;
  startCmd: string;
  techStack: string[];
  status: 'available' | 'no-ui' | 'planned';
  running: boolean;
  startedAt?: number | null;
  category: 'byl' | 'tools' | 'intelligence' | 'external';
  notes?: string;
  autoRestart?: boolean;
  health?: ProjectHealth | null;
  crashCount?: number;
  lastCrash?: CrashEvent | null;
};

export type ProjectsResponse = {
  projects: Project[];
};

export type ProjectStatus = {
  running: boolean;
  pid?: number;
};

export function useProjects() {
  return useSWR<ProjectsResponse>("/api/projects", fetcher, {
    refreshInterval: 10000,
  });
}

export async function startProject(id: string): Promise<{ started: boolean; port: number; pid?: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Failed to start project: ${res.status}`);
  }

  return res.json();
}

export async function stopProject(id: string): Promise<{ stopped: boolean }> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || `Failed to stop project: ${res.status}`);
  }

  return res.json();
}

export async function getProjectStatus(id: string): Promise<ProjectStatus> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/status`);

  if (!res.ok) {
    throw new Error(`Failed to get project status: ${res.status}`);
  }

  return res.json();
}

export function projectLogsUrl(id: string): string {
  return `${API_BASE}/api/projects/${id}/logs`;
}

export async function saveProjectNotes(id: string, notes: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`Failed to save notes: ${res.status}`);
}

export async function setProjectAutoRestart(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/auto-restart`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`Failed to set auto-restart: ${res.status}`);
}

// ── Memory system ─────────────────────────────────────────────────────────────

export type MemoryQueryResult = { raw: string; query: string };
export type MemoryDecisionsResult = { raw: string };

export function useMemoryQuery(q: string) {
  return useSWR<MemoryQueryResult>(
    q.trim() ? `/api/memory/query?q=${encodeURIComponent(q)}` : "/api/memory/query",
    fetcher,
    { revalidateOnFocus: false }
  );
}

export function useMemoryDecisions() {
  return useSWR<MemoryDecisionsResult>("/api/memory/decisions", fetcher, {
    revalidateOnFocus: false,
  });
}

// ── Tailscale ─────────────────────────────────────────────────────────────────

export type TailscaleDevice = {
  id: string;
  name: string;
  ip: string;
  os: string;
  online: boolean;
  lastSeen: string | null;
  relay: string;
  isSelf: boolean;
};

export type TailscaleStatus = {
  self: TailscaleDevice;
  peers: TailscaleDevice[];
};

export function useTailscaleStatus() {
  return useSWR<TailscaleStatus>("/api/tailscale/status", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

// ── Share token ───────────────────────────────────────────────────────────────

export type ShareTokenResult = { token: string | null };

export function useShareToken() {
  return useSWR<ShareTokenResult>("/api/share/token", fetcher, {
    revalidateOnFocus: false,
  });
}

export async function generateShareToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/share/token`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate token");
  const data = await res.json() as { token: string };
  return data.token;
}

export async function revokeShareToken(): Promise<void> {
  await fetch(`${API_BASE}/api/share/token`, { method: "DELETE" });
}

// ── Rebuild ───────────────────────────────────────────────────────────────────

export function rebuildProject(id: string): EventSource {
  return new EventSource(`${API_BASE}/api/projects/${id}/rebuild`);
}

// ── Log search ────────────────────────────────────────────────────────────────

export type LogSearchResult = { results: string[]; total: number; query: string };

export async function searchProjectLogs(id: string, q: string): Promise<LogSearchResult> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/logs/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Log search failed");
  return res.json() as Promise<LogSearchResult>;
}

// ── .env viewer ───────────────────────────────────────────────────────────────

export type EnvVar = { key: string; value: string; masked: boolean };
export type EnvResult = { vars: EnvVar[]; path: string; exists: boolean };

export async function getProjectEnv(id: string, reveal = false): Promise<EnvResult> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/env?reveal=${reveal}`);
  if (!res.ok) throw new Error("Failed to fetch .env");
  return res.json() as Promise<EnvResult>;
}

// ── DBA Progress ──────────────────────────────────────────────────────────────

export type DBASection = { id: string; title: string; done: boolean };
export type DBAPaper = { id: string; title: string; deadline: string; sections: DBASection[] };
export type DBAProgress = { papers: DBAPaper[]; updatedAt: string };

export function useDBAProgress() {
  return useSWR<DBAProgress>("/api/dba/progress", fetcher, { revalidateOnFocus: false });
}

export async function patchDBAProgress(update: {
  paperId?: string; sectionId?: string; done?: boolean; paperTitle?: string;
}): Promise<DBAProgress> {
  const res = await fetch(`${API_BASE}/api/dba/progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error("Failed to update DBA progress");
  return res.json() as Promise<DBAProgress>;
}

// ── Weekly Review ─────────────────────────────────────────────────────────────

export type WeeklyReview = {
  weekOf: string;
  weekEnding: string;
  intelChunks: number;
  completedTasks: string[];
  memStats: string;
};

export function useWeeklyReview() {
  return useSWR<WeeklyReview>("/api/weekly-review", fetcher, { revalidateOnFocus: false });
}

// ── Notion sync status ────────────────────────────────────────────────────────

export type NotionSyncStatus = { lastSync: string | null; lastStatus: string };

export function useNotionSyncStatus() {
  return useSWR<NotionSyncStatus>("/api/notion/sync-status", fetcher, {
    refreshInterval: 60_000,
  });
}

export type SystemHealth = {
  services: {
    api: { ok: boolean; label: string };
    qdrant: { ok: boolean; label: string };
    lancedb: { ok: boolean; label: string; chunks: number };
  };
  next_ingest: string;
};

export type RecentIntel = {
  id: string;
  title: string;
  source: string;
  date: string;
  url: string;
  entity_type: string;
};

export type RecentIntelResponse = {
  chunks: RecentIntel[];
};

export function useSystemHealth() {
  return useSWR<SystemHealth>("/api/system/health", fetcher, {
    refreshInterval: 30000,
  });
}

export function useRecentIntel() {
  return useSWR<RecentIntelResponse>("/api/system/recent-intel", fetcher, {
    refreshInterval: 60000,
  });
}

export async function updateTaskStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task status: ${res.status}`);
  return res.json();
}

export type IntelSource = {
  index: number;
  id: string;
  title: string;
  source: string;
  date: string;
  url: string;
  score: number;
};

export type AskIntelCallbacks = {
  onSources: (sources: IntelSource[]) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export function askIntel(question: string, callbacks: AskIntelCallbacks): () => void {
  const ctrl = new AbortController();

  (async () => {
    const res = await fetch("/api/intel/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      callbacks.onError(`Request failed: ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (eventType === "sources") callbacks.onSources(payload.sources);
            else if (eventType === "delta") callbacks.onDelta(payload.text);
            else if (eventType === "done") callbacks.onDone();
            else if (eventType === "error") callbacks.onError(payload.message);
          } catch { /* ignore parse errors */ }
          eventType = "";
        }
      }
    }
  })().catch((err) => {
    if (err.name !== "AbortError") callbacks.onError(String(err));
  });

  return () => ctrl.abort();
}

export type AppNotification = {
  id: string;
  type: "deadline" | "agent" | "intel" | "info";
  title: string;
  body?: string;
  urgent: boolean;
  time?: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unread: number;
};

export function useNotifications() {
  return useSWR<NotificationsResponse>("/api/notifications", fetcher, {
    refreshInterval: 60_000,
  });
}

// ── Cron Monitor ──────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------
// Repos (watchlist)
// ---------------------------------------------------------------------------

export type WatchlistRepo = {
  id: string;
  owner: string;
  repo: string;
  name: string;
  category: string;
  description: string;
  why: string;
  added: string;
  url: string;
  stars: number | null;
  trending: boolean;
  source: string;
};

export type RepoCategory = {
  name: string;
  count: number;
};

export type ReposResponse = {
  repos: WatchlistRepo[];
  categories: RepoCategory[];
  meta: { lastChecked: string } | null;
  total: number;
  source: "notion" | "local";
};

export function useRepos(category?: string, search?: string) {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (search) params.set("q", search);
  const qs = params.toString();
  return useSWR<ReposResponse>(`/api/repos${qs ? `?${qs}` : ""}`, fetcher, {
    refreshInterval: 300000, // 5 min
  });
}

// ---------------------------------------------------------------------------
// Machines (multi-machine metrics)
// ---------------------------------------------------------------------------

export type MachineMetrics = {
  hostname?: string;
  os?: string;
  disk_free?: string;
  disk_used_pct?: string;
  load_avg_1m?: string;
  mem_free_mb?: number;
  uptime?: string;
  recorded_at?: string;
};

export type MachineEntry = {
  id: string;
  name: string;
  agent: string;
  emoji: string;
  metrics: MachineMetrics | null;
  lastUpdated: string | null;
};

export type MachinesResponse = {
  machines: MachineEntry[];
};

export function useMachines() {
  return useSWR<MachinesResponse>("/api/machines", fetcher, {
    refreshInterval: 60000,
  });
}

// ---------------------------------------------------------------------------
// Crons
// ---------------------------------------------------------------------------

export type CronJob = {
  id: string;
  name: string;
  schedule: string;
  agent: string;
  errorMsg?: string;
  next: string;
  last: string;
  status: string;
  target: string;
  agent: string;
  schedule?: string;
  lastRun: string | null;
  nextRun?: string | null;
  status: "ok" | "error" | "unknown";
  errorCount: number;
  lastError: string | null;
  lastOutput?: string | null;
};

export type CronsResponse = {
  crons: CronJob[];
  total: number;
  lastUpdated: string | null;
};

export function useCrons() {
  return useSWR<CronsResponse>("/api/crons", fetcher, {
    refreshInterval: 60_000,
  });
}

// ── Daily Digest ──────────────────────────────────────────────────────────────

export type DigestResponse = {
  brief: string;
  daysLeft: number;
  totalChunks: number;
  generated: string;
};

export async function generateDailyDigest(): Promise<DigestResponse> {
  const res = await fetch("/api/daily-digest", { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate digest");
  return res.json() as Promise<DigestResponse>;
}

// ── Inline task creation ──────────────────────────────────────────────────────

export async function createNotionTask(title: string, status: string): Promise<{ id: string }> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, status }),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json() as Promise<{ id: string }>;
}

// ── Skills ────────────────────────────────────────────────────────────────────

export interface SkillEntry {
  id: string; name: string; description: string; emoji: string;
  installed: boolean; builtin: boolean; requires: string[]; location: string;
}

export function useSkills() {
  return useSWR<{ skills: SkillEntry[]; total: number }>("/api/skills", fetcher, { refreshInterval: 60000 });
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface APIKey {
  name: string;
  masked: string;
  set: boolean;
}

export function useAPIKeys() {
  return useSWR<{ keys: APIKey[] }>("/api/settings/keys", fetcher, { revalidateOnFocus: false });
}

export async function updateAPIKey(name: string, value: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/settings/keys/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Failed to update key");
  return res.json() as Promise<{ ok: boolean }>;
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface Model {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
}

export interface ModelsResponse {
  models: Model[];
  preferred: string | null;
  total: number;
}

export function useModels() {
  return useSWR<ModelsResponse>("/api/settings/models", fetcher, { revalidateOnFocus: false });
}

export async function setPreferredModel(modelId: string): Promise<{ ok: boolean }> {
  const res = await fetch("/api/settings/models/preferred", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
  if (!res.ok) throw new Error("Failed to set preferred model");
  return res.json() as Promise<{ ok: boolean }>;
}

// Fleet status
export interface FleetConnectivity { name: string; ok: boolean; message: string }
export interface FleetStatus {
  overall: "green" | "yellow" | "red";
  updatedAt: number;
  cached?: boolean;
  crons: { total: number; ok: number; errors: number; recentErrors: Array<{ id: string; name: string; last: string }> };
  agents: { total: number; online: number; items: Array<{ id: string; name: string; emoji: string; status: string; lastHeartbeat: number | null }> };
  gateway: { running: boolean; mode: string; port: string; warnings: string[] };
  memory: { facts: number; decisions: number; checkpoints: number };
  services: { api: boolean; qdrant: boolean; lancedb: boolean; chunks: number };
  connectivity: FleetConnectivity[];
}

export function useFleetStatus() {
  return useSWR<FleetStatus>("/api/fleet/status", fetcher, { refreshInterval: 3 * 60 * 1000 });
}

// Sessions
export interface SessionItem {
  key: string; label: string; kind: "direct" | "group" | "cron" | "subagent";
  model: string; modelProvider: string; updatedAt: number; ageLabel: string;
  contextTokens: number; totalTokens: number; inputTokens: number; outputTokens: number;
  aborted: boolean; origin: string;
}
export interface SessionsData { total: number; sessions: SessionItem[]; modelSummary: Record<string, number> }

export function useSessions() {
  return useSWR<SessionsData>("/api/sessions", fetcher, { refreshInterval: 30_000 });
}

// Agent profile
export interface AgentProfile { id: string; name: string; emoji: string; identity: string | null; soul: string | null; status: Record<string, unknown> | null }

export function useAgentProfile(id: string | null) {
  return useSWR<AgentProfile>(id ? `/api/agents/${id}/profile` : null, fetcher);
}

// Coordination
export interface CoordSorenStatus {
  agent: string; role: string; timestamp: string; health: string;
  active_tasks: string[]; completed_today: string[]; blockers: string[];
  needs_attention: boolean | string[]; next_heartbeat?: string;
  machine_metrics?: Record<string, string | number>;
}
export interface CoordStatus {
  pullResult: string;
  sorenStatus: CoordSorenStatus | null;
  gitLog: Array<{ hash: string; msg: string; date: string }>;
  syncFiles: string[];
  sorenDailyFiles: string[];
  aurelOutbox: string[];
  updatedAt: number;
}
export function useCoordStatus() {
  return useSWR<CoordStatus>("/api/coordination/status", fetcher, { refreshInterval: 5 * 60 * 1000 });
}
export function useCoordFile(relPath: string | null) {
  return useSWR<{ path: string; content: string }>(
    relPath ? `/api/coordination/file?path=${encodeURIComponent(relPath)}` : null,
    fetcher
  );
}

// Business config
export interface BusinessConfig { name: string; url: string; description: string; industry: string; targetAudience: string; tone: string; }
export function useBusiness() {
  return useSWR<BusinessConfig>("/api/business", fetcher);
}

// Integrations
export interface Integration { id: string; name: string; icon: string; category: string; status: "connected" | "disconnected" | "unknown"; detail: string; }
export function useIntegrations() {
  return useSWR<{ integrations: Integration[] }>("/api/integrations", fetcher, { refreshInterval: 2 * 60 * 1000 });
}

// ---------------------------------------------------------------------------
// Coordination feed
// ---------------------------------------------------------------------------

export type CoordinationMessage = {
  id: string;
  agent: string;
  emoji: string;
  filename: string;
  date: string;
  title: string;
  preview: string;
  mtime: number;
};

export type CoordinationFeedResponse = {
  messages: CoordinationMessage[];
};

export function useCoordinationFeed() {
  return useSWR<CoordinationFeedResponse>("/api/coordination/feed", fetcher, {
    refreshInterval: 60000,
  });
}

// ---------------------------------------------------------------------------
// Task status update (Notion write-back)
// ---------------------------------------------------------------------------

export async function updateTaskStatus(
  id: string,
  status: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// SSE hook — real-time agent updates
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { mutate } from "swr";

export function useAgentSSE() {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connect = () => {
      const es = new EventSource("/api/events");
      esRef.current = es;

      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as { type: string };
          if (msg.type === "heartbeat" || msg.type === "snapshot") {
            // Trigger SWR revalidation for agents
            void mutate("/api/agents");
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      esRef.current?.close();
    };
  }, []);
}
