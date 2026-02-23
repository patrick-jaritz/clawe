import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAWE_API = process.env.CLAWE_API_URL ?? "http://localhost:3001";

/**
 * POST /api/chat
 *
 * Proxies to CLAWE API /api/chat (SSE: `data: {"delta":"..."}`)
 * and re-emits as a plain UTF-8 byte stream — exactly what use-chat.ts
 * expects (it does raw accumulated += decoder.decode(chunk)).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { messages: unknown[]; sessionKey?: string };
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(`${CLAWE_API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(
        `[CLAWE API error ${upstream.status}]: ${errText}`,
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    // Transform: CLAWE SSE  →  plain text byte stream
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let lineBuf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuf += decoder.decode(value, { stream: true });
          const lines = lineBuf.split("\n");
          lineBuf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { delta?: string; error?: string };
              if (parsed.error) {
                await writer.write(encoder.encode(`\n[Error: ${parsed.error}]`));
              } else if (parsed.delta) {
                // Write the raw text — the hook appends it directly
                await writer.write(encoder.encode(parsed.delta));
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    // Return error as plain text so the hook shows it inline
    return new Response(`[Chat error: ${String(e)}]`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
