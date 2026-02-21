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
