import { VirtualizedTableHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  AddonInfo,
  AddonInfoManager,
  addonCanUpdate,
  addonReleaseInfo,
  relatedAddons,
} from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import {
  Sources,
  currentSource,
  customSourceApi,
  setCurrentSource,
  setCustomSourceApi,
} from "../utils/configuration";
import { getPref, setPref } from "../utils/prefs";
import { AddonInfoDetail } from "./addonDetail";
import { Guide } from "./guide";
import { getXPIDatabase, getAddonManager } from "../utils/compat";
import type { TableMenuItemID, AssociatedAddonInfo } from "../types";
import {
  TableSearchHandler,
  TableMenuHandler,
  TableColumnManager,
  TableActions,
  TableDataTransformer,
} from "../ui/table";

export class AddonTable {
  /**
   * Register entrance in menu tools
   */
  static registerInMenuTool() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
      id: "addon-table-menuseparator",
    });
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      id: "addon-table-entrance",
      label: getString("menuitem-addons"),
      icon: `chrome://${config.addonRef}/content/icons/favicon.svg`,
      commandListener: () => {
        (async () => {
          await this.showAddonsWindow({ from: "menu" });
        })();
      },
    });
  }

  /**
   * Register or unregister entrance in toolbar
   */
  static registerInToolbar() {
    const toolbar = Zotero.getMainWindow().document.querySelector(
      "#zotero-items-toolbar",
    )!;
    if (getPref("hideToolbarEntrance")) {
      toolbar
        .querySelectorAll("#zotero-toolbaritem-addons")
        .forEach((e: Element) => e.remove());
      return;
    }
    const lookupNode = toolbar.querySelector("#zotero-tb-lookup")!;
    const newNode = lookupNode?.cloneNode(true) as XULToolBarButtonElement;

    newNode.setAttribute("id", "zotero-toolbaritem-addons");
    newNode.setAttribute("tooltiptext", getString("menuitem-addons"));
    newNode.setAttribute("command", "");
    newNode.setAttribute("oncommand", "");
    newNode.setAttribute("mousedown", "");
    newNode.setAttribute("onmousedown", "");
    newNode.addEventListener("click", async () => {
      this.showAddonsWindow({ from: "toolbar" });
    });
    const searchNode = toolbar.querySelector("#zotero-tb-search");
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon.svg)`;
    toolbar.insertBefore(newNode, searchNode);
  }

  static unregisterAll() {
    Zotero.getMainWindow()
      .document.querySelector("#zotero-toolbaritem-addons")
      ?.remove();
    ztoolkit.Menu.unregister("addon-table-menuseparator");
    ztoolkit.Menu.unregister("addon-table-entrance");
  }

  private static addonInfos: AssociatedAddonInfo[] = [];
  private static window: Window | null;
  private static tableHelper?: VirtualizedTableHelper;
  private static columnManager = new TableColumnManager();
  private static searchHandler?: TableSearchHandler;
  private static menuHandler?: TableMenuHandler;

  /**
   * Display addon table window
   */
  static async showAddonsWindow(options?: { from?: "toolbar" | "menu" }) {
    if (this.window && isWindowAlive(this.window)) {
      if (options?.from) {
        this.updateHideToolbarEntranceInWindow(options.from === "toolbar");
      }
      this.window.focus();
      this.refresh();
      return;
    }
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
      `chrome://${config.addonRef}/content/addons.xhtml`,
      `${config.addonRef}-addons`,
      `chrome,centerscreen,resizable,status,width=960,height=480,dialog=no`,
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
        AddonInfoDetail.close();
      }
    });
    win.onclose = () => {
      AddonInfoDetail.close();
    };
    await windowArgs._initPromise.promise;
    this.window = win;
    if (options?.from) {
      this.updateHideToolbarEntranceInWindow(options.from === "toolbar");
    }

    // Initialize handlers
    this.searchHandler = new TableSearchHandler(win);
    this.menuHandler = new TableMenuHandler(win, {
      getSelectedIndices: () =>
        this.tableHelper?.treeInstance.selection.selected,
      getAddonInfos: () => this.addonInfos,
      getOutdateAddons: () => this.outdateAddons(),
    });

    await this.createTable();
    await this.replaceSourceSelectList(
      win.document.querySelector("#sourceContainerPlaceholder")!,
    );
    await this.initFooterContainer(win);

    setTimeout(() => {
      if (this.addonInfos.length > 0 || !this.window) {
        return;
      }
      Guide.showGuideInAddonTableIfNeed(this.window);
    }, 2000);
  }

  /**
   * Close addon table window
   */
  static async close() {
    this.window?.close();
  }

  /**
   * Check this window is shown
   */
  static isShown() {
    return this.window && isWindowAlive(this.window);
  }

  /**
   * Refresh this window
   */
  static async refresh(force = false) {
    if (!this.isShown) {
      return;
    }
    const selectIndices = this.tableHelper?.treeInstance.selection.selected;
    const selectAddons = this.addonInfos.filter((_, idx) =>
      selectIndices?.has(idx),
    );
    const actions: Promise<void>[] = [this.updateAddonInfos(force)];
    if (force) {
      actions.push(new Promise((resolve) => setTimeout(resolve, 1000)));
    }
    await this.actionWithRefreshAnimate(actions);
    this.updateTable();
    selectAddons.forEach((oldAddon) => {
      const newIdx = this.addonInfos.findIndex(
        (newAddon) =>
          oldAddon[0].repo === newAddon[0].repo ||
          (addonReleaseInfo(newAddon[0])?.id &&
            addonReleaseInfo(newAddon[0])?.id ===
              addonReleaseInfo(oldAddon[0])?.id),
      );
      if (newIdx >= 0) {
        this.tableHelper?.treeInstance.selection.rangedSelect(
          newIdx,
          newIdx,
          true,
          false,
        );
      }
    });
  }

  /**
   * Update exist upgradable addons
   */
  static async updateExistAddons(options?: {
    filterAutoUpdatableAddons?: boolean;
  }) {
    if (this.addonInfos.length <= 0) {
      await this.updateAddonInfos(false);
    }
    const addons = (await this.outdateAddons()).filter((e) => {
      if (options?.filterAutoUpdatableAddons) {
        const systemUpdatable = getAddonManager().updateEnabled;
        if (!systemUpdatable) {
          return false;
        }
        if (e[1]?.applyBackgroundUpdates == 2) {
          return true;
        }
        if (e[1]?.applyBackgroundUpdates == 0) {
          return false;
        }
        return getAddonManager().autoUpdateDefault;
      } else {
        return true;
      }
    });
    if (addons.length <= 0) {
      return;
    }
    const progressWin = new ztoolkit.ProgressWindow(getString("addon-name"), {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        type: "default",
        progress: 0,
      })
      .show(-1);
    let num = 0;
    for (const addon of addons) {
      progressWin.changeLine({
        text: `${addonReleaseInfo(addon[0])?.name ?? addon[0].name} ${addon[1].version} => ${addon[0].releases?.[0].xpiVersion}`,
        progress: (num++ / addons.length) * 100,
      });
      await TableActions.installAddons([addon[0]]);
    }
    progressWin.changeLine({
      text: getString("update-succeed"),
      progress: 100,
      type: "success",
    });
    progressWin.startCloseTimer(3000);
  }

  // MARK: private
  private static updateHideToolbarEntranceInWindow(hide: boolean) {
    const hideToolbarCheckbox = this.window?.document.querySelector(
      "#hide-toolbar-entrance",
    ) as HTMLElement;
    const autoUpdateCheckbox = this.window?.document.querySelector(
      "#auto-update",
    ) as HTMLElement;
    hideToolbarCheckbox.hidden = hide;
    if (hide) {
      autoUpdateCheckbox.style.marginLeft = "auto";
    } else {
      autoUpdateCheckbox.style.removeProperty("margin-left");
    }
  }

  private static async createTable() {
    const win = this.window;
    if (!win) {
      return;
    }
    const columns = this.columnManager.getSortedColumns();
    let canStoreColumnPrefs = false;
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 666));
      canStoreColumnPrefs = true;
    })();
    this.tableHelper = new ztoolkit.VirtualizedTable(win)
      .setContainerId(`table-container`)
      .setProp({
        id: `header`,
        columns: columns,
        showHeader: true,
        multiSelect: true,
        staticColumns: false,
        disableFontSizeScaling: false,
        linesPerRow: 1.6,
      })
      .setProp("getRowCount", () => this.addonInfos.length)
      .setProp("getRowData", (index) => this.addonInfos[index][1])
      .setProp(
        "getRowString",
        (index) => this.addonInfos[index][1]["menu-name"] || "",
      )
      .setProp("onItemContextMenu", (ev, x, y) => {
        const replaceElem =
          win.document.querySelector("#listContainerPlaceholder") ??
          win.document.querySelector("#listMenu");
        if (!replaceElem) {
          return false;
        }
        (async () => {
          await this.menuHandler?.replaceRightClickMenu(replaceElem, (item) =>
            this.onSelectMenuItem(item),
          );
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
      .setProp("onColumnSort", (ev) => {
        if (typeof ev !== "number") {
          return;
        }
        const treeInstance = this.tableHelper?.treeInstance as any;
        if (ev < 0 || ev >= (treeInstance._getColumns()?.length ?? 0)) {
          return;
        }
        this.columnManager.clearSortDirection(ev, treeInstance);
        this.columnManager.updateColumns(treeInstance);
        this.refresh(false);
      })
      .setProp("onColumnPickerMenu", (ev) => {
        const replaceElem =
          win.document.querySelector("#listContainerColumnMenuPlaceholder") ??
          win.document.querySelector("#listColumnMenu");
        if (!replaceElem) {
          return false;
        }
        (async () => {
          this.columnManager.replaceColumnSelectMenu(
            replaceElem,
            this.tableHelper?.treeInstance,
          );
          await new Promise((resolve) => setTimeout(resolve, 10));
          (
            win.document.querySelector("#listColumnMenu") as any
          ).openPopupAtScreen(
            win.screenX + (ev as any).clientX + 2,
            win.screenY + (ev as any).clientY + 2,
            true,
          );
        })();
        return true;
      })
      .setProp("storeColumnPrefs", () => {
        if (!canStoreColumnPrefs) {
          return;
        }
        this.columnManager.updateColumns(this.tableHelper?.treeInstance);
      })
      .setProp("onActivate", () => {
        const selectAddons: AddonInfo[] = [];
        for (const select of this.tableHelper?.treeInstance.selection
          .selected ?? new Set()) {
          if (select < 0 || select >= this.addonInfos.length) {
            continue;
          }
          selectAddons.push(this.addonInfos[select][0]);
        }
        selectAddons.forEach((addon) => {
          AddonInfoDetail.showDetailWindow(addon);
        });
        return true;
      })
      .render(undefined, () => {
        this.refresh(AddonInfoManager.shared.addonInfos.length <= 0);
        this.setupCellTooltips();
      });
  }

  /**
   * Setup tooltip for cells (especially description column)
   * Uses mouseover event to dynamically set title attribute
   */
  private static setupCellTooltips() {
    const container = this.window?.document.querySelector("#table-container");
    if (!container) return;

    container.addEventListener("mouseover", (event: Event) => {
      const target = event.target as HTMLElement;
      // Check if hovering over a cell with text content
      if (target.classList.contains("cell") && target.textContent) {
        // Set title attribute for tooltip
        target.setAttribute("title", target.textContent);
      }
    });
  }

  private static async replaceSourceSelectList(oldNode: Element) {
    ztoolkit.UI.replaceElement(
      {
        tag: "menulist",
        id: `sources`,
        attributes: {
          value: currentSource().id,
          native: "true",
        },
        styles: {
          cursor: "pointer",
        },
        listeners: [
          {
            type: "command",
            listener: () => {
              const selectSource = (
                this.window?.document.querySelector(
                  "#sources",
                ) as XULMenuListElement
              ).getAttribute("value");
              const oldSource = currentSource();
              setCurrentSource(selectSource ?? undefined);
              const newSource = currentSource();
              if (oldSource.id === newSource.id) {
                return;
              }
              const hideCustomInput = newSource.id !== "source-custom";
              (
                this.window?.document.querySelector(
                  "#customSource-container",
                ) as HTMLElement
              ).hidden = hideCustomInput;
              this.refresh(true);
            },
          },
        ],
        children: [
          {
            tag: "menupopup",
            children: Sources.map((source) => ({
              tag: "menuitem",
              attributes: {
                label: getString(source.id),
                value: source.id,
              },
            })),
          },
        ],
      },
      oldNode,
    );

    (
      this.window?.document.querySelector(
        "#customSource-container",
      ) as HTMLElement
    ).hidden = currentSource().id !== "source-custom";
    (
      this.window?.document.querySelector(
        "#customSourceInput",
      ) as HTMLInputElement
    ).value = customSourceApi();
    (
      this.window?.document.querySelector(
        "#customSourceInput",
      ) as HTMLInputElement
    ).addEventListener("change", (event) => {
      setCustomSourceApi((event.target as HTMLInputElement).value);
      this.refresh(true);
    });
  }

  private static async initFooterContainer(win: Window) {
    this.searchHandler?.initSearch(async () => {
      await this.updateAddonInfos();
      this.updateTable();
    });
    this.initRefreshButton(win);
    this.initAutoUpdate(win);
    this.initHideEntrance(win);
  }

  private static initRefreshButton(win: Window) {
    const refreshButton = win.document.querySelector(
      "#refresh",
    ) as XULToolBarButtonElement;
    refreshButton.addEventListener("click", async () => {
      if (refreshButton.disabled) {
        return;
      }
      await this.refresh(true);
    });
  }

  private static async actionWithRefreshAnimate(actions: Promise<void>[]) {
    const refreshButton =
      this.window?.document.querySelector<XULToolBarButtonElement>("#refresh");
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.setAttribute("status", "animate");
    }
    await Promise.all(actions);
    if (refreshButton) {
      refreshButton.removeAttribute("status");
      refreshButton.disabled = false;
    }
  }

  private static initAutoUpdate(win: Window) {
    const autoUpdateCheckbox = win.document.querySelector(
      "#auto-update",
    )! as XULCheckboxElement;
    autoUpdateCheckbox.checked = getPref("autoUpdate");
    autoUpdateCheckbox?.addEventListener("command", (e: any) => {
      const selected = (e.target as XULCheckboxElement).checked;
      setPref("autoUpdate", selected);
      if (selected) {
        this.updateExistAddons();
      }
    });
  }

  private static initHideEntrance(win: Window) {
    const hideToolbarCheckbox = win.document.querySelector(
      "#hide-toolbar-entrance",
    ) as XULCheckboxElement;
    hideToolbarCheckbox.checked = getPref("hideToolbarEntrance");
    hideToolbarCheckbox?.addEventListener("command", (e: any) => {
      const selected = (e.target as XULCheckboxElement).checked;
      setPref("hideToolbarEntrance", selected);
      this.registerInToolbar();
    });
  }

  private static async onSelectMenuItem(item: TableMenuItemID) {
    const selectAddons: AssociatedAddonInfo[] = [];
    for (const select of this.tableHelper?.treeInstance.selection.selected ??
      new Set()) {
      if (select < 0 || select >= this.addonInfos.length) {
        continue;
      }
      selectAddons.push(this.addonInfos[select]);
    }
    const selectedAddonSupportOps =
      await this.menuHandler?.getSelectedAddonSupportOperations();

    switch (item) {
      case "menu-install":
      case "menu-reinstall":
      case "menu-update":
      case "menu-install-and-update":
        TableActions.installAddons(selectedAddonSupportOps?.get(item) ?? [], {
          popWin: true,
        });
        break;
      case "menu-uninstall":
        TableActions.uninstallAddons(
          selectedAddonSupportOps?.get(item) ?? [],
          true,
        );
        break;
      case "menu-remove":
        TableActions.uninstallAddons(
          selectedAddonSupportOps?.get(item) ?? [],
          false,
        );
        break;
      case "menu-uninstall-undo":
        TableActions.undoUninstallAddons(
          selectedAddonSupportOps?.get(item) ?? [],
        );
        break;
      case "menu-enable":
        TableActions.enableAddons(
          selectedAddonSupportOps?.get(item) ?? [],
          true,
        );
        break;
      case "menu-disable":
        TableActions.enableAddons(
          selectedAddonSupportOps?.get(item) ?? [],
          false,
        );
        break;
      case "menu-homepage":
        selectAddons.forEach((addon) => {
          if (!addon[0].repo) {
            return;
          }
          Zotero.launchURL(`https://github.com/${addon[0].repo}`);
        });
        break;
      case "menu-open-xpi-location":
        selectAddons.forEach(async (selectedAddon) => {
          const dbAddon = await getXPIDatabase().getAddon(
            (addon: any) => addon.id === addonReleaseInfo(selectedAddon[0])?.id,
          );
          if (!dbAddon || !dbAddon.path) {
            return;
          }
          const file = Zotero.File.pathToFile(dbAddon.path);
          try {
            file.reveal();
          } catch {
            Zotero.launchFile(file.parent as any);
          }
        });
        break;
      case "menu-refresh":
        this.refresh(true);
        break;
      case "menu-systemAddon":
        (
          Zotero.getMainWindow().document.getElementById("menu_addons") as any
        ).doCommand();
        break;
      case "menu-updateAllIfNeed":
        this.updateExistAddons();
        break;
    }
  }

  private static refreshTag = 0;
  private static async updateAddonInfos(force = false) {
    this.refreshTag += 1;
    const curRefreshTag = this.refreshTag;

    let addonInfos = await TableDataTransformer.transformAddonInfos(force);
    if (curRefreshTag !== this.refreshTag) {
      return;
    }

    // Filter by search
    if (this.searchHandler) {
      addonInfos = this.searchHandler.filterAddons(addonInfos);
    }

    // Sort
    const sortColumn = this.columnManager.getSortColumn();
    addonInfos = TableDataTransformer.sortAddonInfos(addonInfos, sortColumn);

    this.addonInfos = addonInfos;
  }

  private static async updateTable() {
    return new Promise<void>((resolve) => {
      this.tableHelper?.render(undefined, () => {
        resolve();
      });
    });
  }

  private static async outdateAddons() {
    const addons = await relatedAddons(
      this.addonInfos.map((infos) => infos[0]),
    );
    return addons.filter(([addonInfo, addon]) =>
      addonCanUpdate(addonInfo, addon),
    );
  }
}
