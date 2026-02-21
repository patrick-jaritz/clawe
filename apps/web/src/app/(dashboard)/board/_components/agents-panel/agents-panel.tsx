"use client";

import { useAgents } from "@/lib/api/local";
import type { LocalAgent } from "@/lib/api/local";
import { cn } from "@clawe/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { AgentsPanelHeader } from "./agents-panel-header";
import { AgentsPanelList } from "./agents-panel-list";
import type { Agent } from "@clawe/backend/types";

export type AgentsPanelProps = {
  className?: string;
  collapsed?: boolean;
  selectedAgentIds?: string[];
  onSelectionChange?: (agentIds: string[]) => void;
};

// Map LocalAgent to the Agent shape expected by AgentsPanelList/Item.
// The cast is needed because Agent has Convex-specific id fields (tenantId, etc.)
// that don't exist in our local data; rendered components only use
// _id, name, role, emoji, status, lastHeartbeat, and lastSeen.
function toAgent(a: LocalAgent): Agent {
  return {
    _id: a._id,
    _creationTime: a.lastHeartbeat,
    tenantId: "local" as Agent["tenantId"],
    name: a.name,
    role: a.role,
    emoji: a.emoji,
    sessionKey: a.sessionKey,
    status: a.status,
    lastHeartbeat: a.lastHeartbeat,
    lastSeen: a.lastHeartbeat,
    currentActivity: a.currentActivity ?? undefined,
    createdAt: a.lastHeartbeat,
    updatedAt: a.lastHeartbeat,
  } as Agent;
}

export const AgentsPanel = ({
  className,
  collapsed = false,
  selectedAgentIds = [],
  onSelectionChange,
}: AgentsPanelProps) => {
  const { data: agents } = useAgents();

  const total = agents?.length ?? 0;

  const handleToggleAgent = (agentId: string) => {
    if (!onSelectionChange) return;

    if (selectedAgentIds.includes(agentId)) {
      onSelectionChange(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      onSelectionChange([...selectedAgentIds, agentId]);
    }
  };

  return (
    <div className={cn("flex h-full flex-col border-r", className)}>
      <AgentsPanelHeader total={total} collapsed={collapsed} />

      {!agents ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center px-4 text-center text-sm">
          {!collapsed && "No agents yet"}
        </div>
      ) : (
        <AgentsPanelList
          agents={agents.map(toAgent)}
          collapsed={collapsed}
          selectedAgentIds={selectedAgentIds}
          onToggleAgent={handleToggleAgent}
        />
      )}
    </div>
  );
};
