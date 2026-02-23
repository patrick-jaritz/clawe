import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAWE_API = process.env.CLAWE_API_URL ?? "http://localhost:3001";

/**
 * POST /api/chat
 * Proxies to CLAWE API /api/chat which runs a CLAWE-aware Anthropic stream.
 * Falls back to a helpful error if CLAWE API is unreachable.
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
      const err = await upstream.text();
      return new Response(JSON.stringify({ error: `CLAWE API error: ${err}` }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream SSE through from CLAWE API to the browser
    // Convert CLAWE's SSE format (data: {"delta":"..."}) to Vercel AI SDK format
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") {
              // Vercel AI SDK expects a specific finish format
              await writer.write(encoder.encode('0:""\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(payload) as { delta?: string; error?: string };
              if (parsed.error) {
                await writer.write(encoder.encode(`3:${JSON.stringify(parsed.error)}\n`));
              } else if (parsed.delta) {
                // Vercel AI SDK text stream format: 0:"<escaped text>"\n
                await writer.write(encoder.encode(`0:${JSON.stringify(parsed.delta)}\n`));
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
