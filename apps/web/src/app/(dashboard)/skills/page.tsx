"use client";

export const dynamic = "force-dynamic";

import { useSkills } from "@/lib/api/local";
import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Badge } from "@clawe/ui/components/badge";
import { Card } from "@clawe/ui/components/card";
import { Skeleton } from "@clawe/ui/components/skeleton";
import { Input } from "@clawe/ui/components/input";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";

const SkillsPage = () => {
  const { data, error, isLoading } = useSkills();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSkills = useMemo(() => {
    if (!data?.skills) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return data.skills;
    return data.skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.id.toLowerCase().includes(query)
    );
  }, [data?.skills, searchQuery]);

  const stats = useMemo(() => {
    if (!data?.skills) return { total: 0, installed: 0, builtin: 0 };
    return {
      total: data.skills.length,
      installed: data.skills.filter((s) => s.installed && !s.builtin).length,
      builtin: data.skills.filter((s) => s.builtin).length,
    };
  }, [data?.skills]);

  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Skills</PageHeaderTitle>
        </PageHeaderRow>
        <p className="text-sm text-muted-foreground mt-1">
          OpenClaw capabilities installed on this host
        </p>
      </PageHeader>

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">User Installed</p>
            <p className="text-2xl font-bold">{stats.installed}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Built-in</p>
            <p className="text-2xl font-bold">{stats.builtin}</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Error state */}
        {error && (
          <Card className="p-4 text-destructive text-sm">
            Failed to load skills.
          </Card>
        )}

        {/* Loading state */}
        {(isLoading || !data) && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-8 w-8 mb-2" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full mt-1" />
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {data && filteredSkills.length === 0 && !isLoading && (
          <Card className="p-8 text-center text-muted-foreground">
            {searchQuery ? "No skills match your search." : "No skills found."}
          </Card>
        )}

        {/* Skills grid */}
        {data && filteredSkills.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <Card key={skill.id} className="p-4 flex flex-col">
                <div className="text-3xl mb-2">{skill.emoji}</div>
                <h3 className="font-semibold text-sm mb-1">{skill.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 flex-1 mt-1">
                  {skill.description || "No description available."}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {skill.installed && (
                    <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                      Installed
                    </Badge>
                  )}
                  {skill.builtin && (
                    <Badge variant="secondary" className="text-xs">
                      Built-in
                    </Badge>
                  )}
                  {skill.requires.map((bin) => (
                    <Badge
                      key={bin}
                      variant="outline"
                      className="text-xs text-muted-foreground"
                    >
                      {bin}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SkillsPage;
