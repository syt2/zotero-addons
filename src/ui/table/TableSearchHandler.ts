/**
 * Table search handler
 * Handles search input and filtering
 */

import Fuse from "fuse.js";
import type { AssociatedAddonInfo } from "../../types";

const fuseOptions: ConstructorParameters<typeof Fuse<AssociatedAddonInfo>>[1] =
  {
    keys: [
      {
        name: "addonInfoName",
        weight: 0.3,
        getFn: (e) => e[0].name || "",
      },
      {
        name: "addonName",
        weight: 0.3,
        getFn: (e) => e[1]["menu-name"] || "",
      },
      {
        name: "addonInfoDescription",
        weight: 0.2,
        getFn: (e) => e[0].description || "",
      },
      {
        name: "addonDescription",
        weight: 0.2,
        getFn: (e) => e[1]["menu-desc"] || "",
      },
    ],
    includeScore: true,
    threshold: 0.3,
    ignoreLocation: true,
    shouldSort: true,
    isCaseSensitive: false,
  };

export class TableSearchHandler {
  private window: Window;
  private debounceTimer?: number;
  private fuse?: Fuse<AssociatedAddonInfo>;
  private fuseSource?: AssociatedAddonInfo[];

  constructor(window: Window) {
    this.window = window;
  }

  /**
   * Initialize search input
   */
  initSearch(onSearch: () => void | Promise<void>): void {
    const searchButton = this.window.document.querySelector(
      "#search-button",
    ) as HTMLElement;
    const searchField = this.window.document.querySelector(
      "#search-field",
    ) as HTMLInputElement;
    const searchShell = this.window.document.querySelector(
      "#search-shell",
    ) as HTMLElement;
    searchField.addEventListener("blur", () => this.hideSearch());
    const runSearch = () => {
      try {
        void Promise.resolve(onSearch()).catch((error: unknown) => {
          ztoolkit.log(`failed to search add-ons: ${error}`);
        });
      } catch (error) {
        ztoolkit.log(`failed to search add-ons: ${error}`);
      }
    };
    searchButton.addEventListener("mousedown", (event) => {
      if (searchShell.classList.contains("expanded")) {
        event.preventDefault();
        searchField.focus();
      }
    });
    searchButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!searchShell.classList.contains("expanded")) {
        searchShell.classList.add("expanded");
        searchButton.setAttribute("aria-expanded", "true");
        searchField.removeAttribute("disabled");
        // Let the button finish its native focus handling before focusing input.
        this.window.setTimeout(() => {
          if (searchShell.classList.contains("expanded")) {
            searchField.focus();
          }
        }, 0);
        return;
      }
      searchField.focus();
    });

    const triggerSearchDebounced = (delayMs = 120) => {
      if (this.debounceTimer) {
        this.window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = this.window.setTimeout(() => {
        runSearch();
      }, delayMs);
    };

    // "command" usually fires on Enter/confirm in XUL inputs
    searchField.addEventListener("command", runSearch);
    // Real-time search while typing
    searchField.addEventListener("input", () => triggerSearchDebounced());
    searchField.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.isComposing || event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (searchField.value) {
        searchField.value = "";
        runSearch();
      }
      searchField.blur();
      searchButton.focus();
    });
  }

  /**
   * Hide search input
   */
  hideSearch(): void {
    const searchField = this.window.document.getElementById(
      "search-field",
    ) as HTMLInputElement;
    const searchButton = this.window.document.getElementById(
      "search-button",
    ) as HTMLElement;
    const searchShell = this.window.document.getElementById(
      "search-shell",
    ) as HTMLElement;
    if (
      !searchField.value.length &&
      searchShell.classList.contains("expanded")
    ) {
      searchShell.classList.remove("expanded");
      searchButton.setAttribute("aria-expanded", "false");
      searchField.setAttribute("disabled", "true");
      if (this.debounceTimer) {
        this.window.clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
      }
    }
  }

  /**
   * Get current search text
   */
  getSearchText(): string {
    const searchInput = this.window.document.querySelector(
      "#search-field",
    ) as HTMLInputElement;
    return searchInput?.value.toLowerCase().trim() ?? "";
  }

  /**
   * Filter addons by search text
   */
  filterAddons(addonInfos: AssociatedAddonInfo[]): AssociatedAddonInfo[] {
    const searchText = this.getSearchText();
    if (searchText.length === 0) {
      return addonInfos;
    }

    // Rebuild index only when the backing list reference changes (e.g. refresh),
    // not on every keystroke — same pattern as `fuse.search(query)` on one index.
    if (!this.fuse || this.fuseSource !== addonInfos) {
      this.fuse = new Fuse(addonInfos, fuseOptions);
      this.fuseSource = addonInfos;
    }
    const result = this.fuse.search(searchText);
    return result.map((e) => e.item);
  }
}
