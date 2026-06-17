export type ReviewDecision = "needs_review" | "approved" | "changes_requested";

export type ReviewAnnotationKind = "comment" | "replacement" | "deletion" | "check";

export type ReviewAnnotationStatus = "open" | "resolved" | "applied" | "conflict";

export interface TextAnchor {
  quote: string;
  prefix?: string;
  suffix?: string;
  line?: number;
  from?: number;
  to?: number;
}

export interface ReviewAnnotation extends TextAnchor {
  id: string;
  kind: ReviewAnnotationKind;
  status: ReviewAnnotationStatus;
  body?: string;
  replacement?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  schemaVersion: 1;
  sourcePath: string;
  sourceHash: string;
  decision: ReviewDecision;
  updatedAt: string;
  annotations: ReviewAnnotation[];
}

export interface ReviewSummary {
  sourcePath: string;
  title: string;
  modifiedTime: number;
  decision: ReviewDecision;
  annotationCount: number;
  openAnnotationCount: number;
}

export interface AgentToolsSettings {
  reviewRoots: string[];
  sidecarRoot: string;
  defaultExportMode: "agent_feedback" | "append_to_note";
  showRibbonIcon: boolean;
}

export interface AnchorMatch {
  matched: boolean;
  from?: number;
  to?: number;
  reason?: string;
}
