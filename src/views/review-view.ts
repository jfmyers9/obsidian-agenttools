import { ItemView, MarkdownView, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { applySuggestion } from "../apply-suggestion";
import { formatReviewFeedback } from "../export-feedback";
import type AgentToolsPlugin from "../main";
import type { ReviewAnnotation, ReviewRecord } from "../types";
import { promptForText } from "../ui/prompt-modal";

export const REVIEW_VIEW_TYPE = "agenttools-review";

export class ReviewView extends ItemView {
  private activeFile: TFile | null = null;
  private activeRecord: ReviewRecord | null = null;
  private sourceContent = "";

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
    await this.renderContextState();
  }

  async openFile(file: TFile, record?: ReviewRecord): Promise<void> {
    this.activeFile = file;
    this.sourceContent = await this.app.vault.read(file);
    this.activeRecord = record ?? (await this.plugin.reviewStore.loadRecord(file));
    await this.renderDetail();
  }

  async refresh(): Promise<void> {
    if (this.activeFile) {
      await this.openFile(this.activeFile);
      return;
    }

    await this.renderContextState();
  }

  private renderContextState(): void {
    this.activeFile = null;
    this.activeRecord = null;

    const container = this.contentEl;
    container.empty();
    container.addClass("agenttools-root");

    const header = container.createDiv({ cls: "agenttools-view-header" });
    header.createEl("h2", { text: "AI review" });
    this.createActionButton(header.createDiv({ cls: "agenttools-actions" }), "Review active file", () => void this.plugin.reviewActiveDocument());
    container.createDiv({ cls: "agenttools-empty", text: "No active Markdown file." });
  }

  private async renderDetail(): Promise<void> {
    if (!this.activeFile || !this.activeRecord) {
      this.renderContextState();
      return;
    }

    const container = this.contentEl;
    container.empty();
    container.addClass("agenttools-root");

    const header = container.createDiv({ cls: "agenttools-view-header" });
    const title = header.createDiv({ cls: "agenttools-title-block" });
    title.createEl("h2", { text: this.activeFile.basename });
    title.createDiv({ cls: "agenttools-summary-path", text: this.activeFile.path });

    const decisions = header.createDiv({ cls: "agenttools-actions" });
    this.createActionButton(decisions, "Approve", () => void this.setDecision("approved"));
    this.createActionButton(decisions, "Request changes", () => void this.setDecision("changes_requested"));
    this.createActionButton(decisions, "Export", () => void this.exportActiveFeedback());

    const hint = container.createDiv({ cls: "agenttools-state" });
    hint.createSpan({ text: "Use " });
    hint.createEl("kbd", { text: "Mod+Shift+R" });
    hint.createSpan({ text: " in the editor to add a comment to the selection or current line." });

    const comments = container.createDiv({ cls: "agenttools-comments-panel" });
    this.renderAnnotations(comments, this.activeRecord);
  }

  private renderAnnotations(container: HTMLElement, record: ReviewRecord): void {
    container.empty();
    const header = container.createDiv({ cls: "agenttools-side-header" });
    header.createEl("h3", { text: formatDecision(record.decision) });
    header.createDiv({ text: `${record.annotations.length} annotations` });

    if (record.annotations.length === 0) {
      container.createDiv({ cls: "agenttools-empty", text: "No comments yet." });
      return;
    }

    for (const annotation of record.annotations) {
      const item = container.createDiv({ cls: "agenttools-annotation" });
      const heading = item.createDiv({ cls: "agenttools-annotation-heading" });
      heading.createDiv({ cls: "agenttools-annotation-kind", text: annotation.line ? `line ${annotation.line}` : annotation.kind });
      heading.createDiv({ cls: `agenttools-pill agenttools-pill-${annotation.status}`, text: annotation.status });

      item.createEl("blockquote", { text: annotation.quote });
      if (annotation.body) {
        item.createDiv({ cls: "agenttools-annotation-body", text: annotation.body });
      }
      if (annotation.replacement) {
        item.createEl("pre", { text: annotation.replacement });
      }
      const actions = item.createDiv({ cls: "agenttools-actions" });
      this.createActionButton(actions, "Jump", () => void this.jumpToAnnotation(annotation));
      this.createActionButton(actions, "Edit", () => void this.editAnnotation(annotation));
      this.createActionButton(actions, "Remove", () => void this.removeAnnotation(annotation));
      if ((annotation.kind === "replacement" || annotation.kind === "deletion") && annotation.status === "open") {
        this.createActionButton(actions, "Apply", () => void this.applyAnnotation(annotation.id));
      }
    }
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

  private async editAnnotation(annotation: ReviewAnnotation): Promise<void> {
    if (!this.activeFile) {
      return;
    }

    const body = await promptForText(this.app, "Edit review comment", "Comment", annotation.body ?? "");
    if (body === null) {
      return;
    }

    this.activeRecord = await this.plugin.reviewStore.updateAnnotationBody(this.activeFile, annotation.id, body);
    await this.renderDetail();
  }

  private async removeAnnotation(annotation: ReviewAnnotation): Promise<void> {
    if (!this.activeFile) {
      return;
    }

    this.activeRecord = await this.plugin.reviewStore.removeAnnotation(this.activeFile, annotation.id);
    await this.renderDetail();
  }

  private async jumpToAnnotation(annotation: ReviewAnnotation): Promise<void> {
    if (!this.activeFile) {
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(this.activeFile);
    if (!(leaf.view instanceof MarkdownView) || typeof annotation.line !== "number") {
      return;
    }

    const editor = leaf.view.editor;
    const line = Math.max(0, annotation.line - 1);
    editor.setCursor({ line, ch: 0 });
    editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: annotation.quote.length } }, true);
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
