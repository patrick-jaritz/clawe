/**
 * Projects API Routes
 */

import { Router } from "express";
import { spawn } from "child_process";
import * as http from "http";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";
import { PROJECTS } from "../projects-config.js";

const router = Router();

// Store running process PIDs, start times, and log buffers
const runningProcesses = new Map<string, number>();
const startTimes = new Map<string, number>(); // epoch ms
const logBuffers = new Map<string, string[]>();
const logEmitters = new Map<string, EventEmitter>();

// ---------------------------------------------------------------------------
// Crash history — saved to ~/.clawe/crash-history.json
// ---------------------------------------------------------------------------
const CRASH_HISTORY_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "crash-history.json");
type CrashEvent = { ts: number; code: number | null };
let crashHistory: Record<string, CrashEvent[]> = {};

function loadCrashHistory() {
  try {
    if (fs.existsSync(CRASH_HISTORY_PATH)) {
      crashHistory = JSON.parse(fs.readFileSync(CRASH_HISTORY_PATH, "utf8"));
    }
  } catch { /* silent */ }
}

function recordCrash(id: string, code: number | null) {
  if (!crashHistory[id]) crashHistory[id] = [];
  crashHistory[id] = [{ ts: Date.now(), code }, ...crashHistory[id]].slice(0, 20);
  try {
    const dir = path.dirname(CRASH_HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CRASH_HISTORY_PATH, JSON.stringify(crashHistory, null, 2));
  } catch { /* silent */ }
}

loadCrashHistory();

// ---------------------------------------------------------------------------
// Health check state (in-memory, refreshed every 30s)
// ---------------------------------------------------------------------------
type HealthStatus = { ok: boolean; lastChecked: number; latencyMs?: number };
const healthStatus = new Map<string, HealthStatus>();

function pingProject(id: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get({ hostname: "127.0.0.1", port, path: "/", timeout: 4000 }, (res) => {
      healthStatus.set(id, { ok: res.statusCode !== undefined && res.statusCode < 500, lastChecked: Date.now(), latencyMs: Date.now() - start });
      res.resume();
      resolve();
    });
    req.on("error", () => { healthStatus.set(id, { ok: false, lastChecked: Date.now() }); resolve(); });
    req.on("timeout", () => { req.destroy(); healthStatus.set(id, { ok: false, lastChecked: Date.now() }); resolve(); });
  });
}

// Background health check loop
setInterval(() => {
  for (const [id, pid] of runningProcesses) {
    const project = PROJECTS.find((p) => p.id === id);
    if (project) pingProject(id, project.port).catch(() => {});
  }
}, 30_000);

// ---------------------------------------------------------------------------
// Project notes — saved to ~/.clawe/project-notes.json
// ---------------------------------------------------------------------------
const NOTES_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "project-notes.json");
let projectNotes: Record<string, string> = {};

function loadNotes() {
  try {
    if (fs.existsSync(NOTES_PATH)) {
      projectNotes = JSON.parse(fs.readFileSync(NOTES_PATH, "utf8"));
    }
  } catch { /* silent */ }
}

function saveNotes() {
  try {
    const dir = path.dirname(NOTES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTES_PATH, JSON.stringify(projectNotes, null, 2));
  } catch (err) {
    console.warn("[projects] Failed to save notes:", err);
  }
}

loadNotes();

// ---------------------------------------------------------------------------
// Auto-restart settings — saved to ~/.clawe/auto-restart.json
// ---------------------------------------------------------------------------
const AUTO_RESTART_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "auto-restart.json");
let autoRestartSettings: Record<string, boolean> = {};

function loadAutoRestart() {
  try {
    if (fs.existsSync(AUTO_RESTART_PATH)) {
      autoRestartSettings = JSON.parse(fs.readFileSync(AUTO_RESTART_PATH, "utf8"));
    }
  } catch { /* silent */ }
}

function saveAutoRestart() {
  try {
    const dir = path.dirname(AUTO_RESTART_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTO_RESTART_PATH, JSON.stringify(autoRestartSettings, null, 2));
  } catch (err) {
    console.warn("[projects] Failed to save auto-restart settings:", err);
  }
}

