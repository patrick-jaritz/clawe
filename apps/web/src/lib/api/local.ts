import useSWR from "swr";

// Use relative URLs — Next.js proxy routes /api/* → localhost:3001
// This works from any device (Tailscale, mobile, etc.)
const API_BASE = "";

const fetcher = (url: string) =>
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
  currentActivity: string | null;
  lastHeartbeat: number;
};

export type LocalTask = {
  _id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
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
  category: 'byl' | 'tools' | 'intelligence' | 'external';
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
