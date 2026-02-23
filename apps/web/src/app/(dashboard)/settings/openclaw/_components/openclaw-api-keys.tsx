"use client";

import { useState } from "react";
import { useAPIKeys, updateAPIKey } from "@/lib/api/local";
import { Button } from "@clawe/ui/components/button";
import { Input } from "@clawe/ui/components/input";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Pencil, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";

export const OpenClawAPIKeys = () => {
  const { data, error, isLoading } = useAPIKeys();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEdit = (keyName: string) => {
    setEditingKey(keyName);
    setEditValue("");
    setShowValue(false);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue("");
    setShowValue(false);
  };

  const handleSave = async (keyName: string) => {
    if (!editValue.trim()) {
      toast.error("Value cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await updateAPIKey(keyName, editValue);
      toast.success(`Updated ${keyName}`);
      setEditingKey(null);
      setEditValue("");
      mutate("/api/settings/keys");
    } catch (err) {
      toast.error(`Failed to update ${keyName}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Card className="p-4 text-destructive text-sm">
        Failed to load API keys from ~/.openclaw/openclaw.json
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">API Keys</h3>
        <p className="text-muted-foreground text-sm">
          Keys stored in <code className="text-xs">~/.openclaw/openclaw.json</code>
        </p>
      </div>

      <div className="space-y-3">
        {data.keys.map((key) => (
          <Card key={key.name} className="p-4">
            {editingKey === key.name ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium flex-1">{key.name}</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showValue ? "text" : "password"}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter new value..."
                      className="pr-9 font-mono text-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowValue(!showValue)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                    >
                      {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(key.name)}
                    disabled={saving || !editValue.trim()}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                    {key.masked}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(key.name)}
                  className="shrink-0"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {data.keys.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No API keys found in config
        </p>
      )}
    </div>
  );
};
