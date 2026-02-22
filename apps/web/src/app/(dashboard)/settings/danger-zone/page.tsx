"use client";

export const dynamic = "force-dynamic";

import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { DeleteSquad } from "./_components/delete-squad";

const DangerZonePage = () => {
  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Danger zone</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="max-w-2xl">
        <DeleteSquad />
      </div>
    </>
  );
};

export default DangerZonePage;
