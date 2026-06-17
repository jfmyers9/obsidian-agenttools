import type { TFile, Vault } from "obsidian";
import type { ReviewStore } from "./review-store";
import type { AgentToolsSettings, ReviewSummary } from "./types";

interface MarkdownFileLike {
  path: string;
  basename: string;
  stat: {
    mtime: number;
  };
}

export class ReviewIndexService {
  constructor(
    private readonly vault: Vault,
    private readonly store: ReviewStore,
    private readonly getSettings: () => AgentToolsSettings
  ) {}

  async listSummaries(): Promise<ReviewSummary[]> {
    const settings = this.getSettings();
    const files = filterReviewFiles(this.vault.getMarkdownFiles(), settings);
    const summaries = await Promise.all(
      files.map(async (file) => {
        const record = await this.store.loadRecord(file);
        const openAnnotations = record.annotations.filter((annotation) => annotation.status === "open");

        return {
          sourcePath: file.path,
          title: file.basename || titleFromPath(file.path),
          modifiedTime: file.stat.mtime,
          decision: record.decision,
          annotationCount: record.annotations.length,
          openAnnotationCount: openAnnotations.length
        } satisfies ReviewSummary;
      })
    );

    return summaries.sort((left, right) => right.modifiedTime - left.modifiedTime || left.sourcePath.localeCompare(right.sourcePath));
  }
}

export function filterReviewFiles<T extends MarkdownFileLike>(files: T[], settings: AgentToolsSettings): T[] {
  return files.filter((file) => isReviewablePath(file.path, settings));
}

export function isReviewablePath(path: string, settings: AgentToolsSettings): boolean {
  const normalized = normalizePath(path);
  const sidecarRoot = normalizePath(settings.sidecarRoot);

  if (normalized === sidecarRoot || normalized.startsWith(`${sidecarRoot}/`)) {
    return false;
  }

  const roots = settings.reviewRoots.map(normalizePath).filter(Boolean);

  if (roots.length === 0) {
    return normalized.endsWith(".md");
  }

  return roots.some((root) => normalized === `${root}.md` || normalized.startsWith(`${root}/`));
}

function titleFromPath(path: string): string {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/i, "");
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}
