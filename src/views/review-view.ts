import { ItemView, MarkdownRenderer, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { applySuggestion } from "../apply-suggestion";
import { createAnchor } from "../anchors";
import { formatReviewFeedback } from "../export-feedback";
import type AgentToolsPlugin from "../main";
import type { ReviewAnnotationKind, ReviewRecord, ReviewSummary } from "../types";
import { promptForText } from "../ui/prompt-modal";

export const REVIEW_VIEW_TYPE = "agenttools-review";

export class ReviewView extends ItemView {
  private activeFile: TFile | null = null;
  private activeRecord: ReviewRecord | null = null;
  private sourceContent = "";
  private selectedRange: { text: string; from: number; to: number } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: AgentToolsPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return REVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Agent Tools Review";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    await this.renderDashboard();
  }

  async openFile(file: TFile): Promise<void> {
    this.activeFile = file;
    this.sourceContent = await this.app.vault.read(file);
    this.activeRecord = await this.plugin.reviewStore.loadRecord(file);
    await this.renderDetail();
  }

  async refresh(): Promise<void> {
    if (this.activeFile) {
      await this.openFile(this.activeFile);
      return;
    }

    await this.renderDashboard();
  }

  private async renderDashboard(): Promise<void> {
    this.activeFile = null;
    this.activeRecord = null;
    this.selectedRange = null;

    const container = this.contentEl;
    container.empty();
    container.addClass("agenttools-root");

    const header = container.createDiv({ cls: "agenttools-view-header" });
    header.createEl("h2", { text: "AI review" });
    const actions = header.createDiv({ cls: "agenttools-actions" });
    this.createActionButton(actions, "Review active file", () => void this.plugin.reviewActiveDocument());
    this.createIconButton(actions, "refresh-cw", "Refresh", () => void this.renderDashboard());

    const state = container.createDiv({ cls: "agenttools-state", text: "Loading..." });
    let summaries: ReviewSummary[];
    try {
      summaries = await this.plugin.reviewIndex.listSummaries();
    } catch (error) {
      state.setText(error instanceof Error ? error.message : "Unable to load reviews.");
      return;
    }
    state.remove();

    if (summaries.length === 0) {
      container.createDiv({ cls: "agenttools-empty", text: "No Markdown files found. Open any file and choose Review active file." });
      return;
    }

    const list = container.createDiv({ cls: "agenttools-dashboard-list" });
    for (const summary of summaries) {
      this.renderSummaryRow(list, summary);
    }
  }

  private renderSummaryRow(container: HTMLElement, summary: ReviewSummary): void {
    const button = container.createEl("button", { cls: "agenttools-summary-row" });
    button.type = "button";
    button.createDiv({ cls: "agenttools-summary-title", text: summary.title });
    button.createDiv({ cls: "agenttools-summary-path", text: summary.sourcePath });

    const meta = button.createDiv({ cls: "agenttools-summary-meta" });
    meta.createSpan({ cls: `agenttools-pill agenttools-pill-${summary.decision}`, text: formatDecision(summary.decision) });
    meta.createSpan({ text: `${summary.openAnnotationCount}/${summary.annotationCount} open` });

    button.addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(summary.sourcePath);
      if (file instanceof TFile) {
        void this.openFile(file);
      }
    });
  }

  private async renderDetail(): Promise<void> {
    if (!this.activeFile || !this.activeRecord) {
      await this.renderDashboard();
      return;
    }

    const container = this.contentEl;
    container.empty();
    container.addClass("agenttools-root");

    const header = container.createDiv({ cls: "agenttools-view-header" });
    this.createIconButton(header, "arrow-left", "Back", () => void this.renderDashboard());
    const title = header.createDiv({ cls: "agenttools-title-block" });
    title.createEl("h2", { text: this.activeFile.basename });
    title.createDiv({ cls: "agenttools-summary-path", text: this.activeFile.path });

    const decisions = header.createDiv({ cls: "agenttools-actions" });
    this.createActionButton(decisions, "Approve", () => void this.setDecision("approved"));
    this.createActionButton(decisions, "Request changes", () => void this.setDecision("changes_requested"));
    this.createActionButton(decisions, "Export", () => void this.exportActiveFeedback());

    const tools = container.createDiv({ cls: "agenttools-toolbar" });
    this.createActionButton(tools, "Comment", () => void this.addAnnotation("comment"));
    this.createActionButton(tools, "Replace", () => void this.addAnnotation("replacement"));
    this.createActionButton(tools, "Delete", () => void this.addAnnotation("deletion"));

    const state = container.createDiv({ cls: "agenttools-state", text: "Loading..." });
    const body = container.createDiv({ cls: "agenttools-review-layout" });
    const article = body.createDiv({ cls: "agenttools-document" });
    const side = body.createDiv({ cls: "agenttools-side-panel" });

    article.addEventListener("mouseup", () => {
      this.captureSelection(article);
    });
    article.addEventListener("keyup", () => {
      this.captureSelection(article);
    });

    try {
      await MarkdownRenderer.renderMarkdown(this.sourceContent, article, this.activeFile.path, this);
      this.renderAnnotations(side, this.activeRecord);
      state.remove();
    } catch (error) {
      body.remove();
      state.setText(error instanceof Error ? error.message : "Unable to render review.");
    }
  }

  private renderAnnotations(container: HTMLElement, record: ReviewRecord): void {
    container.empty();
    const header = container.createDiv({ cls: "agenttools-side-header" });
    header.createEl("h3", { text: formatDecision(record.decision) });
    header.createDiv({ text: `${record.annotations.length} annotations` });

    if (record.annotations.length === 0) {
      container.createDiv({ cls: "agenttools-empty", text: "No annotations." });
      return;
    }

    for (const annotation of record.annotations) {
      const item = container.createDiv({ cls: "agenttools-annotation" });
      item.createDiv({ cls: "agenttools-annotation-kind", text: annotation.kind });
      item.createEl("blockquote", { text: annotation.quote });
      if (annotation.body) {
        item.createDiv({ cls: "agenttools-annotation-body", text: annotation.body });
      }
      if (annotation.replacement) {
        item.createEl("pre", { text: annotation.replacement });
      }
      if ((annotation.kind === "replacement" || annotation.kind === "deletion") && annotation.status === "open") {
        this.createActionButton(item, "Apply", () => void this.applyAnnotation(annotation.id));
      }
      item.createDiv({ cls: `agenttools-pill agenttools-pill-${annotation.status}`, text: annotation.status });
    }
  }

  private captureSelection(container: HTMLElement): void {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!selection || !text || selection.rangeCount === 0) {
      this.selectedRange = null;
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      this.selectedRange = null;
      return;
    }

    const from = this.sourceContent.indexOf(text);
    this.selectedRange = from === -1 ? null : { text, from, to: from + text.length };
  }

  private async addAnnotation(kind: ReviewAnnotationKind): Promise<void> {
    if (!this.activeFile || !this.selectedRange) {
      new Notice("Select document text first.");
      return;
    }

    const body = kind === "deletion" ? "" : await promptForText(this.app, labelForAnnotation(kind), "Review note");
    if (body === null) {
      return;
    }

    const replacement =
      kind === "replacement" ? await promptForText(this.app, "Replacement text", this.selectedRange.text) : undefined;
    if (kind === "replacement" && replacement === null) {
      return;
    }

    this.activeRecord = await this.plugin.reviewStore.addAnnotation(this.activeFile, {
      ...createAnchor(this.sourceContent, this.selectedRange.from, this.selectedRange.to),
      kind,
      body: body || undefined,
      replacement: replacement || undefined
    });
    await this.renderDetail();
  }

  private async setDecision(decision: ReviewRecord["decision"]): Promise<void> {
    if (!this.activeFile) {
      return;
    }

    this.activeRecord = await this.plugin.reviewStore.setDecision(this.activeFile, decision);
    await this.renderDetail();
  }

  async exportActiveFeedback(): Promise<void> {
    if (!this.activeRecord) {
      new Notice("No active review.");
      return;
    }

    await navigator.clipboard.writeText(formatReviewFeedback([this.activeRecord]));
    new Notice("Review feedback copied.");
  }

  async applyFirstOpenSuggestion(): Promise<void> {
    const annotation = this.activeRecord?.annotations.find(
      (item) => item.status === "open" && (item.kind === "replacement" || item.kind === "deletion")
    );

    if (!annotation) {
      new Notice("No open suggestion to apply.");
      return;
    }

    await this.applyAnnotation(annotation.id);
  }

  private async applyAnnotation(annotationId: string): Promise<void> {
    if (!this.activeFile || !this.activeRecord) {
      return;
    }

    const annotation = this.activeRecord.annotations.find((item) => item.id === annotationId);
    if (!annotation) {
      return;
    }

    const result = applySuggestion(this.sourceContent, annotation);
    if (!result.applied) {
      this.activeRecord = await this.plugin.reviewStore.updateAnnotationStatus(this.activeFile, annotation.id, "conflict");
      new Notice(result.match.reason ?? "Suggestion no longer matches.");
      await this.renderDetail();
      return;
    }

    await this.app.vault.modify(this.activeFile, result.content);
    this.activeRecord = await this.plugin.reviewStore.updateAnnotationStatus(this.activeFile, annotation.id, "applied");
    this.sourceContent = result.content;
    new Notice("Suggestion applied.");
    await this.renderDetail();
  }

  private createIconButton(container: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = container.createEl("button", { cls: "clickable-icon agenttools-icon-button", attr: { "aria-label": label } });
    button.type = "button";
    setIcon(button, icon);
    button.addEventListener("click", onClick);
    return button;
  }

  private createActionButton(container: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
    const button = container.createEl("button", { cls: "mod-cta agenttools-action-button", text });
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }
}

function formatDecision(decision: ReviewRecord["decision"]): string {
  return decision.replace(/_/g, " ");
}

function labelForAnnotation(kind: ReviewAnnotationKind): string {
  if (kind === "replacement") {
    return "Replacement note";
  }
  if (kind === "check") {
    return "Approval note";
  }
  return "Comment";
}
