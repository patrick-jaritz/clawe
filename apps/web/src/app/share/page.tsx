"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Circle, Lock, Wifi } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Project = {
  id: string;
  name: string;
  port: number;
  description: string;
  running: boolean;
  startedAt?: number | null;
};

function formatUptime(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function ShareContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [valid, setValid] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setValid(false); setLoading(false); return; }

    const validate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/share/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json() as { valid: boolean };
        setValid(data.valid);
        if (data.valid) {
          const pRes = await fetch(`${API_BASE}/api/projects`);
          const pData = await pRes.json() as Project[];
          setProjects(pData);
        }
      } catch {
        setValid(false);
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm text-muted-foreground">Invalid or expired share token.</p>
        </div>
      </div>
    );
  }

  const running = projects.filter((p) => p.running);
  const stopped = projects.filter((p) => !p.running);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">CLAWE</span>
          <Badge variant="secondary" className="text-xs">Read-only</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wifi className="h-3.5 w-3.5" />
          Live snapshot · {new Date().toLocaleTimeString()}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Summary */}
        <div className="flex gap-4">
          <Card className="flex-1 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{running.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Running</p>
          </Card>
          <Card className="flex-1 p-4 text-center">
            <p className="text-3xl font-bold">{stopped.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Stopped</p>
          </Card>
          <Card className="flex-1 p-4 text-center">
            <p className="text-3xl font-bold">{projects.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Total</p>
          </Card>
        </div>

        {/* Running projects */}
        {running.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Running Projects
            </h2>
            <div className="space-y-2">
              {running.map((p) => (
                <Card key={p.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-muted-foreground">:{p.port}</p>
                      {p.startedAt && (
                        <p className="text-xs text-green-600">↑ {formatUptime(p.startedAt)}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Stopped projects */}
        {stopped.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Stopped Projects
            </h2>
            <div className="space-y-2">
              {stopped.map((p) => (
                <Card key={p.id} className="p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <Circle className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.name}</p>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">:{p.port}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4 border-t">
          CLAWE · CENTAUR · {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
