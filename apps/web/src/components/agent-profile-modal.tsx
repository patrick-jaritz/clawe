"use client";

import { useAgentProfile } from "@/lib/api/local";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@clawe/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@clawe/ui/components/tabs";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";

// ─── lightweight markdown → HTML (no external dep) ──────────────────────────

function renderMd(md: string): string {
  return md
    .replace(/^# (.+)$/gm, "<h1 class=\"text-xl font-bold mt-4 mb-2\">$1</h1>")
    .replace(/^## (.+)$/gm, "<h2 class=\"text-base font-semibold mt-4 mb-1 text-foreground\">$2</h2>")
    .replace(/^### (.+)$/gm, "<h3 class=\"text-sm font-semibold mt-3 mb-1\">$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class=\"bg-muted px-1 py-0.5 rounded text-xs font-mono\">$1</code>")
    .replace(/^[-•] (.+)$/gm, "<li class=\"ml-4 list-disc\">$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li class=\"ml-4 list-decimal\">$2</li>")
    .replace(/^> (.+)$/gm, "<blockquote class=\"border-l-2 border-muted-foreground pl-3 italic text-muted-foreground\">$1</blockquote>")
    .replace(/^---$/gm, "<hr class=\"border-border my-4\" />")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function MarkdownPane({ content }: { content: string | null }) {
  if (!content) return <p className="text-sm text-muted-foreground italic">No file found.</p>;
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-y-auto max-h-[60vh] pr-1"
      dangerouslySetInnerHTML={{ __html: renderMd(content) }}
    />
  );
}

function StatusBadge({ health }: { health?: string }) {
  if (!health) return null;
  const variant = health === "green" ? "default" : health === "yellow" ? "secondary" : "destructive";
  return <Badge variant={variant} className="capitalize text-xs">{health}</Badge>;
}

// ─── modal ───────────────────────────────────────────────────────────────────

interface AgentProfileModalProps {
  agentId: string | null;
  onClose: () => void;
}

export function AgentProfileModal({ agentId, onClose }: AgentProfileModalProps) {
  const { data, isLoading } = useAgentProfile(agentId);

  return (
    <Dialog open={!!agentId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <>
                <span>{data?.emoji}</span>
                <span>{data?.name}</span>
                {data?.status && <StatusBadge health={(data.status as Record<string, string>).health} />}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <Tabs defaultValue="soul" className="mt-2">
            <TabsList>
              <TabsTrigger value="soul">Soul</TabsTrigger>
              <TabsTrigger value="identity">Identity</TabsTrigger>
            </TabsList>
            <TabsContent value="soul" className="mt-4">
              <MarkdownPane content={data?.soul ?? null} />
            </TabsContent>
            <TabsContent value="identity" className="mt-4">
              <MarkdownPane content={data?.identity ?? null} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
