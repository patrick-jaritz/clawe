export type AgentStatus = "online" | "offline";

export const ONLINE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours (agents heartbeat every 30min–4h)

/** Derive status: trust API-provided status first, fall back to heartbeat staleness check */
export const deriveStatus = (agent: {
  status: string;
  lastHeartbeat?: number;
}): AgentStatus => {
  // If the API already resolved a status, trust it
  if (agent.status === "online") return "online";
  if (agent.status === "offline") return "offline";
  // Fallback: derive from heartbeat staleness
  if (!agent.lastHeartbeat) return "offline";
  return Date.now() - agent.lastHeartbeat > ONLINE_THRESHOLD_MS ? "offline" : "online";
};
