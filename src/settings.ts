import { App, PluginSettingTab, Setting } from "obsidian";
import type AgentToolsPlugin from "./main";
import type { AgentToolsSettings } from "./types";

export const DEFAULT_SETTINGS: AgentToolsSettings = {
  reviewRoots: [],
  sidecarRoot: ".agenttools/reviews",
  defaultExportMode: "agent_feedback",
  showRibbonIcon: true
};

export class AgentToolsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AgentToolsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("agenttools-settings");

    new Setting(containerEl)
      .setName("Review sidecar folder")
      .setDesc("Vault-relative folder for review state.")
      .addText((text) =>
        text
          .setPlaceholder(".agenttools/reviews")
          .setValue(this.plugin.settings.sidecarRoot)
          .onChange(async (value) => {
            this.plugin.settings.sidecarRoot = value.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS.sidecarRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default export mode")
      .setDesc("Choose whether review feedback is copied for an agent or appended to a note.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("agent_feedback", "Agent feedback")
          .addOption("append_to_note", "Append to note")
          .setValue(this.plugin.settings.defaultExportMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultExportMode = value as AgentToolsSettings["defaultExportMode"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Show a sidebar shortcut for the review dashboard.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