loadAutoRestart();

// Restart a project after a delay
function scheduleRestart(id: string, delayMs = 5000) {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) return;
  console.log(`[projects] Auto-restart scheduled for ${id} in ${delayMs}ms`);
  setTimeout(() => {
    if (autoRestartSettings[id] && !runningProcesses.has(id)) {
      spawnProject(id, project);
    }
  }, delayMs);
}

/** Check if a port is in use by ANY process (not just ours) */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

// PATH for spawned processes
const SPAWN_PATH = '/Users/centrick/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin';

// ---------------------------------------------------------------------------
// Persistent PID state — survives API restarts
// ---------------------------------------------------------------------------
const STATE_PATH = path.join(process.env.HOME ?? "/Users/centrick", ".clawe", "running-processes.json");

function persistState() {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const state: Record<string, { pid: number; startedAt: number }> = {};
    for (const [id, pid] of runningProcesses) {
      state[id] = { pid, startedAt: startTimes.get(id) ?? Date.now() };
    }
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn("[projects] Failed to persist PID state:", err);
  }
}

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// Load persisted PIDs on startup, verify each is still alive
function loadPersistedState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return;
    const saved = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as
      Record<string, number | { pid: number; startedAt: number }>;
    let loaded = 0;
    for (const [id, entry] of Object.entries(saved)) {
      const pid = typeof entry === "number" ? entry : entry.pid;
      const startedAt = typeof entry === "object" ? entry.startedAt : Date.now();
      if (typeof pid === "number" && isPidAlive(pid)) {
        runningProcesses.set(id, pid);
        startTimes.set(id, startedAt);
        loaded++;
      }
    }
    if (loaded > 0) console.log(`[projects] Restored ${loaded} running process(es) from disk`);
  } catch (err) {
    console.warn("[projects] Failed to load persisted PID state:", err);
  }
}

loadPersistedState();

// Max log lines per project
const MAX_LOG_LINES = 100;

/**
 * Check if a project is running by attempting HTTP request
 */
function checkRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode !== undefined);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Add line to log buffer and emit to listeners
 */
function addLogLine(id: string, line: string) {
  // Initialize buffer if needed
  if (!logBuffers.has(id)) {
    logBuffers.set(id, []);
  }

  const buffer = logBuffers.get(id)!;
  buffer.push(line);

  // Keep only last MAX_LOG_LINES
  if (buffer.length > MAX_LOG_LINES) {
    buffer.shift();
  }

  // Emit to listeners
  const emitter = logEmitters.get(id);
  if (emitter) {
    emitter.emit('log', line);
  }
}

/**
 * Shared project spawn — used by start endpoint and auto-restart
 */
interface ProjectConfig {
  id: string;
  path: string;
  startCmd: string;
  port: number;
}

function spawnProject(id: string, project: ProjectConfig): void {
  logBuffers.set(id, []);
  const child = spawn('/bin/bash', ['-c', project.startCmd], {
    cwd: project.path,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: SPAWN_PATH, PORT: project.port.toString() },
  });

  runningProcesses.set(id, child.pid!);
  startTimes.set(id, Date.now());
  persistState();

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter((l: string) => l.trim())) {
      addLogLine(id, line);
    }
  });
  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter((l: string) => l.trim())) {
      addLogLine(id, `[ERROR] ${line}`);
    }
  });
  child.on('exit', (code) => {
    addLogLine(id, `Process exited with code ${code}`);
    if (code !== 0 && code !== null) recordCrash(id, code);
    runningProcesses.delete(id);
    startTimes.delete(id);
    healthStatus.delete(id);
    persistState();
    if (code !== 0 && autoRestartSettings[id]) {
      addLogLine(id, `Auto-restart enabled — restarting in 5s...`);
      scheduleRestart(id);
    }
  });
  child.unref();
}

/**
 * GET /api/projects
 * Returns all projects with their live running status
 */
