/**
 * Intelligence Library API Routes
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  intelListAll,
  intelInsert,
  intelCount,
  intelStatsBySource,
  intelLastIngest,
  intelGetById,
} from "../lib/lancedb.js";
import { embed } from "../lib/openai.js";

const router = Router();

// GET /api/intel/chunks?page=1&limit=20&source=all
router.get("/chunks", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const source = (req.query.source as string) || "all";

    const { chunks, total } = await intelListAll(page, limit, source);

    // Add content preview (first 200 chars)
    const chunksWithPreview = chunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      source: chunk.source,
      date: chunk.date,
      url: chunk.url,
      entity_type: chunk.entity_type,
      content_preview:
        chunk.content.substring(0, 200) +
        (chunk.content.length > 200 ? "..." : ""),
    }));

    const pages = Math.ceil(total / limit);

    res.json({
      chunks: chunksWithPreview,
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error("Error fetching intel chunks:", err);
    res.status(500).json({ error: "Failed to fetch intelligence chunks" });
  }
});

// GET /api/intel/chunks/:id - Get full chunk content
router.get("/chunks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const chunk = await intelGetById(id);

    if (!chunk) {
      res.status(404).json({ error: "Chunk not found" });
      return;
    }

    res.json(chunk);
  } catch (err) {
    console.error("Error fetching intel chunk:", err);
    res.status(500).json({ error: "Failed to fetch intelligence chunk" });
  }
});

// POST /api/intel/chunks
router.post("/chunks", async (req, res) => {
  try {
    const { text, title, source, url } = req.body;

    if (!text || !title || !source) {
      res.status(400).json({ error: "Missing required fields: text, title, source" });
      return;
    }

    // Generate embedding
    const vector = await embed(text);

    // Create chunk
    const id = uuidv4();
    const chunk = {
      id,
      content: text,
      vector,
      source,
      url: url || "",
      title,
      date: new Date().toISOString(),
      tags: [],
      entity_type: "manual",
    };

    // Store in LanceDB
    await intelInsert([chunk]);

    res.json({ id, stored: true });
  } catch (err) {
    console.error("Error inserting intel chunk:", err);
    res.status(500).json({ error: "Failed to store intelligence chunk" });
  }
});

// GET /api/intel/stats
router.get("/stats", async (req, res) => {
  try {
    const total = await intelCount();
    const by_source = await intelStatsBySource();
    const last_ingest = await intelLastIngest();

    res.json({
      total,
      by_source,
      last_ingest,
    });
  } catch (err) {
    console.error("Error fetching intel stats:", err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// GET /api/intel/search?q=QUERY&source=all&page=1&limit=20
router.get("/search", async (req, res) => {
  try {
    const query = (req.query.q as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const source = (req.query.source as string) || "all";

    if (!query.trim()) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    // Fetch all chunks with source filter
    const { chunks: allChunks } = await intelListAll(1, 10000, source);

    // Filter by query (case-insensitive search in content and title)
    const lowerQuery = query.toLowerCase();
    const filtered = allChunks.filter(
      (chunk) =>
        chunk.content.toLowerCase().includes(lowerQuery) ||
        chunk.title.toLowerCase().includes(lowerQuery)
    );

    // Paginate
    const total = filtered.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedChunks = filtered.slice(offset, offset + limit);

    // Add content preview
    const chunksWithPreview = paginatedChunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      source: chunk.source,
      date: chunk.date,
      url: chunk.url,
      entity_type: chunk.entity_type,
      content_preview:
        chunk.content.substring(0, 200) +
        (chunk.content.length > 200 ? "..." : ""),
    }));

    res.json({
      chunks: chunksWithPreview,
      total,
      page,
      pages,
      query,
    });
  } catch (err) {
    console.error("Error searching intel chunks:", err);
    res.status(500).json({ error: "Failed to search intelligence chunks" });
  }
});

// GET /api/intel/ingest/status
router.get("/ingest/status", async (req, res) => {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const lanceDir =
      process.env.LANCEDB_PATH ||
      "/Users/centrick/clawd/aurel/memory-system/lancedb";
    const intelligenceDir = path.join(lanceDir, "intelligence.lance");

    let lastRun: string | null = null;

    // Check last modified time of the intelligence directory
    try {
      const stats = await fs.stat(intelligenceDir);
      lastRun = stats.mtime.toISOString();
    } catch {
      // Directory doesn't exist yet
      lastRun = null;
    }

    const chunkCount = await intelCount();

    res.json({
      last_run: lastRun,
      chunk_count: chunkCount,
      next_run: "5:00 AM Asia/Jerusalem",
    });
  } catch (err) {
    console.error("Error fetching ingest status:", err);
    res.status(500).json({ error: "Failed to fetch ingestion status" });
  }
});

// POST /api/intel/ingest/run
router.post("/ingest/run", async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    const fs = await import("fs/promises");
    const path = await import("path");

    const centaurDir = "/Users/centrick/CODE/centaur-intelligence";
    const lockFile = path.join(centaurDir, ".ingest.lock");

    // Check if already running
    try {
      const lockContent = await fs.readFile(lockFile, "utf-8");
      const pid = parseInt(lockContent);

      // Check if process is still running
      try {
        process.kill(pid, 0);
        res.json({ started: false, message: "Ingestion already running" });
        return;
      } catch {
        // Process not running, remove stale lock
        await fs.unlink(lockFile);
      }
    } catch {
      // No lock file
    }

    // Start ingestion in background
    const child = spawn("npm", ["run", "ingest"], {
      cwd: centaurDir,
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    // Write lock file
    await fs.writeFile(lockFile, child.pid?.toString() || "");

    // Remove lock file when process exits
    child.on("exit", async () => {
      try {
        await fs.unlink(lockFile);
      } catch {
        // Ignore
      }
    });

    res.json({ started: true, pid: child.pid });
  } catch (err) {
    console.error("Error starting ingestion:", err);
    res.status(500).json({ error: "Failed to start ingestion" });
  }
});

export default router;
