"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawe/ui/components/card";
import { Button } from "@clawe/ui/components/button";
import { Input } from "@clawe/ui/components/input";
import {
  ALL_QUICK_ACTIONS,
  getEnabledActionIds,
  setEnabledActionIds,
} from "@/lib/quick-actions-config";
import {
  useShareToken,
  generateShareToken,
  revokeShareToken,
} from "@/lib/api/local";
import { cn } from "@clawe/ui/lib/utils";
import { Check, Copy, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { mutate } from "swr";

const DashboardSettingsPage = () => {
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const { data: shareData } = useShareToken();
  const shareToken = shareData?.token ?? null;

  useEffect(() => {
    setEnabled(getEnabledActionIds());
  }, []);

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share?token=${shareToken}`
    : null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setTokenLoading(true);
    try {
      await generateShareToken();
      mutate("/api/share/token");
    } finally { setTokenLoading(false); }
  };

  const handleRevoke = async () => {
    setTokenLoading(true);
    try {
      await revokeShareToken();
      mutate("/api/share/token");
    } finally { setTokenLoading(false); }
  };

  const toggle = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    setEnabledActionIds(enabled);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults = new Set(ALL_QUICK_ACTIONS.filter((a) => a.defaultEnabled).map((a) => a.id));
    setEnabled(defaults);
    setSaved(false);
  };

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Dashboard</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="max-w-2xl space-y-6">
        {/* Read-only Share URL */}
        <Card>
          <CardHeader>
            <CardTitle>Read-only Share URL</CardTitle>
            <CardDescription>
              Share a read-only view of your CLAWE dashboard (running projects + intel brief) with anyone on your Tailscale network or locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {shareUrl ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleGenerate} disabled={tokenLoading}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleRevoke} disabled={tokenLoading}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={handleGenerate} disabled={tokenLoading}>
                {tokenLoading ? "Generating..." : "Generate share link"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Choose which shortcuts appear in the Quick Actions section on the Home page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ALL_QUICK_ACTIONS.map((action) => {
              const isEnabled = enabled.has(action.id);
              return (
                <button
                  key={action.id}
                  onClick={() => toggle(action.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    isEnabled
                      ? "border-foreground/30 bg-foreground/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.external ? `Port ${action.href.replace("PORT:", "")}` : action.href}
                    </p>
                  </div>
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                    isEnabled
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground"
                  )}>
                    {isEnabled && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} size="sm">
                {saved ? "Saved ✓" : "Save"}
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                Reset to defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DashboardSettingsPage;
