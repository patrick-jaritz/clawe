"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRepos, type WatchlistRepo } from "@/lib/api/local";
import {
  ExternalLink,
  Search,
  Star,
  GitFork,
  Tag,
  Grid3X3,
  List,
  BookOpen,
  Eye,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Category → emoji mapping
const categoryEmoji: Record<string, string> = {
  "Agent Frameworks": "🤖",
  "Agentic Frameworks": "🤖",
  "AI Memory": "🧠",
  "AI Memory & Multi-Agent": "🧠",
  "Audio / Voice": "🎙️",
  Automation: "⚙️",
  "Browser Automation": "🌐",
  "Claude Code": "🟣",
  "CLI Tools": "💻",
  "Coding Agents": "👨‍💻",
  "Curated Lists": "📋",
  "Data Platforms": "📊",
  "Developer Tools": "🛠️",
  Finance: "💰",
  "Finance / Business": "💰",
  Frameworks: "📦",
  "Image Models": "🎨",
  Indexing: "🔍",
  Inference: "⚡",
  Infrastructure: "🏗️",
  Knowledge: "📚",
  "LLMs / Reasoning": "🧪",
  MCP: "🔌",
  Memory: "🧠",
  Monitoring: "📡",
  Productivity: "✅",
  Prompting: "💬",
  "RAG Systems": "📖",
  "RAG / Data Extraction": "📖",
  Research: "🔬",
  Scraping: "🕷️",
  Security: "🔒",
  Standards: "📐",
  "Vision / OCR": "👁️",
  "Vision / Video": "🎥",
  "Vision / Computer Use": "🖥️",
};

function getEmoji(category: string): string {
  return categoryEmoji[category] ?? "📂";
}

// Category color classes
function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    "Agent Frameworks": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "Agentic Frameworks": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "AI Memory": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "AI Memory & Multi-Agent": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Memory: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "Audio / Voice": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Automation: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "RAG Systems": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "RAG / Data Extraction": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "Image Models": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    Finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    "Finance / Business": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    Infrastructure: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    Security: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return map[category] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300";
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function RepoCard({ repo }: { repo: WatchlistRepo }) {
  const url = repo.url || `https://github.com/${repo.owner}/${repo.repo}`;
  const label = repo.owner && repo.repo ? `${repo.owner}/${repo.repo}` : repo.name;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm">{getEmoji(repo.category)}</span>
            {repo.trending && (
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">🔥 trending</span>
            )}
            <h3 className="truncate font-semibold text-sm group-hover:text-primary">
              {label}
            </h3>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {repo.description}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", getCategoryColor(repo.category))}>
          {repo.category}
        </Badge>
        <div className="flex items-center gap-2 ml-auto">
          {repo.stars != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Star className="h-2.5 w-2.5" />
              {formatStars(repo.stars)}
            </span>
          )}
          {repo.added && (
            <span className="text-[10px] text-muted-foreground">{repo.added}</span>
          )}
        </div>
      </div>
      {repo.why && (
        <p className="mt-2 text-[11px] text-muted-foreground/80 italic">
          💡 {repo.why}
        </p>
      )}
    </a>
  );
}

function RepoRow({ repo }: { repo: WatchlistRepo }) {
  const url = repo.url || `https://github.com/${repo.owner}/${repo.repo}`;
  const label = repo.owner && repo.repo ? `${repo.owner}/${repo.repo}` : repo.name;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-md border-b px-3 py-2.5 transition-colors hover:bg-muted/50 last:border-0"
    >
      <span className="text-sm">{getEmoji(repo.category)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {repo.trending && <span className="text-orange-500 text-xs">🔥</span>}
          <span className="text-sm font-medium group-hover:text-primary truncate">
            {label}
          </span>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 shrink-0", getCategoryColor(repo.category))}>
            {repo.category}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {repo.description}
        </p>
      </div>
      {repo.stars != null && (
        <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Star className="h-2.5 w-2.5" />{formatStars(repo.stars)}
        </span>
      )}
      <span className="shrink-0 text-[10px] text-muted-foreground">{repo.added}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export default function ReposPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useRepos(
    selectedCategory !== "all" ? selectedCategory : undefined,
    search || undefined,
  );

  const repos = data?.repos ?? [];
  const categories = data?.categories ?? [];
  const total = data?.total ?? 0;
  const meta = data?.meta;
  const source = data?.source;
  const trendingCount = (data?.repos ?? []).filter((r) => r.trending).length;

  // Group repos by category for grid view
  const groupedRepos = useMemo(() => {
    if (selectedCategory !== "all") return null; // No grouping when filtered
    const groups = new Map<string, WatchlistRepo[]>();
    for (const r of repos) {
      if (!groups.has(r.category)) groups.set(r.category, []);
      groups.get(r.category)!.push(r);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [repos, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{total} repos · {categories.length} categories</span>
          {source === "notion" && (
            <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded font-medium">
              Notion live
            </span>
          )}
          {meta?.lastChecked && (
            <span className="text-xs">· {meta.lastChecked}</span>
          )}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total repos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Tag className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Eye className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{repos.length}</p>
              <p className="text-xs text-muted-foreground">
                {selectedCategory !== "all" || search ? "Filtered" : "Showing"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <GitFork className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trendingCount}</p>
              <p className="text-xs text-muted-foreground">Trending 🔥</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repos, owners, categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-1 h-3.5 w-3.5" />
          Filters
        </Button>
        <div className="flex items-center rounded-md border">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Category filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedCategory("all")}
              >
                All ({total})
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.name}
                  variant={selectedCategory === cat.name ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === cat.name ? "all" : cat.name,
                    )
                  }
                >
                  {getEmoji(cat.name)} {cat.name} ({cat.count})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Repos */}
      {!isLoading && viewMode === "grid" && (
        <>
          {groupedRepos && !search ? (
            // Grouped by category
            groupedRepos.map(([category, catRepos]) => (
              <div key={category}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span>{getEmoji(category)}</span>
                  {category}
                  <Badge variant="secondary" className="text-[10px]">
                    {catRepos.length}
                  </Badge>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catRepos.map((r) => (
                    <RepoCard
                      key={`${r.owner}/${r.repo}`}
                      repo={r}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Flat grid (filtered or search)
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {repos.map((r) => (
                <RepoCard
                  key={`${r.owner}/${r.repo}`}
                  repo={r}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!isLoading && viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            {repos.map((r) => (
              <RepoRow key={`${r.owner}/${r.repo}`} repo={r} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && repos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">No repos found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? `Nothing matches "${search}"`
                : "The watchlist is empty"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analysis framework */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Analysis Framework</CardTitle>
          <CardDescription>How we evaluate each repo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Build ON it", desc: "Use as infrastructure/dependency", emoji: "🏗️" },
              { label: "Build WITH it", desc: "Patterns/approaches to adopt", emoji: "🤝" },
              { label: "Build AGAINST it", desc: "Competitive intelligence", emoji: "⚔️" },
              { label: "Skip", desc: "Interesting but not relevant now", emoji: "⏭️" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border p-3 text-center">
                <span className="text-lg">{item.emoji}</span>
                <p className="mt-1 text-xs font-semibold">{item.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
