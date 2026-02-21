# CLAWE API Server

Express API server for CLAWE dashboard, running on port 3001.

## Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key for embeddings (text-embedding-3-small)

Optional:
- `LANCEDB_PATH` - Path to LanceDB database (default: `/Users/centrick/clawd/aurel/memory-system/lancedb`)
- `NOTION_API_KEY` - Notion API key for task management

## Routes

### Health
- `GET /api/health` - Health check

### Agents
- `GET /api/agents` - List agents (Aurel, Søren)

### Tasks
- `GET /api/tasks` - Fetch tasks from Notion

### Activities
- `GET /api/activities` - Recent activity logs

### Intelligence
- `GET /api/intel/chunks?page=1&limit=20&source=all` - List intelligence chunks with pagination
  - Query params: `page` (default: 1), `limit` (default: 20), `source` (all|gmail|rss|reddit|hn|twitter|github|manual)
  - Returns: `{ chunks, total, page, pages }`

- `POST /api/intel/chunks` - Create manual intelligence chunk
  - Body: `{ text: string, title: string, source: string, url?: string }`
  - Returns: `{ id, stored: true }`

- `GET /api/intel/stats` - Intelligence statistics
  - Returns: `{ total, by_source, last_ingest }`

## Development

```bash
pnpm dev          # Start dev server (tsx)
pnpm start        # Start production server
```

## Architecture

- **Express** - Web framework
- **LanceDB** - Vector database for intelligence chunks
- **OpenAI** - Text embeddings (text-embedding-3-small, 1536 dimensions)
- **TypeScript** - Type safety
- **tsx** - TypeScript execution