router.get("/", async (_req, res) => {
  try {
    const projectsWithStatus = await Promise.all(
      PROJECTS.map(async (project) => {
        const running = project.status === 'available' 
          ? await checkRunning(project.port)
          : false;
        
        const health = healthStatus.get(project.id);
        return {
          ...project,
          running,
          startedAt: running ? (startTimes.get(project.id) ?? null) : null,
          notes: projectNotes[project.id] ?? "",
          autoRestart: autoRestartSettings[project.id] ?? false,
          health: health ?? null,
          crashCount: (crashHistory[project.id] ?? []).length,
          lastCrash: (crashHistory[project.id] ?? [])[0] ?? null,
        };
      })
    );

    res.json({ projects: projectsWithStatus });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

/**
 * GET /api/projects/:id/status
 * Returns running status and PID for a project
 */
router.get("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const project = PROJECTS.find((p) => p.id === id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const pid = runningProcesses.get(id);
    const running = project.status === 'available' 
      ? await checkRunning(project.port)
      : false;

    res.json({ 
      running,
      pid: pid || undefined,
    });
  } catch (err) {
    console.error("Error fetching project status:", err);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

/**
 * GET /api/projects/:id/logs
 * SSE endpoint for streaming project logs
 */
router.get("/:id/logs", (req, res) => {
  const { id } = req.params;
  const project = PROJECTS.find((p) => p.id === id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send buffered logs
  const buffer = logBuffers.get(id) || [];
  for (const line of buffer) {
    res.write(`data: ${line}\n\n`);
  }

  // Create emitter if doesn't exist
  if (!logEmitters.has(id)) {
    logEmitters.set(id, new EventEmitter());
  }

  const emitter = logEmitters.get(id)!;

  // Listen for new logs
  const logListener = (line: string) => {
    res.write(`data: ${line}\n\n`);
  };

  emitter.on('log', logListener);

  // Clean up on disconnect
  req.on('close', () => {
    emitter.removeListener('log', logListener);
  });
});

/**
 * POST /api/projects/:id/start
 * Start a project by spawning its dev command
 */
router.post("/:id/start", async (req, res) => {
  try {
    const { id } = req.params;
    const project = PROJECTS.find((p) => p.id === id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (project.status !== 'available') {
      res.status(400).json({ error: "Project has no web UI" });
      return;
    }

    // Check if already running
    const isRunning = await checkRunning(project.port);
    if (isRunning) {
      res.json({ started: false, message: "Project already running", port: project.port });
      return;
    }

    // Check if port is in use by another process (conflict detection)
    const portBusy = await isPortInUse(project.port);
    if (portBusy) {
      res.status(409).json({
        error: `Port ${project.port} is already in use by another process. Stop the conflicting process first.`,
        portConflict: true,
        port: project.port,
      });
      return;
    }

    spawnProject(id, project);

    res.json({ 
      started: true, 
      port: project.port,
      pid: runningProcesses.get(id),
    });
  } catch (err) {
    console.error("Error starting project:", err);
    res.status(500).json({ error: "Failed to start project" });
  }
});

/**
 * POST /api/projects/:id/stop
 * Stop a running project by killing its process group
 */
router.post("/:id/stop", (req, res) => {
  try {
    const { id } = req.params;
    const pid = runningProcesses.get(id);

    if (!pid) {
      res.status(400).json({ error: "No running process found for this project" });
      return;
    }

    try {
      // Kill process group (negative PID)
      process.kill(-pid, 'SIGTERM');
      runningProcesses.delete(id);
      persistState();
      res.json({ stopped: true });
    } catch (err) {
      console.error(`Error killing process ${pid}:`, err);
      // Still remove from map
      runningProcesses.delete(id);
      persistState();
      res.json({ stopped: true, warning: "Process may not have been running" });
    }
  } catch (err) {
    console.error("Error stopping project:", err);
    res.status(500).json({ error: "Failed to stop project" });
  }
});

/**
 * GET /api/projects/:id/crashes
 */
router.get("/:id/crashes", (req, res) => {
  const { id } = req.params;
  res.json({ crashes: crashHistory[id] ?? [], total: (crashHistory[id] ?? []).length });
});

/**
 * POST /api/projects/:id/health-check
 * Trigger an immediate health check
 */
router.post("/:id/health-check", async (req, res) => {
  const { id } = req.params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  await pingProject(id, project.port);
  res.json(healthStatus.get(id) ?? { ok: false, lastChecked: Date.now() });
});

/**
 * POST /api/projects/:id/rebuild
 * git pull + npm install + restart
 */
router.post("/:id/rebuild", (req, res) => {
  const { id } = req.params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  // Stream rebuild logs via SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (line: string) => res.write(`data: ${line}\n\n`);

  const run = async () => {
    try {
      send("🔄 git pull...");
      const { execSync: exec } = await import("child_process");
      const gitOut = exec("git pull", { cwd: project.path, encoding: "utf8" }).trim();
      send(gitOut || "(already up to date)");

      send("📦 npm install...");
      const npmOut = exec("npm install 2>&1", { cwd: project.path, encoding: "utf8", timeout: 120_000 }).trim();
      for (const line of npmOut.split("\n").slice(-5)) send(line); // last 5 lines

      // Stop running process if any
      if (runningProcesses.has(id)) {
        const pid = runningProcesses.get(id)!;
        try { process.kill(-pid, "SIGTERM"); } catch { /* ok */ }
        runningProcesses.delete(id);
        startTimes.delete(id);
        await new Promise((r) => setTimeout(r, 1500));
      }

      send("🚀 Restarting...");
      spawnProject(id, project);
      send("✅ Done! Project restarted.");
    } catch (err) {
      send(`❌ Error: ${String(err)}`);
    } finally {
      res.end();
    }
  };

  run();
});

/**
 * GET /api/projects/:id/logs/search?q=term
 */
router.get("/:id/logs/search", (req, res) => {
  const { id } = req.params;
  const { q = "" } = req.query as { q?: string };
  const buf = logBuffers.get(id) ?? [];
  const term = q.toLowerCase();
  const results = term ? buf.filter((l) => l.toLowerCase().includes(term)) : buf;
  res.json({ results: results.slice(-200), total: results.length, query: q });
});

/**
 * GET /api/projects/:id/env
 * Returns masked .env contents
 */
router.get("/:id/env", (req, res) => {
  const { id } = req.params;
  const { reveal } = req.query as { reveal?: string };
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) { res.status(404).json({ error: "Not found" }); return; }

  const envPath = path.join(project.path, ".env");
  if (!fs.existsSync(envPath)) { res.json({ vars: [], path: envPath, exists: false }); return; }

  try {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    const vars = lines
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const eqIdx = l.indexOf("=");
        const key = l.slice(0, eqIdx).trim();
        const rawVal = l.slice(eqIdx + 1).trim();
        const isSensitive = /key|secret|token|pass|password|auth|api/i.test(key);
        const value = (isSensitive && reveal !== "true") ? "•••••••••••" : rawVal;
        return { key, value, masked: isSensitive && reveal !== "true" };
      });
    res.json({ vars, path: envPath, exists: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to read .env", details: String(err) });
  }
});

/**
 * GET /api/projects/:id/notes
 */
router.get("/:id/notes", (req, res) => {
  const { id } = req.params;
  res.json({ notes: projectNotes[id] ?? "" });
});

/**
 * PATCH /api/projects/:id/notes
 * Body: { notes: string }
 */
router.patch("/:id/notes", (req, res) => {
  const { id } = req.params;
  const { notes } = req.body as { notes: string };
  if (typeof notes !== "string") {
    res.status(400).json({ error: "notes must be a string" });
    return;
  }
  if (notes.trim() === "") {
    delete projectNotes[id];
  } else {
    projectNotes[id] = notes;
  }
  saveNotes();
  res.json({ saved: true });
});

/**
 * PATCH /api/projects/:id/auto-restart
 * Body: { enabled: boolean }
 */
router.patch("/:id/auto-restart", (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }
  if (!enabled) {
    delete autoRestartSettings[id];
  } else {
    autoRestartSettings[id] = true;
  }
  saveAutoRestart();
  res.json({ autoRestart: enabled });
});

export default router;
