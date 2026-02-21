/**
 * Projects API Routes
 */

import { Router } from "express";
import { spawn } from "child_process";
import * as http from "http";
import { PROJECTS, type ProjectConfig } from "../projects-config.js";

const router = Router();

// Store running process PIDs
const runningProcesses = new Map<string, number>();

// PATH for spawned processes
const SPAWN_PATH = '/Users/centrick/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin';

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

    // Spawn process
    const child = spawn('/bin/bash', ['-c', project.startCmd], {
      cwd: project.path,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PATH: SPAWN_PATH,
        PORT: project.port.toString(),
      },
    });

    // Store PID
    runningProcesses.set(id, child.pid!);

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
      res.json({ stopped: true });
    } catch (err) {
      console.error(`Error killing process ${pid}:`, err);
      // Still remove from map
      runningProcesses.delete(id);
      res.json({ stopped: true, warning: "Process may not have been running" });
    }
  } catch (err) {
    console.error("Error stopping project:", err);
    res.status(500).json({ error: "Failed to stop project" });
  }
});

export default router;
