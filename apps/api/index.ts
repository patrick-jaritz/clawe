import express from "express";
import cors from "cors";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import intelRouter from "./routes/intel.js";
import projectsRouter from "./routes/projects.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getNotionKey(): string | null {
  try {
    const cfg = JSON.parse(
      execSync("cat ~/.openclaw/openclaw.json", { encoding: "utf8" }),
    );
    return cfg.env?.vars?.NOTION_API_KEY ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notion API helper
// ---------------------------------------------------------------------------

function notionRequest(
  path: string,
  notionKey: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.notion.com",
      path,
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Status file helpers
// ---------------------------------------------------------------------------

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function deriveStatus(health: unknown): "online" | "offline" {
  if (health === "green" || health === "online") return "online";
  return "offline";
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/intel", intelRouter);
app.use("/api/projects", projectsRouter);

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/system/health
// ---------------------------------------------------------------------------

app.get("/api/system/health", async (_req, res) => {
  // Check Qdrant
  let qdrantOk = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 6333,
          path: "/readyz",
          timeout: 1000,
        },
        (response) => {
          qdrantOk = response.statusCode === 200;
          resolve();
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
      req.end();
    });
  } catch {
    qdrantOk = false;
  }

  // Check LanceDB directory
  const lanceDbPath = "/Users/centrick/clawd/aurel/memory-system/lancedb/";
  let lanceDbOk = false;
  let chunkCount = 0;
  try {
    lanceDbOk = fs.existsSync(lanceDbPath);
    if (lanceDbOk) {
      // Try to get chunk count from intel stats
      try {
        const { intelCount } = await import("./lib/lancedb.js");
        chunkCount = await intelCount();
      } catch {
        chunkCount = 0;
      }
    }
  } catch {
    lanceDbOk = false;
  }

  res.json({
    services: {
      api: { ok: true, label: "CLAWE API" },
      qdrant: { ok: qdrantOk, label: "Qdrant :6333" },
      lancedb: { ok: lanceDbOk, label: "LanceDB", chunks: chunkCount },
    },
    next_ingest: "5:00 AM",
  });
});

// ---------------------------------------------------------------------------
// GET /api/system/recent-intel
// ---------------------------------------------------------------------------

app.get("/api/system/recent-intel", async (_req, res) => {
  try {
    const { intelListAll } = await import("./lib/lancedb.js");
    const { chunks } = await intelListAll(1, 5, "all");

    // Format chunks for home page display
    const recentChunks = chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      source: chunk.source,
      date: chunk.date,
      url: chunk.url,
      entity_type: chunk.entity_type,
    }));

    res.json({ chunks: recentChunks });
  } catch (err) {
    console.error("Error fetching recent intel:", err);
    res.json({ chunks: [] });
  }
});

// ---------------------------------------------------------------------------
// GET /api/agents
// ---------------------------------------------------------------------------

app.get("/api/agents", (_req, res) => {
  const aurelData = readJsonFile(
    path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json"),
  );
  const sorenData = readJsonFile(
    path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json"),
  );

  function buildAgent(
    id: string,
    name: string,
    role: string,
    emoji: string,
    sessionKey: string,
    data: Record<string, unknown> | null,
  ) {
    const activeTasks = (data?.active_tasks as string[] | undefined) ?? [];
    const completedToday = (data?.completed_today as string[] | undefined) ?? [];
    const blockers = (data?.blockers as string[] | undefined) ?? [];
    const needsAttention = data?.needs_attention ?? false;
    const rawTs = data?.timestamp ?? data?.last_updated;
    const lastHeartbeat = rawTs
      ? new Date(String(rawTs)).getTime()
      : (data ? Date.now() : 0);

    return {
      _id: id,
      name,
      role,
      emoji,
      sessionKey,
      status: data ? deriveStatus(data.health) : "offline",
      health: (data?.health as string | undefined) ?? "offline",
      currentActivity: activeTasks[0] ?? null,
      activeFocus: (data?.active_focus as string | undefined) ?? activeTasks[0] ?? null,
      activeTasks,
      completedToday,
      blockers,
      needsAttention,
      notes: (data?.notes as string | undefined) ?? "",
      lastHeartbeat,
    };
  }

  const agents = [
    buildAgent("aurel", "Aurel", "Chief of Staff", "🏛️", "agent:main:main", aurelData),
    buildAgent("soren", "Søren", "Strategist", "🧠", "agent:soren:main", sorenData),
  ];

  res.json(agents);
});

