/**
 * LanceDB wrapper for the intelligence table.
 * Connects to the intelligence system's LanceDB instance.
 */

import * as lancedb from "@lancedb/lancedb";
import path from "path";

const EMBED_DIM = 1536; // text-embedding-3-small (OpenAI)
const TABLE_NAME = "intelligence";

function getLanceDir(): string {
  return (
    process.env.LANCEDB_PATH ??
    "/Users/centrick/clawd/aurel/memory-system/lancedb"
  );
}

export interface IntelChunk {
  id: string;
  content: string;
  vector: number[];
  source: string;
  url: string;
  title: string;
  date: string;
  tags: string[];
  entity_type: string;
}

// Flat representation stored in LanceDB (tags as JSON string)
interface IntelRecord {
  id: string;
  content: string;
  vector: number[];
  source: string;
  url: string;
  title: string;
  date: string;
  tags: string;
  entity_type: string;
}

let _db: Awaited<ReturnType<typeof lancedb.connect>> | null = null;
let _table: Awaited<ReturnType<typeof _db.openTable>> | null = null;

async function getTable() {
  if (_table) return _table;

  _db = await lancedb.connect(getLanceDir());
  const tables = await _db.tableNames();

  if (tables.includes(TABLE_NAME)) {
    _table = await _db.openTable(TABLE_NAME);
  } else {
    const dummyVec = new Array(EMBED_DIM).fill(0);
    _table = await _db.createTable(TABLE_NAME, [
      {
        id: "__init__",
        content: "",
        vector: dummyVec,
        source: "",
        url: "",
        title: "",
        date: "",
        tags: "[]",
        entity_type: "",
      } as IntelRecord,
    ]);
    await _table.delete('id = "__init__"');
    console.log(`  ✓ Created LanceDB table: ${TABLE_NAME}`);
  }

  return _table;
}

export async function intelInsert(chunks: IntelChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const table = await getTable();
  const records: IntelRecord[] = chunks.map((c) => ({
    ...c,
    tags: JSON.stringify(c.tags),
  }));
  await table.add(records);
}

export async function intelSearch(
  queryVec: number[],
  limit = 10
): Promise<Array<IntelChunk & { _distance: number }>> {
  const table = await getTable();
  const results = await table.search(queryVec).limit(limit).toArray();
  return results.map((r: IntelRecord & { _distance: number }) => ({
    id: r.id,
    content: r.content,
    vector: Array.from(r.vector),
    source: r.source,
    url: r.url,
    title: r.title,
    date: r.date,
    tags: JSON.parse(r.tags || "[]"),
    entity_type: r.entity_type,
    _distance: r._distance,
  }));
}

export async function intelCount(): Promise<number> {
  const table = await getTable();
  return table.countRows();
}

export async function intelListAll(
  page = 1,
  limit = 20,
  sourceFilter = "all"
): Promise<{ chunks: IntelChunk[]; total: number }> {
  const table = await getTable();

  // Build filter
  let filter = "";
  if (sourceFilter !== "all") {
    filter = `source = '${sourceFilter}'`;
  }

  // Count total with filter
  let total: number;
  if (filter) {
    const filteredResults = await table
      .filter(filter)
      .toArrow()
      .then((t) => t.numRows);
    total = filteredResults;
  } else {
    total = await table.countRows();
  }

  // Fetch paginated results
  const offset = (page - 1) * limit;
  let query = table.query();
  if (filter) {
    query = query.filter(filter);
  }

  const results = await query.limit(limit).offset(offset).toArray();

  const chunks = results.map((r: IntelRecord) => ({
    id: r.id,
    content: r.content,
    vector: Array.from(r.vector),
    source: r.source,
    url: r.url,
    title: r.title,
    date: r.date,
    tags: JSON.parse(r.tags || "[]"),
    entity_type: r.entity_type,
  }));

  return { chunks, total };
}

export async function intelStatsBySource(): Promise<Record<string, number>> {
  const table = await getTable();
  const allRecords = await table.query().toArray();

  const stats: Record<string, number> = {};
  for (const r of allRecords as IntelRecord[]) {
    stats[r.source] = (stats[r.source] ?? 0) + 1;
  }

  return stats;
}

export async function intelLastIngest(): Promise<string | null> {
  const table = await getTable();
  try {
    const results = await table.query().limit(1).toArray();
    if (results.length === 0) return null;
    return (results[0] as IntelRecord).date;
  } catch {
    return null;
  }
}

export async function intelGetById(id: string): Promise<IntelChunk | null> {
  const table = await getTable();
  try {
    const results = await table.filter(`id = '${id}'`).toArray();
    if (results.length === 0) return null;
    
    const r = results[0] as IntelRecord;
    return {
      id: r.id,
      content: r.content,
      vector: Array.from(r.vector),
      source: r.source,
      url: r.url,
      title: r.title,
      date: r.date,
      tags: JSON.parse(r.tags || "[]"),
      entity_type: r.entity_type,
    };
  } catch {
    return null;
  }
}
