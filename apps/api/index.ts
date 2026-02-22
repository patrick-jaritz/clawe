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

const AGENT_STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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