// ---------------------------------------------------------------------------
// GET /api/agents/:id
// ---------------------------------------------------------------------------

app.get("/api/agents/:id", (_req, res) => {
  const { id } = _req.params;

  const statusPaths: Record<string, string> = {
    aurel: path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json"),
    soren: path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json"),
  };

  const agentMeta: Record<string, { name: string; role: string; emoji: string; sessionKey: string }> = {
    aurel: { name: "Aurel", role: "Chief of Staff", emoji: "🏛️", sessionKey: "agent:main:main" },
    soren: { name: "Søren", role: "Strategist", emoji: "🧠", sessionKey: "agent:soren:main" },
  };

  if (!statusPaths[id]) {
    res.status(404).json({ error: `Agent '${id}' not found` });
    return;
  }

  const data = readJsonFile(statusPaths[id]);
  const meta = agentMeta[id];
  const activeTasks = (data?.active_tasks as string[] | undefined) ?? [];
  const completedToday = (data?.completed_today as string[] | undefined) ?? [];
  const blockers = (data?.blockers as string[] | undefined) ?? [];
  const rawTs = data?.timestamp ?? data?.last_updated;

  res.json({
    _id: id,
    ...meta,
    status: data ? deriveStatus(data.health) : "offline",
    health: (data?.health as string | undefined) ?? "offline",
    currentActivity: activeTasks[0] ?? null,
    activeFocus: (data?.active_focus as string | undefined) ?? activeTasks[0] ?? null,
    activeTasks,
    completedToday,
    blockers,
    needsAttention: data?.needs_attention ?? false,
    notes: (data?.notes as string | undefined) ?? "",
    lastHeartbeat: rawTs ? new Date(String(rawTs)).getTime() : (data ? Date.now() : 0),
    raw: data,
  });
});

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------

const NOTION_TODAY_DB = "305ec8c982bb800f980fd862300a9349";

function mapNotionStatus(status: string): string {
  switch (status) {
    case "Not started":
      return "inbox";
    case "In progress":
      return "in_progress";
    case "Done":
      return "done";
    case "Blocked":
      return "review";
    default:
      return "inbox";
  }
}

