import { VirtualizedTableHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  fetchHistoricalReleases,
  historicalReleaseDownloadUrls,
  isVersionCompatible,
  HistoricalRelease,
} from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import { installAddonFrom } from "../services";

interface HistoricalVersionRowData {
  version: string;
  tag: string;
  releaseDate: string;
  compatibility: string;
  isCompatible: boolean;
  minVersion: string;
  maxVersion: string;
}

export class HistoricalVersions {
  private static window: Window | null;
  private static tableHelper?: VirtualizedTableHelper;
  private static releases: HistoricalRelease[] = [];
  private static rowData: HistoricalVersionRowData[] = [];
  private static addonName: string = "";
  private static repo: string = "";

  /**
   * Show historical versions window
   */
  static async showWindow(addonName: string, repo: string) {
    if (this.window && isWindowAlive(this.window)) {
      this.window.focus();
      return;
    }

    this.addonName = addonName;
    this.repo = repo;

    let resolveInit: () => void;
    const _initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    const windowArgs = {
      _initPromise: {
        promise: _initPromise,
        resolve: resolveInit!,
      },
    };

    const win = Zotero.getMainWindow().openDialog(
      `chrome://${config.addonRef}/content/historicalVersions.xhtml`,
      `${config.addonRef}-historicalVersions`,
      `chrome,centerscreen,resizable,status,width=600,height=400,dialog=no`,
      windowArgs,
    );

    if (!win) {
      return;
    }

    win.addEventListener("keypress", (e: KeyboardEvent) => {
      if (
        ((Zotero.isMac && e.metaKey && !e.ctrlKey) ||
          (!Zotero.isMac && e.ctrlKey)) &&
        !e.altKey &&
        e.key === "w"
      ) {
        this.close();
      }
      if (e.key === "Escape") {
        this.close();
      }
    });

    await windowArgs._initPromise.promise;
    this.window = win;

    // Set window title
    const title = win.document.querySelector("title");
    if (title) {
      title.textContent = `${getString("history-version-title")} - ${addonName}`;
    }

    // Bind close button
    const closeButton = win.document.querySelector("#close-button");
    closeButton?.addEventListener("click", () => this.close());

    await this.createTable();
    await this.loadReleases();
  }

  /**
   * Close window
   */
  static close() {
    this.window?.close();
    this.window = null;
  }

  /**
   * Create virtualized table
   */
  private static async createTable() {
    const win = this.window;
    if (!win) return;

    const columns = [
      {
        dataKey: "version",
        label: getString("column-version"),
        width: 120,
      },
      {
        dataKey: "releaseDate",
        label: getString("column-release-date"),
        width: 150,
      },
      {
        dataKey: "compatibility",
        label: getString("column-compatibility"),
        width: 200,
      },
    ];

    this.tableHelper = new ztoolkit.VirtualizedTable(win)
      .setContainerId("table-container")
      .setProp({
        id: "historical-versions-header",
        columns: columns,
        showHeader: true,
        multiSelect: false,
        staticColumns: true,
        disableFontSizeScaling: false,
        linesPerRow: 1.4,
      })
      .setProp("getRowCount", () => this.rowData.length)
      .setProp("getRowData", (index) => this.rowData[index] as any)
      .setProp("getRowString", (index) => this.rowData[index]?.version || "")
      .setProp("onItemContextMenu", (_ev, x, y) => {
        const selectedIndices = this.tableHelper?.treeInstance.selection.selected;
        if (!selectedIndices || selectedIndices.size === 0) {
          return false;
        }

        const replaceElem =
          win.document.querySelector("#listContainerPlaceholder") ??
          win.document.querySelector("#listMenu");
        if (!replaceElem) {
          return false;
        }

        (async () => {
          await this.replaceRightClickMenu(replaceElem);
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (Zotero.isWin) {
            x += 10;
          }
          (win.document.querySelector("#listMenu") as any).openPopupAtScreen(
            x + 1,
            y + 1,
            true,
          );
        })();
        return true;
      })
      .render();
  }

  /**
   * Load historical releases
   */
  private static async loadReleases() {
    this.releases = await fetchHistoricalReleases(this.repo);
    this.rowData = this.releases.map((release) => {
      const date = new Date(release.published_at);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const isCompatible = isVersionCompatible(
        release.min_zotero_version,
        release.max_zotero_version,
      );

      let compatibilityText: string;
      if (!release.min_zotero_version || !release.max_zotero_version) {
        compatibilityText = getString("compatibility-unknown");
      } else if (isCompatible) {
        compatibilityText = getString("compatibility-compatible", {
          args: {
            minVersion: release.min_zotero_version,
            maxVersion: release.max_zotero_version,
          },
        });
      } else {
        compatibilityText = getString("compatibility-incompatible", {
          args: {
            minVersion: release.min_zotero_version,
            maxVersion: release.max_zotero_version,
          },
        });
      }

      return {
        version: release.addon_version || release.tag,
        tag: release.tag,
        releaseDate: dateStr,
        compatibility: compatibilityText,
        isCompatible,
        minVersion: release.min_zotero_version || "",
        maxVersion: release.max_zotero_version || "",
      };
    });

    this.tableHelper?.render();
  }

  /**
   * Create right-click context menu
   */
  private static async replaceRightClickMenu(oldNode: Element) {
    const selectedIndex = Array.from(
      this.tableHelper?.treeInstance.selection.selected ?? new Set<number>(),
    )[0] as number;
    const selectedRelease = this.releases[selectedIndex];

    if (!selectedRelease) return;

    const menuItems = [
      {
        tag: "menuitem",
        id: "menu-install-version",
        attributes: {
          label: getString("menu-install-version"),
        },
        listeners: [
          {
            type: "command",
            listener: () => this.installSelectedVersion(),
          },
        ],
      },
      {
        tag: "menuseparator",
      },
      {
        tag: "menuitem",
        id: "menu-goto-release",
        attributes: {
          label: getString("menu-goto-release"),
        },
        listeners: [
          {
            type: "command",
            listener: () => this.gotoReleasePage(),
          },
        ],
      },
    ];

    ztoolkit.UI.replaceElement(
      {
        tag: "menupopup",
        id: "listMenu",
        children: menuItems,
      },
      oldNode,
    );
  }

  /**
   * Install selected version
   */
  private static async installSelectedVersion() {
    const selectedIndex = Array.from(
      this.tableHelper?.treeInstance.selection.selected ?? new Set<number>(),
    )[0] as number;
    const selectedRelease = this.releases[selectedIndex];

    if (!selectedRelease) return;

    const urls = historicalReleaseDownloadUrls(selectedRelease);
    await installAddonFrom(urls, {
      name: selectedRelease.addon_name ?? this.addonName,
      popWin: true,
    });
  }

  /**
   * Go to GitHub release page
   */
  private static gotoReleasePage() {
    const selectedIndex = Array.from(
      this.tableHelper?.treeInstance.selection.selected ?? new Set<number>(),
    )[0] as number;
    const selectedRelease = this.releases[selectedIndex];

    if (!selectedRelease || !this.repo) return;

    const releaseUrl = `https://github.com/${this.repo}/releases/tag/${selectedRelease.tag}`;
    Zotero.launchURL(releaseUrl);
  }
}
