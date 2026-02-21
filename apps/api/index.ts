import express from "express";
import cors from "cors";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import intelRouter from "./routes/intel.js";

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

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

  const agents = [
    {
      _id: "aurel",
      name: "Aurel",
      role: "Chief of Staff",
      emoji: "🏛️",
      sessionKey: "agent:main:main",
      status: aurelData ? deriveStatus(aurelData.health) : "offline",
      currentActivity:
        (aurelData?.active_tasks as unknown[])?.[0] !== undefined
          ? String((aurelData!.active_tasks as unknown[])[0])
          : null,
      lastHeartbeat: aurelData?.last_updated
        ? new Date(String(aurelData.last_updated)).getTime()
        : Date.now(),
    },
    {
      _id: "soren",
      name: "Søren",
      role: "Strategist",
      emoji: "🧠",
      sessionKey: "agent:soren:main",
      status: sorenData ? deriveStatus(sorenData.health) : "offline",
      currentActivity:
        (sorenData?.active_tasks as unknown[])?.[0] !== undefined
          ? String((sorenData!.active_tasks as unknown[])[0])
          : null,
      lastHeartbeat: sorenData?.last_updated
        ? new Date(String(sorenData.last_updated)).getTime()
        : Date.now(),
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
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`CENTAUR API running on http://localhost:${PORT}`);
});
