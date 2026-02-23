/**
 * owner.ts — Centralised owner detection for CENTAUR agents.
 *
 * All current content belongs to Aurel. When Søren registers crons / sessions,
 * they are identified by the patterns below. Extend SOREN_PATTERNS to add more.
 */

export type CronOwner = "aurel" | "soren" | "system";

export const OWNER_STYLE: Record<CronOwner, { label: string; cls: string; dot: string }> = {
  aurel:  { label: "Aurel",  dot: "🏛️",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  soren:  { label: "Søren",  dot: "🎯",  cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  system: { label: "Sys",    dot: "⚙️",  cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

// ─── Crons ───────────────────────────────────────────────────────────────────

const SYSTEM_CRON_PATTERNS = [
  /fleet.health/i,
  /agent.health/i,
  /watchdog/i,
  /orchestrator/i,
  /nightly.memory/i,
  /daily.log/i,
  /memory.auto/i,
  /memory.janitor/i,
  /maintenance/i,
];
const SOREN_CRON_PATTERNS = [/soren/i];

export function getCronOwner(name: string, agent?: string, apiOwner?: string): CronOwner {
  // Trust the API owner field first (set by heartbeat data)
  if (apiOwner) {
    const lower = apiOwner.toLowerCase();
    if (lower === "søren" || lower === "soren" || lower === "søren") return "soren";
    if (lower === "aurel") return "aurel";
    if (lower === "system" || lower === "sys") return "system";
  }
  if (SOREN_CRON_PATTERNS.some((p) => p.test(name))) return "soren";
  const agentStr = agent ?? "";
  if (SYSTEM_CRON_PATTERNS.some((p) => p.test(name)) || agentStr.startsWith("mainten") || agentStr.startsWith("orchest")) return "system";
  return "aurel";
}

// ─── Sessions ────────────────────────────────────────────────────────────────

const SOREN_SESSION_PATTERNS  = [/soren/i, /strategist/i];
const SYSTEM_SESSION_PATTERNS = [/maintenance/i, /healthcheck/i, /watchdog/i, /fleet/i];

export function getSessionOwner(key: string, label: string, kind?: string, apiOwner?: string): CronOwner {
  if (apiOwner) {
    const lower = apiOwner.toLowerCase();
    if (lower === "søren" || lower === "soren" || lower === "søren") return "soren";
    if (lower === "aurel") return "aurel";
    if (lower === "system" || lower === "sys") return "system";
  }
  const combined = `${key} ${label}`;
  if (SOREN_SESSION_PATTERNS.some((p) => p.test(combined))) return "soren";
  if (SYSTEM_SESSION_PATTERNS.some((p) => p.test(combined))) return "system";
  if (kind === "cron" && /mainten|orchestrat/i.test(combined)) return "system";
  return "aurel";
}

// ─── Memory ──────────────────────────────────────────────────────────────────

const SOREN_MEMORY_PATTERNS  = [/^soren/i, /strategist/i];

export function getMemoryOwner(entity: string, key?: string): CronOwner {
  const combined = `${entity} ${key ?? ""}`;
  if (SOREN_MEMORY_PATTERNS.some((p) => p.test(combined))) return "soren";
  return "aurel"; // All current memories are Aurel's
}

// ─── Skills ──────────────────────────────────────────────────────────────────

const SOREN_SKILL_PATTERNS  = [/soren/i];
const SYSTEM_SKILL_PATTERNS = [/github/i, /health/i, /weather/i, /whisper/i, /video/i, /skill.creator/i];

export function getSkillOwner(id: string, name: string, apiOwner?: string): CronOwner {
  if (apiOwner) {
    const lower = apiOwner.toLowerCase();
    if (lower === "søren" || lower === "soren" || lower === "søren") return "soren";
    if (lower === "aurel") return "aurel";
    if (lower === "system" || lower === "sys") return "system";
  }
  const combined = `${id} ${name}`;
  if (SOREN_SKILL_PATTERNS.some((p) => p.test(combined))) return "soren";
  if (SYSTEM_SKILL_PATTERNS.some((p) => p.test(combined))) return "system";
  return "aurel";
}
// Søren dashboard integration - 20260223203012
