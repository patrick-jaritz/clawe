import express from "express";
import cors from "cors";
import { execSync, spawn } from "child_process";
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
  method?: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.notion.com",
      path,
      method: method ?? (body ? "POST" : "GET"),
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

const AGENT_STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours (agents run every 30min–4h)

function deriveStatus(health: unknown, lastHeartbeatMs?: number): "online" | "offline" {
  if (lastHeartbeatMs !== undefined) {
    if (Date.now() - lastHeartbeatMs > AGENT_STALE_THRESHOLD_MS) return "offline";
  }
  if (health === "green" || health === "online") return "online";
  return "offline";
}

function resolveHeartbeat(data: Record<string, unknown> | null): number | undefined {
  if (!data) return undefined;
  // Aurel status: numeric unix epoch (seconds)
  if (typeof data.timestamp === "number") return data.timestamp * 1000;
  // Soren status: ISO 8601 string timestamp
  if (typeof data.timestamp === "string") {
    const ms = new Date(data.timestamp).getTime();
    if (!isNaN(ms)) return ms;
  }
  // Fallback: last_updated ISO string
  if (typeof data.last_updated === "string") {
    const ms = new Date(data.last_updated).getTime();
    if (!isNaN(ms)) return ms;
  }
  return undefined;
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

  // Compute next 5:00 AM Jerusalem time dynamically
  function nextIngestLabel(): string {
    try {
      const tz = "Asia/Jerusalem";
      const now = new Date();
      // Build today's 5:00 AM in Jerusalem
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
      const candidate = new Date(`${todayStr}T05:00:00`);
      // Adjust for Jerusalem offset
      const tzOffset = new Date(candidate.toLocaleString("en-US", { timeZone: tz })).getTime() - candidate.getTime();
      const next5am = new Date(candidate.getTime() - tzOffset);
      // If already past, add 1 day
      const target = next5am <= now ? new Date(next5am.getTime() + 24 * 60 * 60 * 1000) : next5am;
      const diffMs = target.getTime() - now.getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      if (diffH === 0) return `in ${diffM}m (5:00 AM)`;
      return `in ${diffH}h ${diffM}m (5:00 AM)`;
    } catch {
      return "5:00 AM";
    }
  }

  res.json({
    services: {
      api: { ok: true, label: "CLAWE API" },
      qdrant: { ok: qdrantOk, label: "Qdrant :6333" },
      lancedb: { ok: lanceDbOk, label: "LanceDB", chunks: chunkCount },
    },
    next_ingest: nextIngestLabel(),
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

  const aurelHeartbeat = resolveHeartbeat(aurelData);
  const sorenHeartbeat = resolveHeartbeat(sorenData);

  const agents = [
    {
      _id: "aurel",
      name: "Aurel",
      role: "Chief of Staff",
      emoji: "🏛️",
      sessionKey: "agent:main:main",
      status: aurelData ? deriveStatus(aurelData.health, aurelHeartbeat) : "offline",
      currentActivity:
        (aurelData?.active_tasks as unknown[])?.[0] !== undefined
          ? String((aurelData!.active_tasks as unknown[])[0])
          : null,
      lastHeartbeat: aurelHeartbeat ?? null,
    },
    {
      _id: "soren",
      name: "Søren",
      role: "Strategist",
      emoji: "🧠",
      sessionKey: "agent:soren:main",
      status: sorenData ? deriveStatus(sorenData.health, sorenHeartbeat) : "offline",
      currentActivity:
        (sorenData?.active_tasks as unknown[])?.[0] !== undefined
          ? String((sorenData!.active_tasks as unknown[])[0])
          : null,
      lastHeartbeat: sorenHeartbeat ?? null,
    },
  ];

  res.json(agents);
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

      // Extract priority
      const priorityProp = props.Priority ?? props.priority;
      const priorityName = (
        (priorityProp as Record<string, unknown>)?.select as Record<string, unknown> | undefined
      )?.name?.toString().toLowerCase() ?? "";
      const priority: "low" | "medium" | "high" =
        priorityName.includes("high") ? "high"
        : priorityName.includes("medium") ? "medium"
        : priorityName.includes("low") ? "low"
        : "low";

      // Extract due date
      const dueProp = props["Due date"] ?? props["Due"] ?? props.due_date ?? props.Date;
      const dueDate = (
        (dueProp as Record<string, unknown>)?.date as Record<string, unknown> | undefined
      )?.start?.toString() ?? null;

      return {
        _id: p.id as string,
        title,
        description: "",
        status,
        priority,
        dueDate,
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
// POST /api/tasks — create a new task in Notion TODAY database
// ---------------------------------------------------------------------------

app.post("/api/tasks", async (req, res) => {
  const notionKey = getNotionKey();
  if (!notionKey) { res.status(500).json({ error: "NOTION_API_KEY not found" }); return; }

  const { title, status = "inbox" } = req.body as { title: string; status?: string };
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }

  const notionStatus = NOTION_STATUS_MAP[status] ?? "Not started";
  try {
    const result = (await notionRequest(
      "/v1/pages",
      notionKey,
      {
        parent: { database_id: NOTION_TODAY_DB },
        properties: {
          Name: { title: [{ text: { content: title.trim() } }] },
          Status: { status: { name: notionStatus } },
        },
      },
    )) as Record<string, unknown>;
    res.json({ id: result.id as string });
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/status
// ---------------------------------------------------------------------------

const NOTION_STATUS_MAP: Record<string, string> = {
  inbox: "Not started",
  assigned: "Not started",
  in_progress: "In progress",
  review: "Blocked",
  done: "Done",
};

app.patch("/api/tasks/:id/status", async (req, res) => {
  const notionKey = getNotionKey();
  if (!notionKey) {
    res.status(500).json({ error: "NOTION_API_KEY not found" });
    return;
  }

  const { id } = req.params;
  const { status } = req.body as { status: string };

  if (!status || !NOTION_STATUS_MAP[status]) {
    res.status(400).json({ error: `Invalid status: ${status}` });
    return;
  }

  try {
    await notionRequest(
      `/v1/pages/${id}`,
      notionKey,
      {
        properties: {
          Status: { status: { name: NOTION_STATUS_MAP[status] } },
        },
      },
      "PATCH",
    );
    res.json({ ok: true, status });
  } catch (err) {
    console.error("Failed to update Notion task status:", err);
    res.status(500).json({ error: "Failed to update task status" });
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
// GET /api/crons — list all OpenClaw cron jobs
// ---------------------------------------------------------------------------

// ── Read-only share token ───────────────────────────────────────────────────
const SHARE_TOKEN_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "share-token.json");

function loadShareToken(): string | null {
  try {
    if (fs.existsSync(SHARE_TOKEN_PATH)) {
      return (JSON.parse(fs.readFileSync(SHARE_TOKEN_PATH, "utf8")) as { token: string }).token;
    }
  } catch { /* silent */ }
  return null;
}

function saveShareToken(token: string): void {
  const dir = path.dirname(SHARE_TOKEN_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SHARE_TOKEN_PATH, JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2));
}

app.get("/api/share/token", (_req, res) => {
  const token = loadShareToken();
  if (!token) { res.json({ token: null }); return; }
  res.json({ token });
});

app.post("/api/share/token", (_req, res) => {
  const token = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
  saveShareToken(token);
  res.json({ token });
});

app.delete("/api/share/token", (_req, res) => {
  try { if (fs.existsSync(SHARE_TOKEN_PATH)) fs.unlinkSync(SHARE_TOKEN_PATH); } catch { /* ok */ }
  res.json({ revoked: true });
});

// Validate share token (used by share page)
app.get("/api/share/validate", (req, res) => {
  const { token } = req.query as { token?: string };
  const stored = loadShareToken();
  if (!stored || !token || token !== stored) {
    res.status(401).json({ valid: false });
    return;
  }
  res.json({ valid: true });
});

// Public share snapshot (accessible with valid token)
app.get("/api/share/snapshot", async (req, res) => {
  const { token } = req.query as { token?: string };
  const stored = loadShareToken();
  if (!stored || !token || token !== stored) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  try {
    // Gather: running projects, system health, quick agent status
    const projectsRaw = execSync(
      `node -e "const s=require('/Users/centrick/.openclaw/workspace/../../../clawd/repos/clawe/apps/api/state/process-state.json'); console.log(JSON.stringify(s))" 2>/dev/null`,
      { encoding: "utf8", timeout: 3000 }
    );
    res.json({
      ts: new Date().toISOString(),
      note: "Read-only CLAWE snapshot",
    });
  } catch {
    res.json({ ts: new Date().toISOString(), note: "Snapshot available" });
  }
});

// ── DBA Paper Progress ──────────────────────────────────────────────────────
const DBA_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "dba-progress.json");

type DBASection = { id: string; title: string; done: boolean };
type DBAPaper = { id: string; title: string; deadline: string; sections: DBASection[] };
type DBAProgress = { papers: DBAPaper[]; updatedAt: string };

function defaultDBAProgress(): DBAProgress {
  const sections = [
    "Abstract", "Introduction", "Literature Review",
    "Methodology", "Results", "Discussion", "Conclusion"
  ];
  return {
    updatedAt: new Date().toISOString(),
    papers: [
      { id: "p1", title: "Paper 1", deadline: "2026-03-31", sections: sections.map((t, i) => ({ id: `p1-${i}`, title: t, done: false })) },
      { id: "p2", title: "Paper 2", deadline: "2026-03-31", sections: sections.map((t, i) => ({ id: `p2-${i}`, title: t, done: false })) },
      { id: "p3", title: "Paper 3", deadline: "2026-03-31", sections: sections.map((t, i) => ({ id: `p3-${i}`, title: t, done: false })) },
    ],
  };
}

function loadDBA(): DBAProgress {
  try {
    if (fs.existsSync(DBA_PATH)) return JSON.parse(fs.readFileSync(DBA_PATH, "utf8")) as DBAProgress;
  } catch { /* silent */ }
  return defaultDBAProgress();
}

function saveDBA(data: DBAProgress) {
  const dir = path.dirname(DBA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DBA_PATH, JSON.stringify(data, null, 2));
}

app.get("/api/dba/progress", (_req, res) => res.json(loadDBA()));

app.patch("/api/dba/progress", (req, res) => {
  const data = loadDBA();
  const { paperId, sectionId, done, paperTitle } = req.body as {
    paperId?: string; sectionId?: string; done?: boolean; paperTitle?: string;
  };
  if (paperId && sectionId !== undefined && done !== undefined) {
    const paper = data.papers.find((p) => p.id === paperId);
    if (paper) {
      const sec = paper.sections.find((s) => s.id === sectionId);
      if (sec) sec.done = done;
    }
  }
  if (paperId && paperTitle !== undefined) {
    const paper = data.papers.find((p) => p.id === paperId);
    if (paper) paper.title = paperTitle;
  }
  data.updatedAt = new Date().toISOString();
  saveDBA(data);
  res.json(data);
});

// ── Weekly Review ───────────────────────────────────────────────────────────
app.get("/api/weekly-review", async (_req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count cron job runs from recent sessions (approximation via log scan)
    let cronRunsTotal = 0;
    let cronErrors = 0;
    try {
      const logs = execSync(
        `grep -r "Cron\\|cron" /Users/centrick/.openclaw/logs/ 2>/dev/null | wc -l`,
        { encoding: "utf8", timeout: 3000 }
      ).trim();
      cronRunsTotal = parseInt(logs) || 0;
    } catch { /* ok */ }

    // Count Intel chunks ingested this week
    let intelChunks = 0;
    try {
      const { intelCount } = await import("./lib/lancedb.js");
      intelChunks = await intelCount();
    } catch { /* ok */ }

    // Read daily logs for completed tasks
    const dailyLogsDir = "/Users/centrick/clawd/aurel/daily/";
    const completedTasks: string[] = [];
    try {
      const files = fs.readdirSync(dailyLogsDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .slice(-7);
      for (const f of files) {
        const content = fs.readFileSync(path.join(dailyLogsDir, f), "utf8");
        const matches = content.match(/^[-•]\s+✅.+$/gm) ?? [];
        completedTasks.push(...matches.map((m) => m.replace(/^[-•]\s+✅\s*/, "")));
      }
    } catch { /* ok */ }

    // Memory stats
    let memStats = "";
    try {
      memStats = execSync(
        `node /Users/centrick/clawd/aurel/memory-system/cli.js stats 2>/dev/null`,
        { encoding: "utf8", timeout: 5000 }
      );
    } catch { /* ok */ }

    res.json({
      weekOf: weekAgo.toISOString().slice(0, 10),
      weekEnding: now.toISOString().slice(0, 10),
      intelChunks,
      completedTasks: completedTasks.slice(-20),
      memStats,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Notion sync status ──────────────────────────────────────────────────────
const NOTION_SYNC_LOG = "/Users/centrick/clawd/aurel/logs/notion-sync.log";

app.get("/api/notion/sync-status", (_req, res) => {
  try {
    let lastSync: string | null = null;
    let lastStatus: "ok" | "error" = "ok";

    if (fs.existsSync(NOTION_SYNC_LOG)) {
      const lines = fs.readFileSync(NOTION_SYNC_LOG, "utf8").trim().split("\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (last) {
        const tsMatch = last.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
        lastSync = tsMatch?.[0] ?? null;
        lastStatus = last.toLowerCase().includes("error") ? "error" : "ok";
      }
    }

    // Also check the process-state for Notion task mutation timestamps
    res.json({ lastSync, lastStatus, logPath: NOTION_SYNC_LOG });
  } catch {
    res.json({ lastSync: null, lastStatus: "unknown" });
  }
});

// Notion tasks are mutated — write sync timestamp
app.post("/api/notion/sync-ping", (req, res) => {
  const { status = "ok" } = req.body as { status?: string };
  try {
    const dir = path.dirname(NOTION_SYNC_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = `${new Date().toISOString()} status=${status}\n`;
    fs.appendFileSync(NOTION_SYNC_LOG, line);
  } catch { /* ok */ }
  res.json({ ok: true });
});

// Tailscale device list
app.get("/api/tailscale/status", (_req, res) => {
  try {
    const raw = execSync("tailscale status --json 2>/dev/null", { encoding: "utf8", timeout: 6000 });
    const data = JSON.parse(raw);
    const self = data.Self ?? {};
    const peers = Object.values(data.Peers ?? {}) as Record<string, unknown>[];

    const mapDevice = (d: Record<string, unknown>, isSelf = false) => ({
      id: d.ID ?? d.PublicKey ?? "",
      name: ((d.HostName as string) ?? (d.DNSName as string) ?? "").replace(/\.$/, ""),
      ip: Array.isArray(d.TailscaleIPs) ? (d.TailscaleIPs as string[])[0] ?? "" : "",
      os: d.OS ?? "",
      online: isSelf ? true : (d.Online ?? false),
      lastSeen: d.LastSeen ?? null,
      relay: d.Relay ?? "",
      isSelf,
    });

    res.json({
      self: mapDevice(self, true),
      peers: peers.map((p) => mapDevice(p as Record<string, unknown>)),
    });
  } catch {
    res.status(503).json({ error: "tailscale not available" });
  }
});

// Memory system query endpoint
const MEMORY_CLI = "/Users/centrick/clawd/aurel/memory-system/cli.js";

app.get("/api/memory/query", (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const cmd = q
      ? `node "${MEMORY_CLI}" query "${q.replace(/"/g, '\\"')}" 2>/dev/null`
      : `node "${MEMORY_CLI}" stats 2>/dev/null`;
    const raw = execSync(cmd, { encoding: "utf8", timeout: 8000 });
    res.json({ raw, query: q });
  } catch (err) {
    res.status(500).json({ error: "Memory query failed", details: String(err) });
  }
});

app.get("/api/memory/decisions", (_req, res) => {
  try {
    const raw = execSync(`node "${MEMORY_CLI}" decisions 2>/dev/null`, { encoding: "utf8", timeout: 8000 });
    res.json({ raw });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch decisions", details: String(err) });
  }
});

app.get("/api/memory/entity/:entity", (req, res) => {
  try {
    const { entity } = req.params;
    const raw = execSync(`node "${MEMORY_CLI}" entity "${entity.replace(/"/g, '\\"')}" 2>/dev/null`, { encoding: "utf8", timeout: 8000 });
    res.json({ raw, entity });
  } catch (err) {
    res.status(500).json({ error: "Entity lookup failed", details: String(err) });
  }
});

// In-memory cron cache — refreshed every 5 min in the background
type CronEntry = { id: string; name: string; schedule: string; next: string; last: string; status: string; target: string; agent: string };
let cronCache: { crons: CronEntry[]; total: number; updatedAt: number } = { crons: [], total: 0, updatedAt: 0 };

function parseCronTable(raw: string): CronEntry[] {
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((l) => l.includes("ID") && l.includes("Name") && l.includes("Schedule"));
  if (headerIdx === -1) return [];
  const header = lines[headerIdx];
  const colStarts = {
    id: header.indexOf("ID"), name: header.indexOf("Name"), schedule: header.indexOf("Schedule"),
    next: header.indexOf("Next"), last: header.indexOf("Last"), status: header.indexOf("Status"),
    target: header.indexOf("Target"), agent: header.indexOf("Agent"),
  };
  const getCol = (line: string, start: number, end: number) => line.slice(start, end).trim();
  const crons: CronEntry[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim() || line.trimStart().startsWith("│") || line.trimStart().startsWith("◇") || line.trimStart().startsWith("─")) continue;
    if (line.length < (colStarts.name ?? 0)) continue;
    const id = getCol(line, colStarts.id ?? 0, colStarts.name ?? 37);
    if (!id) continue;
    crons.push({
      id, name: getCol(line, colStarts.name ?? 37, colStarts.schedule ?? 62),
      schedule: getCol(line, colStarts.schedule ?? 62, colStarts.next ?? 95),
      next: getCol(line, colStarts.next ?? 95, colStarts.last ?? 106),
      last: getCol(line, colStarts.last ?? 106, colStarts.status ?? 117),
      status: getCol(line, colStarts.status ?? 117, colStarts.target ?? 127),
      target: getCol(line, colStarts.target ?? 127, colStarts.agent ?? 137),
      agent: getCol(line, colStarts.agent ?? 137, line.length),
    });
  }
  return crons;
}

function refreshCronCache() {
  // Non-blocking: spawn child process so the API event loop stays free
  const child = spawn("openclaw", ["cron", "list"], { stdio: ["ignore", "pipe", "ignore"] });
  let raw = "";
  child.stdout.on("data", (d: Buffer) => { raw += d.toString(); });
  child.on("close", (code) => {
    if (code === 0 || raw.includes("ID")) {
      const crons = parseCronTable(raw);
      if (crons.length > 0) {
        cronCache = { crons, total: crons.length, updatedAt: Date.now() };
        console.log(`[cron-cache] Refreshed: ${crons.length} crons`);
      }
    }
  });
  child.on("error", (err) => console.error("[cron-cache] spawn error:", err.message));
  // Kill if still running after 15s
  setTimeout(() => { try { child.kill(); } catch { /* ok */ } }, 15000);
}

// Warm the cache on startup + refresh every 5 min
setTimeout(refreshCronCache, 2000);
setInterval(refreshCronCache, 5 * 60 * 1000);

app.get("/api/crons", (_req, res) => {
  // Trigger background refresh if stale (>10 min)
  if (Date.now() - cronCache.updatedAt > 10 * 60 * 1000) {
    refreshCronCache();
  }
  // Always return immediately from cache (may be empty on very first cold start)
  res.json({ crons: cronCache.crons, total: cronCache.total, updatedAt: cronCache.updatedAt });
});

// ---------------------------------------------------------------------------
// POST /api/daily-digest — generate and optionally send a morning brief
// ---------------------------------------------------------------------------

app.post("/api/daily-digest", async (_req, res) => {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const { intelCount: getIntelCount, intelSearch } = await import("./lib/lancedb.js");
    const { embed } = await import("./lib/openai.js");

    const HOME = process.env.HOME ?? "/Users/centrick";

    // Gather data
    const DBA_DEADLINE = new Date("2026-03-31T23:59:00+02:00");
    const daysLeft = Math.ceil((DBA_DEADLINE.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const totalChunks = await getIntelCount();

    // Get recent intel chunks (semantic search for "today recent news updates")
    let recentContext = "";
    try {
      const queryVec = await embed("recent news updates decisions progress");
      const results = await intelSearch(queryVec, 5);
      recentContext = results
        .map((r) => `- ${r.title} (${r.source}): ${r.content.slice(0, 200)}`)
        .join("\n");
    } catch { /* ignore */ }

    // Read Aurel status
    let aurelStatus = "";
    try {
      const s = JSON.parse(fs.readFileSync(path.join(HOME, "clawd/aurel/status/aurel.json"), "utf8"));
      aurelStatus = `Active: ${(s.active_tasks ?? []).join(", ") || "none"}. Completed: ${(s.completed_today ?? []).slice(0, 3).join(", ") || "none"}.`;
    } catch { /* ignore */ }

    const systemPrompt = `You are Aurel, Chief of Staff for CENTAUR. Generate a sharp morning brief for Patrick.
Format: 3 bullet points max. Each bullet = one key fact or action. Be direct.
No fluff. No headers. Just bullets starting with •`;

    const userMsg = `Context:
- DBA papers due in ${daysLeft} days (March 31, 2026)
- Intelligence DB: ${totalChunks} chunks
- Agent status: ${aurelStatus}
- Recent intel:
${recentContext || "(no recent intel)"}

Generate the morning brief.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    const brief = (msg.content[0] as { text: string }).text;
    res.json({ brief, daysLeft, totalChunks, generated: new Date().toISOString() });
  } catch (err) {
    console.error("Daily digest error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

import { intelCount, intelLastIngest } from "./lib/lancedb.js";

app.get("/api/notifications", async (_req, res) => {
  type Notification = {
    id: string;
    type: "deadline" | "agent" | "intel" | "info";
    title: string;
    body?: string;
    urgent: boolean;
    time?: string;
  };

  const notifications: Notification[] = [];

  // 1. DBA deadline (March 31, 2026)
  const DBA_DEADLINE = new Date("2026-03-31T23:59:00+02:00");
  const now = new Date();
  const daysLeft = Math.ceil((DBA_DEADLINE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 60) {
    notifications.push({
      id: "dba-deadline",
      type: "deadline",
      title: `DBA papers due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "3 scientific papers — deadline March 31, 2026",
      urgent: daysLeft <= 14,
      time: DBA_DEADLINE.toISOString(),
    });
  }

  // 2. Agent status
  const agentFiles = [
    { id: "aurel", name: "Aurel", file: "clawd/aurel/status/aurel.json" },
    { id: "soren", name: "Søren", file: "clawd/coordination/status/soren.json" },
  ];
  const HOME = process.env.HOME ?? "/Users/centrick";
  for (const agent of agentFiles) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(HOME, agent.file), "utf8"));
      const ts = typeof raw.timestamp === "number"
        ? raw.timestamp * (raw.timestamp < 1e12 ? 1000 : 1)
        : raw.timestamp
        ? new Date(raw.timestamp).getTime()
        : null;
      if (ts) {
        const staleMins = (Date.now() - ts) / 60000;
        if (staleMins > 60) {
          const staleHrs = Math.floor(staleMins / 60);
          notifications.push({
            id: `agent-offline-${agent.id}`,
            type: "agent",
            title: `${agent.name} offline`,
            body: `No heartbeat in ${staleHrs}h`,
            urgent: staleMins > 240,
            time: new Date(ts).toISOString(),
          });
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Intel chunk count
  try {
    const total = await intelCount();
    const lastIngest = await intelLastIngest();
    if (total > 0) {
      notifications.push({
        id: "intel-chunks",
        type: "intel",
        title: `${total} chunks in knowledge base`,
        body: lastIngest ? `Last ingested ${new Date(lastIngest).toLocaleDateString()}` : undefined,
        urgent: false,
        time: lastIngest ?? undefined,
      });
    }
  } catch { /* ignore */ }

  const unread = notifications.filter((n) => n.urgent).length || notifications.length;

  res.json({ notifications, unread });
});

// ---------------------------------------------------------------------------
// FEATURE 1: Skills API
// ---------------------------------------------------------------------------

const BUILTIN_SKILLS_DIR = path.join(process.env.HOME ?? "/Users/centrick", ".nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills");
const USER_SKILLS_DIR = path.join(process.env.HOME ?? "/Users/centrick", ".openclaw/skills");

interface SkillEntry {
  id: string; name: string; description: string; emoji: string;
  installed: boolean; builtin: boolean; requires: string[]; location: string;
}

app.get("/api/skills", (_req, res) => {
  const skills: SkillEntry[] = [];
  const userInstalled = new Set(fs.existsSync(USER_SKILLS_DIR) ? fs.readdirSync(USER_SKILLS_DIR) : []);

  if (fs.existsSync(BUILTIN_SKILLS_DIR)) {
    for (const entry of fs.readdirSync(BUILTIN_SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const skillPath = path.join(BUILTIN_SKILLS_DIR, entry.name);
      const skillMdPath = path.join(skillPath, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;
      const content = fs.readFileSync(skillMdPath, "utf8");
      const nameM = content.match(/^name:\s*(.+)/m);
      const descM = content.match(/^description:\s*["']([\s\S]*?)["']\s*\n/m) ?? content.match(/^description:\s*(.+)/m);
      const emojiM = content.match(/"emoji":\s*"([^"]+)"/);
      const binsM = content.match(/"bins":\s*\[([^\]]+)\]/);
      const requires = binsM ? binsM[1].split(",").map((b: string) => b.trim().replace(/"/g,"")) : [];
      skills.push({
        id: entry.name,
        name: nameM ? nameM[1].trim() : entry.name,
        description: descM ? descM[1].trim().slice(0, 200) : "",
        emoji: emojiM ? emojiM[1] : "🔧",
        installed: userInstalled.has(entry.name),
        builtin: true,
        requires,
        location: skillPath,
      });
    }
  }
  for (const name of userInstalled) {
    if (skills.find(s => s.id === name)) continue;
    const skillPath = path.join(USER_SKILLS_DIR, name);
    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;
    const content = fs.readFileSync(skillMdPath, "utf8");
    const nameM = content.match(/^name:\s*(.+)/m);
    const descM = content.match(/^description:\s*["']([\s\S]*?)["']\s*\n/m) ?? content.match(/^description:\s*(.+)/m);
    const emojiM = content.match(/"emoji":\s*"([^"]+)"/);
    skills.push({ id: name, name: nameM?.[1].trim() ?? name, description: descM?.[1].trim().slice(0,200) ?? "", emoji: emojiM?.[1] ?? "🔧", installed: true, builtin: false, requires: [], location: skillPath });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ skills, total: skills.length });
});

app.post("/api/agents/:agentId/heartbeat", (req, res) => {
  const { agentId } = req.params;
  if (!["soren", "aurel"].includes(agentId)) { res.status(403).json({ error: "Unknown agent" }); return; }
  const statusPath = agentId === "soren"
    ? path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json")
    : path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data = { ...body, agent: agentId, timestamp: new Date().toISOString(), health: body.health ?? "green" };
  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
  res.json({ ok: true, agent: agentId, updatedAt: data.timestamp });
});

// ---------------------------------------------------------------------------
// FEATURE 2: API Key Vault
// ---------------------------------------------------------------------------

app.get("/api/settings/keys", (_req, res) => {
  try {
    const raw = execSync("cat ~/.openclaw/openclaw.json", { encoding: "utf8" }).replace(/,(\s*[}\]])/g, "$1");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const vars = ((config.env as Record<string, unknown>)?.vars ?? {}) as Record<string, string>;
    const keys = Object.entries(vars).map(([name, value]) => ({
      name,
      masked: typeof value === "string" && value.length > 8 ? "x".repeat(value.length - 4) + value.slice(-4) : "••••",
      set: Boolean(value),
    }));
    res.json({ keys });
  } catch { res.status(500).json({ error: "Failed to read keys" }); }
});

app.put("/api/settings/keys/:name", (req, res) => {
  const { name } = req.params;
  const { value } = req.body as { value: string };
  if (!value || typeof value !== "string") { res.status(400).json({ error: "value required" }); return; }
  if (!/^[A-Z_][A-Z0-9_]+$/.test(name)) { res.status(400).json({ error: "Invalid key name" }); return; }
  try {
    const configPath = path.join(process.env.HOME ?? "/Users/centrick", ".openclaw/openclaw.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const updated = raw.replace(new RegExp(`("${name}"\\s*:\\s*)"[^"]*"`), `$1"${escaped}"`);
    if (updated === raw) { res.status(404).json({ error: "Key not found in config" }); return; }
    fs.writeFileSync(configPath, updated);
    res.json({ ok: true, name, updated: true });
  } catch { res.status(500).json({ error: "Failed to update key" }); }
});

// ---------------------------------------------------------------------------
// FEATURE 3: Model Selector
// ---------------------------------------------------------------------------

app.get("/api/settings/models", (_req, res) => {
  try {
    const raw = execSync("cat ~/.openclaw/openclaw.json", { encoding: "utf8" }).replace(/,(\s*[}\]])/g, "$1");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const providers = (((config.models as Record<string,unknown>)?.providers) ?? {}) as Record<string, { models?: Array<{ id: string; name?: string; reasoning?: boolean }> }>;
    const models: Array<{ id: string; name: string; provider: string; reasoning: boolean }> = [];
    for (const [provider, pv] of Object.entries(providers)) {
      for (const m of (pv.models ?? [])) {
        models.push({ id: m.id, name: m.name ?? m.id, provider, reasoning: m.reasoning ?? false });
      }
    }
    const prefsPath = path.join(process.env.HOME ?? "/Users/centrick", ".openclaw/clawe-prefs.json");
    let preferred: string | null = null;
    if (fs.existsSync(prefsPath)) {
      try { preferred = (JSON.parse(fs.readFileSync(prefsPath, "utf8")) as Record<string, string>).defaultModel ?? null; } catch { /* ok */ }
    }
    res.json({ models, preferred, total: models.length });
  } catch { res.status(500).json({ error: "Failed to read models" }); }
});

app.put("/api/settings/models/preferred", (req, res) => {
  const { modelId } = req.body as { modelId: string };
  if (!modelId || typeof modelId !== "string") { res.status(400).json({ error: "modelId required" }); return; }
  const prefsPath = path.join(process.env.HOME ?? "/Users/centrick", ".openclaw/clawe-prefs.json");
  let prefs: Record<string, unknown> = {};
  if (fs.existsSync(prefsPath)) {
    try { prefs = JSON.parse(fs.readFileSync(prefsPath, "utf8")) as Record<string, unknown>; } catch { /* ok */ }
  }
  prefs.defaultModel = modelId;
  fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
  res.json({ ok: true, defaultModel: modelId });
});

// ---------------------------------------------------------------------------
// GET /api/fleet/status — aggregated fleet health
// ---------------------------------------------------------------------------

interface ConnectivityResult { name: string; ok: boolean; message: string }
interface FleetStatus {
  overall: "green" | "yellow" | "red";
  updatedAt: number;
  crons: { total: number; ok: number; errors: number; recentErrors: Array<{ id: string; name: string; last: string }> };
  agents: { total: number; online: number; items: Array<{ id: string; name: string; emoji: string; status: string; lastHeartbeat: number | null }> };
  gateway: { running: boolean; mode: string; port: string; warnings: string[] };
  memory: { facts: number; decisions: number; checkpoints: number };
  services: { api: boolean; qdrant: boolean; lancedb: boolean; chunks: number };
  connectivity: ConnectivityResult[];
}

let fleetCache: FleetStatus | null = null;
let fleetCacheAt = 0;

async function buildFleetStatus(): Promise<FleetStatus> {
  // --- Crons (from cache) ---
  const cronOk = cronCache.crons.filter(c => c.status === "ok" || c.status === "").length;
  const cronErrors = cronCache.crons.filter(c => c.status === "error").length;
  const recentErrors = cronCache.crons
    .filter(c => c.status === "error")
    .slice(0, 5)
    .map(c => ({ id: c.id, name: c.name, last: c.last }));

  // --- Agents (from status files) ---
  const aurelData = readJsonFile(path.join(process.env.HOME ?? "/Users/centrick", "clawd/aurel/status/aurel.json"));
  const sorenData = readJsonFile(path.join(process.env.HOME ?? "/Users/centrick", "clawd/coordination/status/soren.json"));
  const aurelHb = resolveHeartbeat(aurelData);
  const sorenHb = resolveHeartbeat(sorenData);
  const agentItems = [
    { id: "aurel", name: "Aurel", emoji: "🏛️", status: aurelData ? deriveStatus(aurelData.health, aurelHb) : "offline", lastHeartbeat: aurelHb ?? null },
    { id: "soren", name: "Søren", emoji: "🧠", status: sorenData ? deriveStatus(sorenData.health, sorenHb) : "offline", lastHeartbeat: sorenHb ?? null },
  ];
  const agentsOnline = agentItems.filter(a => a.status === "online").length;

  // --- Gateway ---
  let gatewayRunning = false;
  let gatewayMode = "unknown";
  let gatewayPort = "";
  const gatewayWarnings: string[] = [];
  try {
    const raw = execSync("openclaw gateway status 2>/dev/null", { encoding: "utf8", timeout: 4000 });
    gatewayRunning = raw.includes("LaunchAgent") || raw.includes("loaded") || raw.includes("running");
    const portM = raw.match(/port[=:\s]+(\d+)/i);
    gatewayPort = portM ? portM[1] : "18789";
    const modeM = raw.match(/Service:\s*(.+)/);
    gatewayMode = modeM ? modeM[1].trim() : "LaunchAgent";
    const warnLines = raw.split("\n").filter(l => l.toLowerCase().includes("warn") || l.toLowerCase().includes("skipped") || l.toLowerCase().includes("error"));
    gatewayWarnings.push(...warnLines.map(l => l.trim()).filter(Boolean).slice(0, 3));
  } catch { /* leave defaults */ }

  // --- Memory stats ---
  let memFacts = 0, memDecisions = 0, memCheckpoints = 0;
  try {
    const memRaw = execSync(`node /Users/centrick/clawd/aurel/memory-system/cli.js stats 2>/dev/null`, { encoding: "utf8", timeout: 5000 });
    const factsM = memRaw.match(/Total facts[:\s]+(\d+)/i);
    const decisM = memRaw.match(/Decisions[:\s]+(\d+)/i);
    const checkM = memRaw.match(/checkpoints[:\s]+(\d+)/i);
    memFacts = factsM ? parseInt(factsM[1]) : 0;
    memDecisions = decisM ? parseInt(decisM[1]) : 0;
    memCheckpoints = checkM ? parseInt(checkM[1]) : 0;
  } catch { /* leave defaults */ }

  // --- Services (from existing health check) ---
  let qdrantOk = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.request({ hostname: "localhost", port: 6333, path: "/readyz", timeout: 800 }, (r) => { qdrantOk = r.statusCode === 200; resolve(); });
      req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); }); req.end();
    });
  } catch { /* offline */ }
  const lanceDbPath = "/Users/centrick/clawd/aurel/memory-system/lancedb/";
  const lanceDbOk = fs.existsSync(lanceDbPath);

  // --- Connectivity checks ---
  const connectivity: ConnectivityResult[] = [];
  const configRaw = (() => { try { return execSync("cat ~/.openclaw/openclaw.json", { encoding: "utf8" }).replace(/,(\s*[}\]])/g, "$1"); } catch { return "{}"; } })();
  const envVars = (() => { try { return ((JSON.parse(configRaw) as Record<string,unknown>).env as Record<string,unknown>)?.vars as Record<string, string> ?? {}; } catch { return {} as Record<string, string>; } })();

  const notionKey = envVars.NOTION_API_KEY ?? "";
  if (notionKey) {
    try {
      const notionOk = await new Promise<boolean>((resolve) => {
        const req = https.request({ hostname: "api.notion.com", path: "/v1/users/me", method: "GET", timeout: 3000, headers: { "Authorization": `Bearer ${notionKey}`, "Notion-Version": "2022-06-28" } }, (r) => resolve(r.statusCode === 200));
        req.on("error", () => resolve(false)); req.on("timeout", () => { req.destroy(); resolve(false); }); req.end();
      });
      connectivity.push({ name: "Notion", ok: notionOk, message: notionOk ? "Connected" : "Auth failed (401/403)" });
    } catch { connectivity.push({ name: "Notion", ok: false, message: "Request failed" }); }
  } else {
    connectivity.push({ name: "Notion", ok: false, message: "No API key set" });
  }

  connectivity.push({ name: "Anthropic", ok: Boolean(envVars.ANTHROPIC_API_KEY), message: envVars.ANTHROPIC_API_KEY ? "Key configured" : "No key set" });
  connectivity.push({ name: "OpenAI", ok: Boolean(envVars.OPENAI_API_KEY), message: envVars.OPENAI_API_KEY ? "Key configured" : "No key set" });
  connectivity.push({ name: "Brave Search", ok: Boolean(envVars.BRAVE_API_KEY), message: envVars.BRAVE_API_KEY ? "Key configured" : "No key set" });

  const gogCreds = path.join(process.env.HOME ?? "/Users/centrick", ".config/gog/credentials.json");
  const gogOk = fs.existsSync(gogCreds);
  connectivity.push({ name: "Gmail (gog)", ok: gogOk, message: gogOk ? "Credentials found" : "No credentials (run gog auth)" });

  // --- Overall status ---
  const hasRed = cronErrors > 3 || agentsOnline === 0 || !gatewayRunning || connectivity.filter(c => !c.ok).length > 2;
  const hasYellow = cronErrors > 0 || agentsOnline < agentItems.length || connectivity.some(c => !c.ok);
  const overall: "green" | "yellow" | "red" = hasRed ? "red" : hasYellow ? "yellow" : "green";

  return {
    overall,
    updatedAt: Date.now(),
    crons: { total: cronCache.total, ok: cronOk, errors: cronErrors, recentErrors },
    agents: { total: agentItems.length, online: agentsOnline, items: agentItems },
    gateway: { running: gatewayRunning, mode: gatewayMode, port: gatewayPort, warnings: gatewayWarnings },
    memory: { facts: memFacts, decisions: memDecisions, checkpoints: memCheckpoints },
    services: { api: true, qdrant: qdrantOk, lancedb: lanceDbOk, chunks: 0 },
    connectivity,
  };
}

app.get("/api/fleet/status", async (_req, res) => {
  const FLEET_TTL = 3 * 60 * 1000; // 3 minutes
  if (fleetCache && Date.now() - fleetCacheAt < FLEET_TTL) {
    res.json({ ...fleetCache, cached: true });
    return;
  }
  try {
    const status = await buildFleetStatus();
    fleetCache = status;
    fleetCacheAt = Date.now();
    res.json(status);
  } catch (err) {
    console.error("Fleet status error:", err);
    res.status(500).json({ error: "Failed to build fleet status" });
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
