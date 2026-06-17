import type { TFile, Vault } from "obsidian";
import { hashPath, hashText } from "./hash";
import type {
  AgentToolsSettings,
  ReviewAnnotation,
  ReviewAnnotationKind,
  ReviewAnnotationStatus,
  ReviewDecision,
  ReviewRecord,
  TextAnchor
} from "./types";

export interface NewReviewAnnotation extends TextAnchor {
  kind: ReviewAnnotationKind;
  body?: string;
  replacement?: string;
}

export function sidecarPathFor(sourcePath: string, sidecarRoot: string): string {
  const normalizedRoot = normalizePath(sidecarRoot || ".agenttools/reviews");
  const basename = sourcePath.split("/").pop()?.replace(/\.md$/i, "") || "note";
  const safeName = basename.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "note";
  return normalizePath(`${normalizedRoot}/${hashPath(sourcePath)}-${safeName}.json`);
}

export class ReviewStore {
  constructor(
    private readonly vault: Vault,
    private readonly getSettings: () => AgentToolsSettings
  ) {}

  async loadRecord(source: TFile): Promise<ReviewRecord> {
    const sourceContent = await this.vault.read(source);
    const sidecarPath = this.getSidecarPath(source.path);
    const sidecar = this.vault.getAbstractFileByPath(sidecarPath);

    if (isTFile(sidecar)) {
      const parsed = JSON.parse(await this.vault.read(sidecar)) as ReviewRecord;
      return normalizeRecord(parsed, source.path, hashText(sourceContent));
    }

    return createDefaultRecord(source.path, sourceContent);
  }

  async saveRecord(record: ReviewRecord): Promise<void> {
    const sidecarPath = this.getSidecarPath(record.sourcePath);
    const content = `${JSON.stringify({ ...record, updatedAt: new Date().toISOString() }, null, 2)}\n`;
    await this.ensureParentFolder(sidecarPath);

    const existing = this.vault.getAbstractFileByPath(sidecarPath);
    if (isTFile(existing)) {
      await this.vault.modify(existing, content);
      return;
    }

    await this.vault.create(sidecarPath, content);
  }

  async setDecision(source: TFile, decision: ReviewDecision): Promise<ReviewRecord> {
    const record = await this.loadRecord(source);
    record.decision = decision;
    record.updatedAt = new Date().toISOString();
    await this.saveRecord(record);
    return record;
  }

  async addAnnotation(source: TFile, annotation: NewReviewAnnotation): Promise<ReviewRecord> {
    const record = await this.loadRecord(source);
    const now = new Date().toISOString();
    record.annotations.push({
      id: createAnnotationId(),
      status: "open",
      createdAt: now,
      updatedAt: now,
      ...annotation
    });
    record.updatedAt = now;
    await this.saveRecord(record);
    return record;
  }

  async updateAnnotationStatus(
    source: TFile,
    annotationId: string,
    status: ReviewAnnotationStatus
  ): Promise<ReviewRecord> {
    const record = await this.loadRecord(source);
    const annotation = record.annotations.find((item) => item.id === annotationId);

    if (annotation) {
      annotation.status = status;
      annotation.updatedAt = new Date().toISOString();
      record.updatedAt = annotation.updatedAt;
      await this.saveRecord(record);
    }

    return record;
  }

  getSidecarPath(sourcePath: string): string {
    return sidecarPathFor(sourcePath, this.getSettings().sidecarRoot);
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const parts = path.split("/").slice(0, -1);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.vault.getAbstractFileByPath(current)) {
        await this.vault.createFolder(current);
      }
    }
  }
}

function createDefaultRecord(sourcePath: string, content: string): ReviewRecord {
  return {
    schemaVersion: 1,
    sourcePath,
    sourceHash: hashText(content),
    decision: "needs_review",
    updatedAt: new Date().toISOString(),
    annotations: []
  };
}

function normalizeRecord(record: ReviewRecord, sourcePath: string, sourceHash: string): ReviewRecord {
  return {
    schemaVersion: 1,
    sourcePath,
    sourceHash,
    decision: record.decision ?? "needs_review",
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    annotations: Array.isArray(record.annotations) ? record.annotations : []
  };
}

function createAnnotationId(): string {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function isTFile(file: unknown): file is TFile {
  return typeof file === "object" && file !== null && "path" in file && "extension" in file;
}
