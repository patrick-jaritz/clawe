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
        
        return {
          ...project,
          running,
          startedAt: running ? (startTimes.get(project.id) ?? null) : null,
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

    // Clear old logs
    logBuffers.set(id, []);

    // Spawn process with piped stdio
    const child = spawn('/bin/bash', ['-c', project.startCmd], {
      cwd: project.path,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: SPAWN_PATH,
        PORT: project.port.toString(),
      },
    });

    // Store PID + start time, persist to disk
    runningProcesses.set(id, child.pid!);
    startTimes.set(id, Date.now());
    persistState();

    // Pipe stdout to logs
    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        addLogLine(id, line);
      }
    });

    // Pipe stderr to logs
    child.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        addLogLine(id, `[ERROR] ${line}`);
      }
    });

    // Handle process exit
    child.on('exit', (code) => {
      addLogLine(id, `Process exited with code ${code}`);
      runningProcesses.delete(id);
      startTimes.delete(id);
      persistState();
    });

    // Detach so it keeps running
    child.unref();

    res.json({ 
      started: true, 
      port: project.port,
      pid: child.pid,
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

export default router;
