"use client";

import { useState } from "react";
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
  useIntelStats,
  createIntelChunk,
} from "@/lib/api/local";
import { Plus, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

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
  all: "All Sources",
  gmail: "Gmail",
  rss: "RSS",
  reddit: "Reddit",
  hn: "Hacker News",
  twitter: "Twitter",
  github: "GitHub",
  manual: "Manual",
};

const IntelligencePage = () => {
  const [selectedSource, setSelectedSource] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formSource, setFormSource] = useState("manual");
  const [formText, setFormText] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const { data: chunksData, error: chunksError } = useIntelChunks(
    currentPage,
    20,
    selectedSource
  );
  const { data: stats } = useIntelStats();

  const handleSourceChange = (source: string) => {
    setSelectedSource(source);
    setCurrentPage(1);
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

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Intelligence Library</PageHeaderTitle>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Chunk
          </Button>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-6">
        {/* Stats Bar */}
        {stats && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              Total: {stats.total}
            </Badge>
            {Object.entries(stats.by_source).map(([source, count]) => (
              <Badge key={source} variant="outline" className="text-xs">
                {sourceIcons[source] ?? "📄"} {source}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Source Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(sourceLabels).map(([source, label]) => (
            <Button
              key={source}
              variant={selectedSource === source ? "default" : "outline"}
              size="sm"
              onClick={() => handleSourceChange(source)}
            >
              {sourceIcons[source] && (
                <span className="mr-1.5">{sourceIcons[source]}</span>
              )}
              {label}
            </Button>
          ))}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Intelligence title"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Source</label>
                <Select
                  value={formSource}
                  onValueChange={setFormSource}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
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
                  rows={6}
                  required
                  disabled={isSubmitting}
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
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
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
          </Card>
        )}

        {/* Chunk List */}
        {chunksError ? (
          <Card className="p-4">
            <p className="text-destructive">Failed to load intelligence chunks.</p>
          </Card>
        ) : !chunksData ? (
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
        ) : chunksData.chunks.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No intelligence chunks found for this filter.
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {chunksData.chunks.map((chunk) => (
                <Card key={chunk.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {sourceIcons[chunk.source] ?? "📄"}
                        </span>
                        <h3 className="font-medium">{chunk.title}</h3>
                      </div>
                      {chunk.url && (
                        <a
                          href={chunk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {chunk.content_preview}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {chunk.source}
                      </Badge>
                      {chunk.entity_type !== chunk.source && (
                        <Badge variant="secondary" className="text-xs">
                          {chunk.entity_type}
                        </Badge>
                      )}
                      <span>
                        {new Date(chunk.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {chunksData.pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {chunksData.page} of {chunksData.pages} (
                  {chunksData.total} total)
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
                      setCurrentPage((p) => Math.min(chunksData.pages, p + 1))
                    }
                    disabled={currentPage === chunksData.pages}
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
    </>
  );
};

export default IntelligencePage;
