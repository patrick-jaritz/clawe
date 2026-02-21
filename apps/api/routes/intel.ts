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

export default router;
