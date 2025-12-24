/**
 * Table search handler
 * Handles search input and filtering
 */

import Fuse from "fuse.js";
import type { AssociatedAddonInfo } from "../../types";

export class TableSearchHandler {
  private window: Window;

  constructor(window: Window) {
    this.window = window;
  }

  /**
   * Initialize search input
   */
  initSearch(onSearch: () => void): void {
    const searchButton = this.window.document.querySelector(
      "#search-button",
    ) as HTMLElement;
    const searchField = this.window.document.querySelector(
      "#search-field",
    ) as HTMLInputElement;

    searchField.style.visibility = "hidden";
    searchField.addEventListener("blur", () => this.hideSearch());
    searchButton.addEventListener("click", () => {
      if (!searchField.classList.contains("visible")) {
        searchButton.style.display = "none";
        const maxWidth = searchField.getAttribute("data-expanded-width");
        if (maxWidth) {
          searchField.style.maxWidth = `${maxWidth}px`;
        }
        searchField.style.visibility = "visible";
        searchField.classList.add("visible", "expanding");
        setTimeout(() => {
          searchField.removeAttribute("disabled");
          searchField.classList.remove("expanding");
          searchField.focus();
        }, 250);
        return;
      }
      searchField.focus();
    });
    searchField.addEventListener("command", onSearch);
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
    if (
      !searchField.value.length &&
      searchField.classList.contains("visible")
    ) {
      searchField.classList.remove("visible");
      searchField.setAttribute("disabled", "true");
      setTimeout(() => {
        searchButton.style.display = "";
        searchField.style.visibility = "hidden";
        searchField.style.removeProperty("max-width");
      }, 50);
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

    const fuse = new Fuse(addonInfos, {
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
    });
    const result = fuse.search(searchText);
    return result.map((e) => e.item);
  }
}
