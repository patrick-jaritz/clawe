"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { mutate } from "swr";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Button } from "@clawe/ui/components/button";
import { Card } from "@clawe/ui/components/card";
import { Input } from "@clawe/ui/components/input";
import { Textarea } from "@clawe/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@clawe/ui/components/select";
import { Skeleton } from "@clawe/ui/components/skeleton";
import {
  useIntelChunks,
  useIntelSearch,
  useIntelStats,
  useIngestStatus,
  createIntelChunk,
  triggerIngest,
  getIntelChunk,
  askIntel,
  generateDailyDigest,
  type FullIntelChunk,
  type IntelSource,
} from "@/lib/api/local";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Loader2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  Send,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";

const sourceIcons: Record<string, string> = {
  gmail: "📧",
  rss: "📡",
  reddit: "🟠",
  hn: "🔶",
  twitter: "🐦",
  github: "🐙",
  manual: "✏️",
};

const sourceLabels: Record<string, string> = {
  all: "All",
  gmail: "Gmail",
  rss: "RSS",
  reddit: "Reddit",
  hn: "HN",
  twitter: "Twitter",
  github: "GitHub",
  manual: "Manual",
};

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "never";

  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatChunkDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffHour / 24);

  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// ── RAG Chat ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: IntelSource[];
  streaming?: boolean;
};

const sourceEmojis: Record<string, string> = {
  gmail: "📧", rss: "📡", reddit: "🟠", hn: "🔶",
  twitter: "🐦", github: "🐙", manual: "✏️",
};