app.get("/api/tasks", async (_req, res) => {
  const notionKey = getNotionKey();
  if (!notionKey) {
    res.status(500).json({ error: "NOTION_API_KEY not found" });
    return;
  }

  try {
    const result = (await notionRequest(
      `/v1/databases/${NOTION_TODAY_DB}/query`,
      notionKey,
      { page_size: 100 },
    )) as { results: unknown[] };

    const tasks = (result.results ?? []).map((page: unknown) => {
      const p = page as Record<string, unknown>;
      const props = p.properties as Record<string, unknown>;

      // Extract title
      const titleProp = props.Name ?? props.Title ?? props.title;
      const titleArr = (titleProp as Record<string, unknown>)?.title as
        | unknown[]
        | undefined;
      const title =
        (
          titleArr?.[0] as Record<string, unknown> | undefined
        )?.plain_text?.toString() ?? "Untitled";

      // Extract status
      const statusProp = props.Status ?? props.status;
      const statusName =
        (
          (statusProp as Record<string, unknown>)?.status as
            | Record<string, unknown>
            | undefined
        )?.name?.toString() ?? "";
      const status = mapNotionStatus(statusName);

      // Extract assignee from "Assigned to" or "Assignee" property
      const assigneeProp =
        props["Assigned to"] ??
        props.Assignee ??
        props.assignee ??
        props.Agent;
      const selectName = (
        (assigneeProp as Record<string, unknown>)?.select as
          | Record<string, unknown>
          | undefined
      )?.name
        ?.toString()
        .toLowerCase();

      let assigneeIds: string[] = [];
      let assignees: { _id: string; name: string; emoji: string }[] = [];

      if (selectName?.includes("aurel")) {
        assigneeIds = ["aurel"];
        assignees = [{ _id: "aurel", name: "Aurel", emoji: "🏛️" }];
      } else if (selectName?.includes("soren") || selectName?.includes("søren")) {
        assigneeIds = ["soren"];
        assignees = [{ _id: "soren", name: "Søren", emoji: "🧠" }];
      }

      return {
        _id: p.id as string,
        title,
        description: "",
        status,
        priority: "normal",
        assigneeIds,
        assignees,
        subtasks: [],
        documentCount: 0,
      };
    });

    res.json(tasks);
  } catch (err) {
    console.error("Notion API error:", err);
    res.status(500).json({ error: "Failed to fetch tasks from Notion" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/activities
// ---------------------------------------------------------------------------

app.get("/api/activities", (_req, res) => {
  const syncDir = path.join(
    process.env.HOME ?? "/Users/centrick",
    "clawd/coordination/sync",
  );

  try {
    if (!fs.existsSync(syncDir)) {
      res.json([]);
      return;
    }

    const files = fs
      .readdirSync(syncDir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".txt") || f.endsWith(".log"))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(syncDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      res.json([]);
      return;
    }

    const latestFile = path.join(syncDir, files[0].name);
    const content = fs.readFileSync(latestFile, "utf8");
    const lines = content.split("\n").filter((l) => l.trim()).slice(-20);

    const activities = lines.map((line, i) => ({
      _id: `sync-${i}`,
      type: "sync",
      agentId: "aurel",
      message: line.trim(),
      createdAt: Date.now() - (lines.length - i) * 1000,
    }));

    res.json(activities.reverse());
  } catch (err) {
    console.error("Error reading sync files:", err);
    res.json([]);
  }
});

// ---------------------------------------------------------------------------
// POST /api/agents/:id/heartbeat
// ---------------------------------------------------------------------------

const AGENT_STATUS_PATHS: Record<string, string> = {
  aurel: path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json"),
  soren: path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json"),
};

app.post("/api/agents/:id/heartbeat", express.json(), (req, res) => {
  const { id } = req.params;
  const statusPath = AGENT_STATUS_PATHS[id];

  if (!statusPath) {
    res.status(404).json({ error: `Agent '${id}' not found` });
    return;
  }

  try {
    const existing = readJsonFile(statusPath) ?? {};
    const updated = {
      ...existing,
      ...req.body,
      agent: id,
      timestamp: req.body.timestamp ?? new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify(updated, null, 2));
    // Notify SSE subscribers
    notifySSE({ type: "heartbeat", agent: id, data: updated });
    res.json({ ok: true, agent: id, updatedAt: updated.last_updated });
  } catch (err) {
    console.error("Heartbeat write error:", err);
    res.status(500).json({ error: "Failed to write status" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/events  (Server-Sent Events — real-time agent updates)
// ---------------------------------------------------------------------------

type SSEClient = { res: import("express").Response; id: number };
const sseClients: SSEClient[] = [];
let sseClientId = 0;

function notifySSE(event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    client.res.write(`data: ${data}\n\n`);
  }
}

// Heartbeat ping to keep connections alive
setInterval(() => notifySSE({ type: "ping", ts: Date.now() }), 25000);

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const id = ++sseClientId;
  sseClients.push({ res, id });

  // Send current agent snapshot immediately on connect
  const aurel = readJsonFile(AGENT_STATUS_PATHS.aurel);
  const soren = readJsonFile(AGENT_STATUS_PATHS.soren);
  res.write(`data: ${JSON.stringify({ type: "snapshot", agents: { aurel, soren } })}\n\n`);

  req.on("close", () => {
    const idx = sseClients.findIndex((c) => c.id === id);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/machines  (multi-machine metrics aggregated from status files)
// ---------------------------------------------------------------------------

app.get("/api/machines", (_req, res) => {
  const machines: Array<{
    id: string;
    name: string;
    agent: string;
    emoji: string;
    metrics: Record<string, unknown> | null;
    lastUpdated: string | null;
  }> = [];

  const entries = [
    { id: "aurelhost", name: "Aurel's Mac", agent: "aurel", emoji: "🏛️",
      path: path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json") },
    { id: "macbook-patrick", name: "Patrick's MacBook", agent: "soren", emoji: "🧠",
      path: path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json") },
  ];

  for (const entry of entries) {
    const data = readJsonFile(entry.path);
    machines.push({
      id: entry.id,
      name: entry.name,
      agent: entry.agent,
      emoji: entry.emoji,
      metrics: (data?.machine_metrics as Record<string, unknown> | undefined) ?? null,
      lastUpdated: (data?.timestamp as string | undefined) ?? (data?.last_updated as string | undefined) ?? null,
    });
  }

  res.json({ machines });
});

// ---------------------------------------------------------------------------
// GET /api/crons
// ---------------------------------------------------------------------------

app.get("/api/crons", (_req, res) => {
  const cronStateFile = path.join(
    process.env.HOME ?? "/Users/centrick",
    "clawd/crons/state.json",
  );

  try {
    if (fs.existsSync(cronStateFile)) {
      const raw = fs.readFileSync(cronStateFile, "utf8");
      res.json(JSON.parse(raw));
      return;
    }

    // Fallback: scan cron log files in ~/clawd/crons/logs/
    const logsDir = path.join(process.env.HOME ?? "/Users/centrick", "clawd/crons/logs");
    if (!fs.existsSync(logsDir)) {
      res.json({ crons: [], lastUpdated: null });
      return;
    }

    const logFiles = fs.readdirSync(logsDir).filter((f) => f.endsWith(".log"));
    const crons = logFiles.map((file) => {
      const content = fs.readFileSync(path.join(logsDir, file), "utf8");
      const lines = content.split("\n").filter(Boolean);
      const lastLine = lines[lines.length - 1] ?? "";
      const errorLines = lines.filter((l) => l.toLowerCase().includes("error") || l.toLowerCase().includes("fail"));

      return {
        id: file.replace(".log", ""),
        name: file.replace(".log", "").replace(/-/g, " "),
        lastRun: null,
        status: errorLines.length > 0 ? "error" : "ok",
        errorCount: errorLines.length,
        lastError: errorLines[errorLines.length - 1] ?? null,
        lastOutput: lastLine,
      };
    });

    res.json({ crons, lastUpdated: new Date().toISOString() });
  } catch (err) {
    console.error("Cron state error:", err);
    res.json({ crons: [], lastUpdated: null });
  }
});

// ---------------------------------------------------------------------------
// GET /api/coordination/feed
// ---------------------------------------------------------------------------

app.get("/api/coordination/feed", (_req, res) => {
  const HOME = process.env.HOME ?? "/Users/centrick";
  const outboxDirs: Array<{ dir: string; agent: string; emoji: string }> = [
    { dir: path.join(HOME, "clawd/coordination/soren/outbox"), agent: "soren", emoji: "🧠" },
    { dir: path.join(HOME, "clawd/aurel/outbox"), agent: "aurel", emoji: "🏛️" },
    // Also try coordination-relative paths
    { dir: path.join(HOME, "clawd/coordination/aurel/outbox"), agent: "aurel", emoji: "🏛️" },
  ];

  const messages: Array<{
    id: string;
    agent: string;
    emoji: string;
    filename: string;
    date: string;
    title: string;
    preview: string;
    mtime: number;
  }> = [];

  const seen = new Set<string>();

  for (const { dir, agent, emoji } of outboxDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
    for (const file of files.slice(0, 10)) {
      const key = `${agent}:${file}`;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const fullPath = path.join(dir, file);
        const content = fs.readFileSync(fullPath, "utf8");
        const mtime = fs.statSync(fullPath).mtimeMs;
        const lines = content.split("\n").filter(Boolean);
        const titleLine = lines.find((l) => l.startsWith("# ")) ?? lines[0] ?? file;
        const title = titleLine.replace(/^#+\s*/, "").trim();
        const preview = lines.filter((l) => !l.startsWith("#")).slice(0, 2).join(" ").trim();

        messages.push({
          id: `${agent}-${file}`,
          agent,
          emoji,
          filename: file,
          date: file.slice(0, 10) || new Date(mtime).toISOString().slice(0, 10),
          title,
          preview,
          mtime,
        });
      } catch {
        // skip unreadable
      }
    }
  }

  messages.sort((a, b) => b.mtime - a.mtime);
  res.json({ messages: messages.slice(0, 20) });
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/status  (Notion write-back)
// ---------------------------------------------------------------------------

app.patch("/api/tasks/:id/status", express.json(), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };

  const notionKey = getNotionKey();
  if (!notionKey) {
    res.status(500).json({ error: "NOTION_API_KEY not found" });
    return;
  }

  // Map internal status → Notion status name
  const notionStatusMap: Record<string, string> = {
    inbox: "Not started",
    assigned: "Not started",
    in_progress: "In progress",
    review: "Blocked",
    done: "Done",
  };

  const notionStatus = notionStatusMap[status];
  if (!notionStatus) {
    res.status(400).json({ error: `Unknown status: ${status}` });
    return;
  }

  try {
    await notionRequest(
      `/v1/pages/${id}`,
      notionKey,
      {
        properties: {
          Status: { status: { name: notionStatus } },
        },
      },
    );
    res.json({ ok: true, id, status, notionStatus });
  } catch (err) {
    console.error("Notion status update error:", err);
    res.status(500).json({ error: "Failed to update Notion task" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/repos  (watchlist repos from github-repos.json + resources.md)
// ---------------------------------------------------------------------------

interface WatchlistRepo {
  owner: string;
  repo: string;
  category: string;
  description: string;
  why: string;
  added: string;
  path?: string;
}

interface WatchlistData {
  meta: { description: string; lastChecked: string; createdAt: string; sources: string[] };
  repos: WatchlistRepo[];
}

const WATCHLIST_DIR = path.join(
  process.env.HOME ?? "/Users/centrick",
  "clawd/workspace/watchlist",
);

// Also check Patrick's workspace path
const WATCHLIST_DIR_ALT = "/Users/patrickjaritz/.openclaw/workspace/watchlist";

function getWatchlistDir(): string {
  if (fs.existsSync(path.join(WATCHLIST_DIR, "github-repos.json"))) return WATCHLIST_DIR;
  if (fs.existsSync(path.join(WATCHLIST_DIR_ALT, "github-repos.json"))) return WATCHLIST_DIR_ALT;
  return WATCHLIST_DIR;
}

app.get("/api/repos", (req, res) => {
  const dir = getWatchlistDir();
  const reposPath = path.join(dir, "github-repos.json");

  if (!fs.existsSync(reposPath)) {
    return res.json({ repos: [], categories: [], meta: null });
  }

  try {
    const data: WatchlistData = JSON.parse(fs.readFileSync(reposPath, "utf8"));
    const categoryFilter = req.query.category as string | undefined;
    const search = (req.query.q as string | undefined)?.toLowerCase();

    let repos = data.repos;

    if (categoryFilter && categoryFilter !== "all") {
      repos = repos.filter((r) => r.category === categoryFilter);
    }
    if (search) {
      repos = repos.filter(
        (r) =>
          r.repo.toLowerCase().includes(search) ||
          r.owner.toLowerCase().includes(search) ||
          r.description.toLowerCase().includes(search) ||
          r.why.toLowerCase().includes(search) ||
          r.category.toLowerCase().includes(search),
      );
    }

    // Extract unique categories with counts
    const catMap = new Map<string, number>();
    for (const r of data.repos) {
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
    }
    const categories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ repos, categories, meta: data.meta, total: data.repos.length });
  } catch (err) {
    console.error("Repos read error:", err);
    res.status(500).json({ error: "Failed to read repos" });
  }
});

app.get("/api/repos/resources", (_req, res) => {
  const dir = getWatchlistDir();
  const resourcesPath = path.join(dir, "resources.md");

  if (!fs.existsSync(resourcesPath)) {
    return res.json({ content: "" });
  }

  try {
    const content = fs.readFileSync(resourcesPath, "utf8");
    res.json({ content });
  } catch {
    res.status(500).json({ error: "Failed to read resources" });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`CENTAUR API running on http://localhost:${PORT}`);
});

// ── Mindwtr data proxy ─────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "fs";
const MINDWTR_DATA_PATH = path.join(
  process.env.HOME ?? "/Users/centrick",
  "Library/Application Support/mindwtr/data.json"
);

app.get("/api/mindwtr/data", (_req, res) => {
  try {
    const raw = readFileSync(MINDWTR_DATA_PATH, "utf8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ tasks: [], projects: [], sections: [], areas: [], settings: {} });
  }
});

app.post("/api/mindwtr/data", express.json({ limit: "10mb" }), (req, res) => {
  try {
    writeFileSync(MINDWTR_DATA_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
