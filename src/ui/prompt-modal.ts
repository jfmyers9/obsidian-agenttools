import { App, Modal, Setting } from "obsidian";

export class PromptModal extends Modal {
  private value = "";
  private submitted = false;

  constructor(
    app: App,
    private readonly title: string,
    private readonly placeholder: string,
    private readonly resolve: (value: string | null) => void,
    private readonly initialValue = ""
  ) {
    super(app);
    this.value = initialValue;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });

    new Setting(contentEl).addTextArea((text) => {
      text
        .setPlaceholder(this.placeholder)
        .setValue(this.initialValue)
        .onChange((value) => {
          this.value = value;
        });
      text.inputEl.rows = 5;
      text.inputEl.focus();
    });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Cancel")
          .onClick(() => {
            this.close();
          })
      )
      .addButton((button) =>
        button
          .setCta()
          .setButtonText("Save")
          .onClick(() => {
            this.submitted = true;
            this.resolve(this.value.trim());
            this.close();
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) {
      this.resolve(null);
    }
  }
}

export function promptForText(app: App, title: string, placeholder: string, initialValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    new PromptModal(app, title, placeholder, resolve, initialValue).open();
  });
}
