/**
 * Detail button handler
 * Handles button click events with loading state management
 */

export interface ButtonConfig {
  selector: string;
  action: () => Promise<void>;
}

export class DetailButtonHandler {
  private window: Window;

  constructor(window: Window) {
    this.window = window;
  }

  /**
   * Bind click handler to a button with loading state management
   */
  bindButton(selector: string, action: () => Promise<void>): void {
    const button = this.window.document.querySelector(
      selector,
    ) as HTMLButtonElement | null;
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      try {
        await action();
      } finally {
        button.disabled = false;
      }
    });
  }

  /**
   * Bind multiple buttons at once
   */
  bindButtons(configs: ButtonConfig[]): void {
    configs.forEach((config) => {
      this.bindButton(config.selector, config.action);
    });
  }

  /**
   * Bind click handler to an element that opens a URL
   */
  bindLinkElement(selector: string, getUrl: () => string | undefined): void {
    const element = this.window.document.querySelector(selector);
    if (!element) {
      return;
    }
    element.addEventListener("click", () => {
      const url = getUrl();
      if (url) {
        Zotero.launchURL(url);
      }
    });
  }
}
