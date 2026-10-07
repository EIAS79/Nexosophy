export type ContentNodeKind =
  | "folder"
  | "note"
  | "document"
  | "whiteboard"
  | "dataset"
  | "spreadsheet"
  | "notebook"
  | "report"
  | "research_item"
  | "lab_record"
  | "attachment"
  | "shortcut";

export type ContentNode = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  kind: ContentNodeKind;
  name: string;
  targetNodeId: string | null;
  metadata: Record<string, unknown>;
  trashedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  hasChildren: boolean;
  favorite?: boolean;
  pinned?: boolean;
};

export type ContentNodePage = {
  items: ContentNode[];
  nextCursor: string | null;
};

export type ContentOperationType = "copy_subtree" | "trash_subtree" | "restore_subtree";
export type ContentOperationStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type ContentOperation = {
  id: string;
  workspaceId: string;
  operation: ContentOperationType;
  status: ContentOperationStatus;
  rootNodeId: string;
  targetParentId: string | null;
  processedNodes: number;
  totalNodes: number;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ContentBulkResult = {
  completed: string[];
  queued: ContentOperation[];
};

export type ContentStoreErrorCode =
  | "NODE_NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_FOLDER"
  | "TARGET_NOT_FOUND"
  | "CYCLE"
  | "NAME_CONFLICT"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_CANCELLED";

export class ContentStoreError extends Error {
  constructor(
    readonly code: ContentStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContentStoreError";
  }
}