const AskMode = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<IntelSource[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || isLoading) return;

    setInput("");
    setActiveSources([]);

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: q };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId, role: "assistant", content: "", streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    const abort = askIntel(q, {
      onSources: (sources) => {
        setActiveSources(sources);
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, sources } : m)
        );
      },
      onDelta: (text) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + text } : m
          )
        );
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
        );
        setIsLoading(false);
        abortRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      onError: (message) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${message}`, streaming: false }
              : m
          )
        );
        setIsLoading(false);
        abortRef.current = null;
      },
    });

    abortRef.current = abort;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Chat panel */}
      <div className="flex flex-1 flex-col rounded-lg border">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <div>
                <p className="font-medium">Ask your knowledge base</p>
                <p className="text-sm">
                  Queries search 204 chunks from Gmail, GitHub, RSS, Reddit
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {[
                  "What are the latest BYL updates?",
                  "What's in my recent emails?",
                  "Summarize recent GitHub activity",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.content || (msg.streaming && (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                  </span>
                ))}
                {msg.streaming && msg.content && (
                  <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-current" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your knowledge base..."
              disabled={isLoading}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Enter to send
          </p>
        </div>
      </div>

      {/* Sources panel */}
      <div className="hidden w-72 flex-shrink-0 lg:flex flex-col rounded-lg border">
        <div className="border-b p-3">
          <p className="text-sm font-medium">Sources</p>
          <p className="text-xs text-muted-foreground">Chunks used in last answer</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeSources.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-4">
              Sources will appear here after your first question
            </p>
          ) : (
            activeSources.map((src) => (
              <div key={src.id} className="rounded-md border p-2.5 space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground flex-shrink-0">
                    [{src.index}]
                  </span>
                  <p className="text-xs font-medium leading-snug line-clamp-2">{src.title}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{sourceEmojis[src.source] ?? "📄"}</span>
                  <span>{src.source}</span>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const IntelligencePage = () => {
  const [mode, setMode] = useState<"browse" | "ask">("browse");
  const [selectedSource, setSelectedSource] = useState("all");
  const [brief, setBrief] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefDismissed, setBriefDismissed] = useState(false);

  // Auto-generate brief on first load
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBriefLoading(true);
      try {
        const result = await generateDailyDigest();
        if (!cancelled) setBrief(result.brief);
      } catch { /* silent fail */ }
      finally { if (!cancelled) setBriefLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);
  const [fullChunks, setFullChunks] = useState<Record<string, FullIntelChunk>>({});

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSource, setFormSource] = useState("manual");
  const [formText, setFormText] = useState("");
  const [formUrl, setFormUrl] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: ingestStatus } = useIngestStatus();
  const { data: stats } = useIntelStats();

  // Use search or regular chunks based on query
  const isSearching = debouncedQuery.trim().length > 0;
  const { data: searchData, error: searchError } = useIntelSearch(
    debouncedQuery,
    currentPage,
    20,
    selectedSource
  );
  const { data: chunksData, error: chunksError } = useIntelChunks(
    currentPage,
    20,
    selectedSource
  );

  // Use search data if searching, otherwise use regular chunks
  const displayData = isSearching ? searchData : chunksData;
  const displayError = isSearching ? searchError : chunksError;

  const handleSourceChange = (source: string) => {
    setSelectedSource(source);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setCurrentPage(1);
  };

  const handleRunIngest = async () => {
    setIsIngesting(true);
    try {
      const result = await triggerIngest();
      if (result.started) {
        // Poll for updates
        setTimeout(() => {
          mutate("/api/intel/ingest/status");
          mutate("/api/intel/stats");
        }, 2000);
      } else {
        alert(result.message || "Ingestion already running");
      }
    } catch (err) {
      console.error("Failed to trigger ingestion:", err);
      alert("Failed to start ingestion. Please try again.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createIntelChunk({
        title: formTitle,
        source: formSource,
        text: formText,
        url: formUrl || undefined,
      });

      // Clear form
      setFormTitle("");
      setFormSource("manual");
      setFormText("");
      setFormUrl("");
      setShowAddForm(false);

      // Refresh data
      mutate((key) => typeof key === "string" && key.includes("/api/intel/"));
    } catch (err) {
      console.error("Failed to create intel chunk:", err);
      alert("Failed to create intel chunk. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleChunkExpansion = async (chunkId: string) => {
    if (expandedChunk === chunkId) {
      setExpandedChunk(null);
      return;
    }

    setExpandedChunk(chunkId);

    // Fetch full content if not already loaded
    if (!fullChunks[chunkId]) {
      try {
        const fullChunk = await getIntelChunk(chunkId);
        setFullChunks((prev) => ({ ...prev, [chunkId]: fullChunk }));
      } catch (err) {
        console.error("Failed to fetch full chunk:", err);
        setExpandedChunk(null);
      }
    }
  };

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Intelligence Library</PageHeaderTitle>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex rounded-md border p-0.5 bg-muted/50">
              <button
                onClick={() => setMode("browse")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors",
                  mode === "browse" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="h-4 w-4" />
                Browse
              </button>
              <button
                onClick={() => setMode("ask")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors",
                  mode === "ask" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Ask
              </button>
            </div>
            {mode === "browse" && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Chunk
              </Button>
            )}
          </div>
        </PageHeaderRow>
      </PageHeader>

      {/* Ask Mode */}
      {mode === "ask" && <AskMode />}

      <div className={cn("space-y-6", mode === "ask" && "hidden")}>
        {/* Auto-Brief */}
        {!briefDismissed && (brief || briefLoading) && (
          <Card className="p-4 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400 mb-1">
                  Intelligence Brief
                </p>
                {briefLoading ? (
                  <div className="flex gap-1 text-muted-foreground">
                    <span className="animate-bounce text-sm">·</span>
                    <span className="animate-bounce text-sm" style={{ animationDelay: "150ms" }}>·</span>
                    <span className="animate-bounce text-sm" style={{ animationDelay: "300ms" }}>·</span>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{brief}</p>
                )}
              </div>
              <button
                onClick={() => setBriefDismissed(true)}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}

        {/* Ingestion Status Bar */}
        {ingestStatus && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  Last ingested:{" "}
                  <strong className="text-foreground">
                    {formatRelativeTime(ingestStatus.last_run)}
                  </strong>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">
                    {ingestStatus.chunk_count}
                  </strong>{" "}
                  chunks
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Next: <strong className="text-foreground">{ingestStatus.next_run}</strong>
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRunIngest}
                disabled={isIngesting}
              >
                {isIngesting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-4 w-4" />
                    Run Now
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search intelligence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {isSearching && displayData && (
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{displayData.total}</strong> result
            {displayData.total !== 1 ? "s" : ""} for &quot;
            <strong className="text-foreground">{debouncedQuery}</strong>&quot;
          </div>
        )}

        {/* Source Filter Tabs */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {Object.entries(sourceLabels).map(([source, label]) => {
              const count = stats?.by_source[source] || 0;
              const showCount = source !== "all" && count > 0;
              const lastDate = source !== "all" ? stats?.source_last_dates?.[source] : undefined;
              const staleHours = lastDate
                ? (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60)
                : null;
              const isStale = staleHours !== null && staleHours > 72;
              
              return (
                <div key={source} className="flex flex-col items-center gap-0.5">
                  <Button
                    variant={selectedSource === source ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSourceChange(source)}
                    className="whitespace-nowrap"
                  >
                    {sourceIcons[source] && (
                      <span className="mr-1.5">{sourceIcons[source]}</span>
                    )}
                    {label}
                    {showCount && (
                      <span className="ml-1.5 opacity-70">({count})</span>
                    )}
                  </Button>
                  {lastDate && source !== "all" && (
                    <span className={cn(
                      "text-[10px]",
                      isStale ? "text-orange-500" : "text-muted-foreground/60"
                    )}>
                      {isStale ? "stale" : `${Math.floor(staleHours!)}h ago`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chunk List */}
        {displayError ? (
          <Card className="p-4">
            <p className="text-destructive">Failed to load intelligence chunks.</p>
          </Card>
        ) : !displayData ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : displayData.chunks.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">
              {isSearching ? (
                <>
                  No results found for &quot;<strong>{debouncedQuery}</strong>&quot;
                </>
              ) : stats?.total === 0 ? (
                <>No intelligence ingested yet. Run ingestion to get started.</>
              ) : (
                <>No intelligence chunks found for this filter.</>
              )}
            </p>
            {isSearching ? (
              <Button variant="outline" onClick={handleClearSearch}>
                Clear Search
              </Button>
            ) : stats?.total === 0 ? (
              <Button onClick={handleRunIngest} disabled={isIngesting}>
                {isIngesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Ingestion
                  </>
                )}
              </Button>
            ) : null}
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {displayData.chunks.map((chunk) => {
                const isExpanded = expandedChunk === chunk.id;
                const fullChunk = fullChunks[chunk.id];
                
                return (
                  <Card
                    key={chunk.id}
                    className="p-4 cursor-pointer hover:border-foreground/20 transition-colors"
                    onClick={() => toggleChunkExpansion(chunk.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xl">
                            {sourceIcons[chunk.source] ?? "📄"}
                          </span>
                          <h3 className="font-medium">{chunk.title}</h3>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                          )}
                        </div>
                        {chunk.url && (
                          <a
                            href={chunk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>

                      {isExpanded ? (
                        fullChunk ? (
                          <div className="max-h-[300px] overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap rounded border p-3 bg-muted/30">
                            {fullChunk.content}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-4 rounded border p-3 bg-muted/30">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {chunk.content_preview}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {chunk.source}
                        </Badge>
                        {chunk.entity_type !== chunk.source && (
                          <Badge variant="secondary" className="text-xs">
                            {chunk.entity_type}
                          </Badge>
                        )}
                        <span>{formatChunkDate(chunk.date)}</span>
                        {isSearching && (chunk as { score?: number }).score !== undefined && (
                          <span
                            className={cn(
                              "ml-auto font-medium tabular-nums",
                              (chunk as { score?: number }).score! >= 70
                                ? "text-emerald-600 dark:text-emerald-400"
                                : (chunk as { score?: number }).score! >= 40
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {(chunk as { score?: number }).score}% match
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {displayData.pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {displayData.page} of {displayData.pages} (
                  {displayData.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(displayData.pages, p + 1))
                    }
                    disabled={currentPage === displayData.pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Form Slide-in Panel */}
      {showAddForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setShowAddForm(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-background border-l shadow-lg z-50 overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add Intelligence Chunk</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Intelligence title"
                    required
                    disabled={isSubmitting}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Source</label>
                  <Select
                    value={formSource}
                    onValueChange={setFormSource}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">
                        {sourceIcons.manual} Manual
                      </SelectItem>
                      <SelectItem value="gmail">
                        {sourceIcons.gmail} Gmail
                      </SelectItem>
                      <SelectItem value="reddit">
                        {sourceIcons.reddit} Reddit
                      </SelectItem>
                      <SelectItem value="hn">
                        {sourceIcons.hn} Hacker News
                      </SelectItem>
                      <SelectItem value="twitter">
                        {sourceIcons.twitter} Twitter
                      </SelectItem>
                      <SelectItem value="github">
                        {sourceIcons.github} GitHub
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="Intelligence content"
                    rows={10}
                    required
                    disabled={isSubmitting}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">URL (optional)</label>
                  <Input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                    disabled={isSubmitting}
                    className="mt-1.5"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default IntelligencePage;
