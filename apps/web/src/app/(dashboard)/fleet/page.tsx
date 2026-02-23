"use client";

export const dynamic = "force-dynamic";

import { useFleetStatus } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  PageHeaderActions,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Button } from "@clawe/ui/components/button";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Timer,
  Bot,
  Server,
  Database,
  Wifi,
  Brain,
} from "lucide-react";
import { useMemo } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function OverallBadge({ status }: { status: "green" | "yellow" | "red" }) {
  if (status === "green")
    return <Badge className="bg-green-500 text-white gap-1"><CheckCircle2 className="w-3 h-3" /> All Systems Go</Badge>;
  if (status === "yellow")
    return <Badge className="bg-yellow-500 text-white gap-1"><AlertCircle className="w-3 h-3" /> Degraded</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Critical</Badge>;
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
    : <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />;
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4 font-semibold text-sm">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {children}
    </Card>
  );
}

function AgentRow({ agent }: { agent: { id: string; name: string; emoji: string; status: string; lastHeartbeat: number | null } }) {
  const online = agent.status === "online";
  const ago = agent.lastHeartbeat
    ? (() => {
        const m = Math.floor((Date.now() - agent.lastHeartbeat) / 60000);
        if (m < 1) return "just now";
        if (m < 60) return `${m}m ago`;
        return `${Math.floor(m / 60)}h ${m % 60}m ago`;
      })()
    : "never";
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <StatusDot ok={online} />
        <span>{agent.emoji} {agent.name}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>{ago}</span>
        <Badge variant={online ? "default" : "secondary"} className="text-xs">{agent.status}</Badge>
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function FleetPage() {
  const { data, error, isLoading, mutate } = useFleetStatus();

  const updatedLabel = useMemo(() => {
    if (!data?.updatedAt) return "";
    const m = Math.floor((Date.now() - data.updatedAt) / 60000);
    return m < 1 ? "just now" : `${m}m ago`;
  }, [data?.updatedAt]);

  async function refresh() {
    await fetch("/api/fleet/refresh", { method: "POST" });
    void mutate();
  }

  if (isLoading) {
    return (
      <>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle>Fleet Health</PageHeaderTitle>
          </PageHeaderRow>
        </PageHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle>Fleet Health</PageHeaderTitle>
          </PageHeaderRow>
        </PageHeader>
        <div className="flex flex-col items-center justify-center h-60 gap-3 text-muted-foreground">
          <XCircle className="w-8 h-8" />
          <p>Failed to load fleet status</p>
          <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Fleet Health</PageHeaderTitle>
          <PageHeaderActions>
            <div className="flex items-center gap-3">
              <OverallBadge status={data.overall} />
              <span className="text-xs text-muted-foreground">Updated {updatedLabel}</span>
              <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">

        {/* Crons */}
        <SectionCard icon={<Timer className="w-4 h-4" />} title="Cron Jobs">
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div>
              <p className="text-2xl font-bold">{data.crons.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{data.crons.ok}</p>
              <p className="text-xs text-muted-foreground">OK</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${data.crons.errors > 0 ? "text-red-500" : ""}`}>{data.crons.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
          {data.crons.recentErrors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-1">Recent failures:</p>
              {data.crons.recentErrors.map(e => (
                <div key={e.id} className="flex justify-between text-xs">
                  <span className="truncate max-w-[160px] text-red-400">{e.name}</span>
                  <span className="text-muted-foreground shrink-0">{e.last}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Agents */}
        <SectionCard icon={<Bot className="w-4 h-4" />} title="Agents">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold">{data.agents.online}</span>
            <span className="text-muted-foreground text-sm">/ {data.agents.total} online</span>
          </div>
          <div>
            {data.agents.items.map(agent => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        </SectionCard>

        {/* Gateway */}
        <SectionCard icon={<Server className="w-4 h-4" />} title="Gateway">
          <div className="flex items-center gap-2 mb-3">
            <StatusDot ok={data.gateway.running} />
            <span className="font-medium text-sm">{data.gateway.running ? "Running" : "Stopped"}</span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Mode</span><span>{data.gateway.mode}</span></div>
            <div className="flex justify-between"><span>Port</span><span>{data.gateway.port}</span></div>
          </div>
          {data.gateway.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {data.gateway.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-500 flex gap-1"><AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{w}</p>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Memory */}
        <SectionCard icon={<Brain className="w-4 h-4" />} title="Memory System">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold">{data.memory.facts}</p>
              <p className="text-xs text-muted-foreground">Facts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.memory.decisions}</p>
              <p className="text-xs text-muted-foreground">Decisions</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.memory.checkpoints}</p>
              <p className="text-xs text-muted-foreground">Checkpoints</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">SQLite + LanceDB (245 intel chunks)</p>
        </SectionCard>

        {/* Services */}
        <SectionCard icon={<Database className="w-4 h-4" />} title="Services">
          <div className="space-y-2">
            {[
              { name: "CLAWE API", ok: data.services.api, detail: ":3001" },
              { name: "Qdrant", ok: data.services.qdrant, detail: ":6333" },
              { name: "LanceDB", ok: data.services.lancedb, detail: `${data.services.chunks || "—"} chunks` },
            ].map(svc => (
              <div key={svc.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <StatusDot ok={svc.ok} />
                  <span>{svc.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{svc.detail}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Connectivity */}
        <SectionCard icon={<Wifi className="w-4 h-4" />} title="Connectivity">
          <div className="space-y-2">
            {data.connectivity.map(conn => (
              <div key={conn.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <StatusDot ok={conn.ok} />
                  <span>{conn.name}</span>
                </div>
                <span className={`text-xs ${conn.ok ? "text-muted-foreground" : "text-red-400"}`}>{conn.message}</span>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </>
  );
}
