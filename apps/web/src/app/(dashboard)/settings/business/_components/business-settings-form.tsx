"use client";

import { useState, useEffect } from "react";
import { useBusiness } from "@/lib/api/local";
import { Button } from "@clawe/ui/components/button";
import { Input } from "@clawe/ui/components/input";
import { Label } from "@clawe/ui/components/label";
import { Textarea } from "@clawe/ui/components/textarea";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { toast } from "sonner";
import { Globe, Building2, Users, Palette, Layers } from "lucide-react";

export const BusinessSettingsForm = () => {
  const { data, isLoading, mutate } = useBusiness();

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setUrl(data.url ?? "");
      setName(data.name ?? "");
      setDescription(data.description ?? "");
      setIndustry(data.industry ?? "");
      setTargetAudience(data.targetAudience ?? "");
      setTone(data.tone ?? "");
      setIsDirty(false);
    }
  }, [data]);

  const handle = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setIsDirty(true);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name, description, industry, targetAudience, tone }),
      });
      if (!res.ok) throw new Error("Save failed");
      setIsDirty(false);
      await mutate();
      toast.success("Business settings saved");
    } catch {
      toast.error("Failed to save business settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1,2,3,4].map(i => <div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Business Context</h3>
        <p className="text-muted-foreground text-sm mt-0.5">
          Stored locally in ~/clawd/aurel/config/business.json. Used by agents as context for research and content.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url" className="flex items-center gap-2">
          <Globe className="h-4 w-4" /> Website URL
        </Label>
        <Input id="url" type="url" value={url} onChange={handle(setUrl)} placeholder="https://beforeyouleap.app" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Business Name
        </Label>
        <Input id="name" value={name} onChange={handle(setName)} placeholder="CENTAUR / Before You Leap" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={handle(setDescription)}
          placeholder="Describe what your business does…" rows={3} />
      </div>

      <div className="border-t pt-6 space-y-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Agent Context</h3>

        <div className="space-y-2">
          <Label htmlFor="industry" className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Industry
          </Label>
          <Input id="industry" value={industry} onChange={handle(setIndustry)} placeholder="AI / SaaS" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAudience" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Target Audience
          </Label>
          <Input id="targetAudience" value={targetAudience} onChange={handle(setTargetAudience)}
            placeholder="Early-stage founders" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tone" className="flex items-center gap-2">
            <Palette className="h-4 w-4" /> Brand Tone
          </Label>
          <Input id="tone" value={tone} onChange={handle(setTone)} placeholder="Direct, strategic, no-fluff" />
        </div>
      </div>

      <Button type="submit" disabled={!isDirty || isSaving}>
        {isSaving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
};
