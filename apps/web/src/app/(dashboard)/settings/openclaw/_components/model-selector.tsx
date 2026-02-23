"use client";

import { useState, useMemo } from "react";
import { useModels, setPreferredModel } from "@/lib/api/local";
import { Card } from "@clawe/ui/components/card";
import { Badge } from "@clawe/ui/components/badge";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { cn } from "@clawe/ui/lib/utils";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";

export const ModelSelector = () => {
  const { data, error, isLoading } = useModels();
  const [selecting, setSelecting] = useState(false);

  const groupedModels = useMemo(() => {
    if (!data?.models) return {};
    const groups: Record<string, typeof data.models> = {};
    for (const model of data.models) {
      (groups[model.provider] ??= []).push(model);
    }
    return groups;
  }, [data?.models]);

  const handleSelectModel = async (modelId: string) => {
    if (selecting) return;
    setSelecting(true);
    try {
      await setPreferredModel(modelId);
      toast.success("Default model updated");
      mutate("/api/settings/models");
    } catch (err) {
      toast.error(`Failed to set model: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSelecting(false);
    }
  };

  if (error) {
    return (
      <Card className="p-4 text-destructive text-sm">
        Failed to load models from ~/.openclaw/openclaw.json
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Default Model</h3>
        <p className="text-muted-foreground text-sm">
          Preferred model for new agent sessions
        </p>
      </div>

      {Object.entries(groupedModels).map(([provider, models]) => (
        <div key={provider} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {provider}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {models.map((model) => {
              const isSelected = model.id === data.preferred;
              return (
                <Card
                  key={model.id}
                  className={cn(
                    "p-3 cursor-pointer transition-all hover:border-primary/50",
                    isSelected && "ring-2 ring-primary border-primary"
                  )}
                  onClick={() => handleSelectModel(model.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {provider}
                        </Badge>
                        {model.reasoning && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Reasoning
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{model.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {model.id}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {data.models.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No models configured
        </p>
      )}
    </div>
  );
};
