/**
 * Intelligence Library API Routes
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import {
  intelListAll,
  intelInsert,
  intelCount,
  intelStatsBySource,
  intelLastIngest,
  intelGetById,
  intelSearch,
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
// Uses vector search (semantic) when query is present — returns relevance scores
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

    // Embed the query and do vector search (semantic, scored)
    const queryVec = await embed(query);
    const searchResults = await intelSearch(queryVec, 100); // get top 100, then filter + paginate

    // Filter by source if needed
    const filtered = source === "all"
      ? searchResults
      : searchResults.filter((r) => r.source === source);

    // Normalize distance to a 0–1 score (lower distance = higher score)
    const minDist = Math.min(...filtered.map((r) => r._distance));
    const maxDist = Math.max(...filtered.map((r) => r._distance));
    const range = maxDist - minDist || 1;

    const scored = filtered.map((r) => ({
      ...r,
      score: Math.round((1 - (r._distance - minDist) / range) * 100), // 0–100
    }));

    // Paginate
    const total = scored.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedChunks = scored.slice(offset, offset + limit);

    const chunksWithPreview = paginatedChunks.map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      source: chunk.source,
      date: chunk.date,
      url: chunk.url,
      entity_type: chunk.entity_type,
      score: chunk.score,
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
      semantic: true,
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

// POST /api/intel/ask  — RAG chat: embed query → vector search → Claude stream
router.post("/ask", async (req, res) => {
  const { question, top_k = 5 } = req.body as { question: string; top_k?: number };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  // Set SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Embed the query
    const queryVec = await embed(question);

    // 2. Vector search LanceDB
    const results = await intelSearch(queryVec, top_k);

    if (results.length === 0) {
      sendEvent("error", { message: "No relevant intelligence found for this question." });
      res.end();
      return;
    }

    // Send sources to client before streaming the answer
    const sources = results.map((r, i) => ({
      index: i + 1,
      id: r.id,
      title: r.title,
      source: r.source,
      date: r.date,
      url: r.url,
      score: r._distance,
    }));
    sendEvent("sources", { sources });

    // 3. Build prompt with retrieved context
    const contextBlocks = results
      .map((r, i) =>
        `[${i + 1}] ${r.title} (${r.source}, ${new Date(r.date).toLocaleDateString()})\n${r.content.slice(0, 1500)}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are CLAWE's intelligence analyst. You answer questions using the retrieved knowledge base chunks below. Be direct, factual, and cite sources by number [1], [2], etc. If the context doesn't contain enough information, say so clearly.

RETRIEVED CONTEXT:
${contextBlocks}`;

    // 4. Stream Claude response
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    });

    stream.on("text", (text) => {
      sendEvent("delta", { text });
    });

    stream.on("finalMessage", () => {
      sendEvent("done", { done: true });
      res.end();
    });

    stream.on("error", (err) => {
      console.error("Claude stream error:", err);
      sendEvent("error", { message: String(err) });
      res.end();
    });

    req.on("close", () => stream.abort());
  } catch (err) {
    console.error("RAG ask error:", err);
    sendEvent("error", { message: String(err) });
    res.end();
  }
});

export default router;
