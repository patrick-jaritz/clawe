"use client";

export const dynamic = "force-dynamic";

import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { Separator } from "@clawe/ui/components/separator";
import { OpenClawAPIKeys } from "./_components/openclaw-api-keys";
import { ModelSelector } from "./_components/model-selector";

const OpenClawSettingsPage = () => {
  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>OpenClaw Configuration</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="max-w-4xl space-y-8">
        <OpenClawAPIKeys />

        <Separator />

        <ModelSelector />
      </div>
    </>
  );
};

export default OpenClawSettingsPage;
