"use client";

import type { DocumentWithCreator } from "@clawe/backend/types";

export type DocumentsSectionProps = {
  taskId: string;
  onViewDocument: (doc: DocumentWithCreator) => void;
  open?: boolean;
  onToggle?: () => void;
  maxVisible?: number;
  onShowAll?: () => void;
};

/** CENTAUR stub — documents not available in local mode. */
export const DocumentsSection = (_props: DocumentsSectionProps) => {
  return null;
};
