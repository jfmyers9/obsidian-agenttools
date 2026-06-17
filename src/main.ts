import { Notice, Plugin, TFile } from "obsidian";
import { ReviewIndexService } from "./review-index";
import { ReviewStore } from "./review-store";
import { AgentToolsSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { AgentToolsSettings } from "./types";
import { REVIEW_VIEW_TYPE, ReviewView } from "./views/review-view";
import { formatReviewFeedback } from "./export-feedback";

export default class AgentToolsPlugin extends Plugin {
  settings: AgentToolsSettings = { ...DEFAULT_SETTINGS };
  reviewStore!: ReviewStore;
  reviewIndex!: ReviewIndexService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.reviewStore = new ReviewStore(this.app.vault, () => this.settings);
    this.reviewIndex = new ReviewIndexService(this.app.vault, this.reviewStore, () => this.settings);

    this.registerView(REVIEW_VIEW_TYPE, (leaf) => new ReviewView(leaf, this));
    this.addSettingTab(new AgentToolsSettingTab(this.app, this));

    if (this.settings.showRibbonIcon) {
      this.addRibbonIcon("list-checks", "Open AI review dashboard", () => {
        void this.openReviewDashboard();
      });
    }

    this.addCommand({
      id: "open-ai-review-dashboard",
      name: "Open AI review dashboard",
      callback: () => {
        void this.openReviewDashboard();
      }
    });

    this.addCommand({
      id: "review-current-document",
      name: "Review current document",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.openReviewDashboard(file.path);
        }
        return true;
      }
    });

    this.addCommand({
      id: "approve-current-document",
      name: "Approve current document",
      checkCallback: (checking) => this.withActiveMarkdownFile(checking, async (file) => {
        await this.reviewStore.setDecision(file, "approved");
        await this.openReviewDashboard(file.path);
        new Notice("Document approved.");
      })
    });

    this.addCommand({
      id: "request-changes-current-document",
      name: "Request changes for current document",
      checkCallback: (checking) => this.withActiveMarkdownFile(checking, async (file) => {
        await this.reviewStore.setDecision(file, "changes_requested");
        await this.openReviewDashboard(file.path);
        new Notice("Changes requested.");
      })
    });

    this.addCommand({
      id: "export-review-feedback",
      name: "Export review feedback",
      checkCallback: (checking) => this.withActiveMarkdownFile(checking, async (file) => {
        const record = await this.reviewStore.loadRecord(file);
        await navigator.clipboard.writeText(formatReviewFeedback([record]));
        new Notice("Review feedback copied.");
      })
    });

    this.addCommand({
      id: "apply-selected-review-suggestion",
      name: "Apply selected review suggestion",
      checkCallback: (checking) => {
        const view = this.getActiveReviewView();
        if (!view) {
          return false;
        }
        if (!checking) {
          void view.applyFirstOpenSuggestion();
        }
        return true;
      }
    });

    this.registerEvent(this.app.vault.on("create", () => void this.refreshReviewViews()));
    this.registerEvent(this.app.vault.on("modify", () => void this.refreshReviewViews()));
    this.registerEvent(this.app.vault.on("delete", () => void this.refreshReviewViews()));
  }

  onunload(): void {
    // Obsidian disposes registered commands and views automatically.
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openReviewDashboard(sourcePath?: string): Promise<void> {
    const leaf = await this.getOrCreateReviewLeaf();
    const view = leaf.view;

    if (view instanceof ReviewView && sourcePath) {
      const file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (file instanceof TFile) {
        await view.openFile(file);
      } else {
        new Notice("Current file is not reviewable.");
      }
    }
  }

  async refreshReviewViews(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof ReviewView) {
        await view.refresh();
      }
    }
  }

  private async getOrCreateReviewLeaf() {
    const existing = this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return existing;
    }

    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: REVIEW_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    return leaf;
  }

  private getActiveReviewView(): ReviewView | null {
    const activeView = this.app.workspace.activeLeaf?.view;
    if (activeView instanceof ReviewView) {
      return activeView;
    }

    for (const leaf of this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)) {
      if (leaf.view instanceof ReviewView) {
        return leaf.view;
      }
    }

    return null;
  }

  private withActiveMarkdownFile(checking: boolean, callback: (file: TFile) => Promise<void>): boolean {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return false;
    }

    if (!checking) {
      void callback(file);
    }

    return true;
  }
}
