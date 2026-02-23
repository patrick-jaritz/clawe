"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useMemoryQuery, useMemoryDecisions } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Input } from "@clawe/ui/components/input";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Search, Brain, Lightbulb, RefreshCw } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";
import { mutate } from "swr";

type Tab = "search" | "decisions";

// Parse the CLI markdown output into individual memory blocks
function parseMemoryBlocks(raw: string): Array<{ tier: string; entity: string; key: string; value: string; rationale?: string }> {
  if (!raw) return [];
  const blocks: Array<{ tier: string; entity: string; key: string; value: string; rationale?: string }> = [];

  // Match lines like: - **[📝 fact]** entity/key: value
  const factPattern = /[-•]\s+\*\*\[([^\]]+)\]\*\*\s+([^:]+):\s+(.+)/g;
  let match;
  while ((match = factPattern.exec(raw)) !== null) {
    const tier = match[1] ?? "";
    const entityKey = match[2] ?? "";
    const value = match[3] ?? "";
    const slashIdx = entityKey.indexOf("/");
    blocks.push({
      tier: tier.trim(),
      entity: slashIdx !== -1 ? entityKey.slice(0, slashIdx).trim() : entityKey.trim(),
      key: slashIdx !== -1 ? entityKey.slice(slashIdx + 1).trim() : entityKey.trim(),
      value: value.trim(),
    });
  }

  // Also grab decision lines with rationale
  const decisionPattern = /[-•]\s+\*\*\[decision\]\*\*\s+([^:]+):\s+(.+?)(?:\s+—\s+(.+))?$/gm;
  while ((match = decisionPattern.exec(raw)) !== null) {
    const key = match[1] ?? "";
    const value = match[2] ?? "";
    const rationale = match[3];
    blocks.push({
      tier: "decision",
      entity: "decision",
      key: key.trim(),
      value: value.trim(),
      rationale: rationale?.trim(),
    });
  }

  return blocks;
}

const tierColors: Record<string, string> = {
  "📝 fact": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "decision": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "permanent": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function getTierStyle(tier: string): string {
  for (const [key, val] of Object.entries(tierColors)) {
    if (tier.includes(key)) return val;
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

const MemoryPage = () => {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data: queryData, isLoading: queryLoading } = useMemoryQuery(debouncedQuery);
  const { data: decisionsData, isLoading: decisionsLoading } = useMemoryDecisions();

  const searchBlocks = parseMemoryBlocks(queryData?.raw ?? "");
  const decisionBlocks = parseMemoryBlocks(decisionsData?.raw ?? "");

  const blocks = tab === "search" ? searchBlocks : decisionBlocks;
  const isLoading = tab === "search" ? queryLoading : decisionsLoading;

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Memory</PageHeaderTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              mutate("/api/memory/decisions");
              mutate((key: string) => typeof key === "string" && key.startsWith("/api/memory/query"));
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </PageHeaderRow>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["search", "decisions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-foreground text-background"
                : "border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "search" ? <Brain className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            {t === "search" ? "Facts" : "Decisions"}
          </button>
        ))}
      </div>

      {/* Search bar (facts tab only) */}
      {tab === "search" && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memory — try 'DBA', 'twitter', 'crons'..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </Card>
            ))}
          </>
        )}

        {!isLoading && blocks.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            {tab === "search" && debouncedQuery
              ? `No results for "${debouncedQuery}"`
              : tab === "search"
              ? "Search your memory — facts, preferences, project state, conventions"
              : "No decisions recorded yet"}
          </Card>
        )}

        {!isLoading && blocks.map((block, i) => (
          <Card key={i} className="p-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  getTierStyle(block.tier)
                )}>
                  {block.entity}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {block.key}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{block.value}</p>
              {block.rationale && (
                <p className="text-xs text-muted-foreground italic border-l-2 pl-2">
                  {block.rationale}
                </p>
              )}
            </div>
          </Card>
        ))}

        {!isLoading && blocks.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-2">
            {blocks.length} result{blocks.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Raw output toggle for debugging */}
      {queryData?.raw && tab === "search" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Raw CLI output
          </summary>
          <pre className="mt-2 rounded bg-muted p-3 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
            {queryData.raw}
          </pre>
        </details>
      )}
    </>
  );
};

export default MemoryPage;
