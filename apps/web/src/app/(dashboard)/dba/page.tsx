"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { mutate } from "swr";
import { PageHeader, PageHeaderRow, PageHeaderTitle } from "@dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Progress } from "@clawe/ui/components/progress";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { useDBAProgress, patchDBAProgress } from "@/lib/api/local";
import { ExternalLink, GraduationCap, Pencil, Check } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DBAPage() {
  const { data, isLoading } = useDBAProgress();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  if (isLoading || !data) {
    return (
      <>
        <PageHeader><PageHeaderRow><PageHeaderTitle>DBA Papers</PageHeaderTitle></PageHeaderRow></PageHeader>
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      </>
    );
  }

  const deadline = data.papers[0]?.deadline ?? "2026-03-31";
  const days = daysUntil(deadline);
  const totalSections = data.papers.reduce((sum, p) => sum + p.sections.length, 0);
  const doneSections = data.papers.reduce((sum, p) => sum + p.sections.filter((s) => s.done).length, 0);
  const overallPct = totalSections > 0 ? Math.round((doneSections / totalSections) * 100) : 0;

  const toggleSection = async (paperId: string, sectionId: string, done: boolean) => {
    await patchDBAProgress({ paperId, sectionId, done });
    mutate("/api/dba/progress");
  };

  const saveTitle = async (paperId: string, title: string) => {
    await patchDBAProgress({ paperId, paperTitle: title });
    mutate("/api/dba/progress");
    setEditingTitle(null);
  };

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5" />
            <PageHeaderTitle>DBA Papers</PageHeaderTitle>
          </div>
          <Button size="sm" variant="outline" asChild>
            <a href={`http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3016`}
               target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open DBA Assistant
            </a>
          </Button>
        </PageHeaderRow>
      </PageHeader>

      {/* Deadline countdown */}
      <Card className={cn("p-4", days <= 14 ? "border-destructive/50 bg-destructive/5" : days <= 30 ? "border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20" : "")}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Overall Progress</p>
            <p className={cn("text-2xl font-bold mt-0.5", days <= 14 ? "text-destructive" : days <= 30 ? "text-orange-500" : "text-foreground")}>
              {days} days left
            </p>
            <p className="text-xs text-muted-foreground">Deadline: {new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{overallPct}%</p>
            <p className="text-xs text-muted-foreground">{doneSections}/{totalSections} sections</p>
          </div>
        </div>
        <Progress value={overallPct} className="h-2" />
      </Card>

      {/* Papers */}
      <div className="space-y-4">
        {data.papers.map((paper) => {
          const done = paper.sections.filter((s) => s.done).length;
          const total = paper.sections.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isEditing = editingTitle === paper.id;

          return (
            <Card key={paper.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        className="flex-1 rounded border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTitle(paper.id, titleDraft);
                          if (e.key === "Escape") setEditingTitle(null);
                        }}
                      />
                      <Button size="sm" variant="ghost" onClick={() => saveTitle(paper.id, titleDraft)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{paper.title}</CardTitle>
                      <button onClick={() => { setEditingTitle(paper.id); setTitleDraft(paper.title); }}
                        className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant={pct === 100 ? "default" : "secondary"}>{pct}%</Badge>
                    <span className="text-xs text-muted-foreground">{done}/{total}</span>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                  {paper.sections.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => toggleSection(paper.id, sec.id, !sec.done)}
                      className={cn(
                        "flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-left text-xs transition-colors",
                        sec.done
                          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 rounded border",
                        sec.done ? "border-green-500 bg-green-500" : "border-muted-foreground"
                      )}>
                        {sec.done && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      {sec.title}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
