import { VirtualizedTableHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { tagColor } from "../utils/tagColor";
import {
  AddonInfo,
  AddonInfoManager,
  addonCanUpdate,
  addonReleaseInfo,
  displayAddonReleaseInfo,
  findNativeRelatedAddon,
  releaseMatchesInstalledAddon,
  relatedAddons,
} from "./addonInfo";
import { getActiveWindow, isWindowAlive } from "../utils/window";
import {
  Sources,
  currentSource,
  customSourceApi,
  setCurrentSource,
  setCustomSourceApi,
} from "../utils/configuration";
import { getPref, setPref } from "../utils/prefs";
import { AddonInfoDetail } from "./addonDetail";
import { HistoricalVersions } from "./historicalVersions";
import { Guide } from "./guide";
import {
  registerXPIDropInstaller,
  unregisterXPIDropInstaller,
} from "./xpiDropInstaller";
import {
  getXPIDatabase,
  getAddonManager,
  isZoteroVersionAtLeast,
} from "../utils/compat";
import type {
  TableMenuItemID,
  AssociatedAddonInfo,
  LocalAddon,
} from "../types";
import {
  TableSearchHandler,
  TableMenuHandler,
  TableColumnManager,
  TableActions,
  TableDataTransformer,
} from "../ui/table";

export class AddonTable {
  private static readonly recommendedRowClass = "is-recommended";

  private static registerLegacyToolsMenu() {
    const doc = Zotero.getMainWindow().document;
    const toolsPopup = doc.querySelector("#menu_ToolsPopup");
    if (!toolsPopup) {
      return;
    }

    this.unregisterLegacyToolsMenu();

    const separator = ztoolkit.createXULElement(
      doc,
      "menuseparator",
    ) as XULElement;
    separator.id = "addon-table-menuseparator";

    const menuitem = ztoolkit.createXULElement(doc, "menuitem") as XULElement;
    menuitem.id = "addon-table-entrance";
    menuitem.setAttribute("label", getString("menuitem-addons"));
    menuitem.setAttribute(
      "image",
      `chrome://${config.addonRef}/content/icons/favicon.svg`,
    );
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.addEventListener("command", () => {
      void this.showAddonsWindow();
    });

    toolsPopup.append(separator, menuitem);
  }

  private static unregisterLegacyToolsMenu() {
    const doc = Zotero.getMainWindow().document;
    doc.querySelector("#addon-table-menuseparator")?.remove();
    doc.querySelector("#addon-table-entrance")?.remove();
  }

  private static getNativeMenuManager() {
    return (
      Zotero as typeof Zotero & {
        MenuManager?: {
          registerMenu?: (options: unknown) => void;
          unregisterMenu?: (menuID: string) => void;
        };
      }
    ).MenuManager;
  }

  /**
   * Register entrance in menu tools
   */
  static registerInMenuTool() {
    const nativeMenuManager = this.getNativeMenuManager();
    if (nativeMenuManager?.registerMenu) {
      nativeMenuManager.registerMenu({
        menuID: "addon-table-entrance",
        pluginID: config.addonID,
        target: "main/menubar/tools",
        menus: [
          {
            menuType: "menuitem",
            icon: `chrome://${config.addonRef}/content/icons/favicon.svg`,
            onShowing: (_ev: Event, context: { menuElem: XULElement }) => {
              context.menuElem.setAttribute(
                "label",
                getString("menuitem-addons"),
              );
            },
            onCommand: () => {
              void this.showAddonsWindow();
            },
          },
        ],
      });
      return;
    }

    this.registerLegacyToolsMenu();
  }

  /**
   * Register or unregister entrance in toolbar
   */
  static registerInToolbar(win: Window = Zotero.getMainWindow()) {
    const toolbar = win.document.querySelector<XULElement>(
      "#zotero-items-toolbar",
    );
    if (!toolbar) return;
    // Keep registration idempotent: toggling this setting must never stack
    // multiple copies of the toolbar entrance.
    toolbar
      .querySelectorAll("#zotero-toolbaritem-addons")
      .forEach((element: Element) => element.remove());
    if (getPref("hideToolbarEntrance")) {
      return;
    }
    const lookupNode = toolbar.querySelector("#zotero-tb-lookup");
    if (!lookupNode) return;
    const newNode = lookupNode.cloneNode(true) as XULToolBarButtonElement;

    newNode.setAttribute("id", "zotero-toolbaritem-addons");
    newNode.setAttribute("tooltiptext", getString("menuitem-addons"));
    newNode.setAttribute("command", "");
    newNode.setAttribute("oncommand", "");
    newNode.setAttribute("mousedown", "");
    newNode.setAttribute("onmousedown", "");
    newNode.addEventListener("click", () => {
      void this.showAddonsWindow();
    });
    const searchNode = toolbar.querySelector("#zotero-tb-search");
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon.svg)`;
    toolbar.insertBefore(newNode, searchNode);
  }

  private static registerInAllToolbars() {
    for (const win of Zotero.getMainWindows()) {
      this.registerInToolbar(win);
    }
  }

  static unregisterAll() {
    for (const win of Zotero.getMainWindows()) {
      win.document.querySelector("#zotero-toolbaritem-addons")?.remove();
    }
    const nativeMenuManager = this.getNativeMenuManager();
    if (nativeMenuManager?.unregisterMenu) {
      nativeMenuManager.unregisterMenu("addon-table-entrance");
      return;
    }
    this.unregisterLegacyToolsMenu();
  }

  private static addonInfos: AssociatedAddonInfo[] = [];
  private static baseAddonInfos: AssociatedAddonInfo[] = [];
  private static currentTag: string | null = null;
  private static window: Window | null;
  private static tableHelper?: VirtualizedTableHelper;
  private static columnManager = new TableColumnManager();
  private static searchHandler?: TableSearchHandler;
  private static menuHandler?: TableMenuHandler;
  private static tagCellObserver?: MutationObserver;
  private static applyTagCellChips?: () => void;
  private static refreshAnimationId = 0;

  /**
   * Display addon table window
   */
  static async showAddonsWindow(): Promise<Window | undefined> {
    if (this.window && isWindowAlive(this.window)) {
      this.window.focus();
      this.refresh();
      return this.window;
    }
    this.resetWindowTransientState();
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
    win.addEventListener(
      "unload",
      () => {
        unregisterXPIDropInstaller(win);
        AddonInfoDetail.close();
        this.resetWindowTransientState();
      },
      { once: true },
    );
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
      this.currentTag = null;
    };
    await windowArgs._initPromise.promise;
    if (!isWindowAlive(win)) return;
    registerXPIDropInstaller(win);
    this.window = win;

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
    return win;
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
    if (!this.isShown()) {
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
    const isLatestRefresh = await this.actionWithRefreshAnimate(actions);
    if (!isLatestRefresh || !this.isShown()) {
      return;
    }
    await this.updateTable();
    try {
      selectAddons.forEach((oldAddon) => {
        const newIdx = this.addonInfos.findIndex(
          (newAddon) =>
            oldAddon[0].repo === newAddon[0].repo ||
            (displayAddonReleaseInfo(newAddon[0])?.release.id &&
              displayAddonReleaseInfo(newAddon[0])?.release.id ===
                displayAddonReleaseInfo(oldAddon[0])?.release.id),
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
    } catch (error) {
      ztoolkit.log(`failed to restore add-on selection: ${error}`);
    }
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
      window: getActiveWindow(),
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
      if (
        !releaseMatchesInstalledAddon(
          addon[0],
          addon[1],
          this.addonInfos.map(([addonInfo]) => addonInfo),
        )
      ) {
        ztoolkit.log(
          `skip updating ${addon[0].repo}: remote release ID does not match installed add-on ${addon[1].id}`,
        );
        continue;
      }
      const releaseInfo = addonReleaseInfo(addon[0]);
      progressWin.changeLine({
        text: `${releaseInfo?.name ?? addon[0].name} ${addon[1].version} => ${releaseInfo?.xpiVersion ?? "?"}`,
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
  private static resetWindowTransientState() {
    this.tagCellObserver?.disconnect();
    this.tagCellObserver = undefined;
    this.applyTagCellChips = undefined;
    this.refreshAnimationId += 1;
    this.refreshTag += 1;
    this.currentTag = null;
    this.addonInfos = [];
    this.baseAddonInfos = [];
    this.window = null;
    this.tableHelper = undefined;
    this.searchHandler = undefined;
    this.menuHandler = undefined;
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
        this.setupTagCellChips();
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
          height: "28px",
          minHeight: "28px",
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
      // Real-time filtering should be local and fast.
      // Only re-fetch addon list on explicit refresh / source change.
      if (this.baseAddonInfos.length === 0) {
        await this.updateAddonInfos(false);
      } else {
        this.applySearchAndSort();
      }
      await this.updateTable();
    });
    this.initRefreshButton(win);
    this.initAutoUpdate(win);
    this.initHideEntrance(win);
    this.initSettingsMenu(win);
  }

  private static initSettingsMenu(win: Window) {
    const root = win.document.getElementById("footer-settings");
    const button = win.document.getElementById(
      "footer-settings-button",
    ) as HTMLButtonElement | null;
    const popup = win.document.getElementById(
      "footer-settings-popup",
    ) as XULPopupElement | null;
    if (!root || !button || !popup) return;

    // Zotero 11 can render anchored popups through the macOS native menu
    // implementation. Native menus ignore per-item text colors used by the
    // tag filter, so keep this settings menu on the XUL renderer used by
    // Zotero 10 and older Zotero 11 versions.
    popup.setAttribute("nonnative", "true");

    const setOpenState = (open: boolean) => {
      root.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    const closeMenu = () => {
      if (popup.state !== "closed") {
        popup.hidePopup();
      }
    };
    const openMenu = () => {
      if (popup.state === "open" || popup.state === "showing") return;
      // Ask for the upper-left side; macOS may adjust the native menu to keep
      // it inside the available screen area.
      popup.openPopup(button, "before_start", 0, 0, false, false);
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (popup.state === "open" || popup.state === "showing") {
        closeMenu();
      } else if (popup.state === "closed") {
        openMenu();
      }
    });
    popup.addEventListener("popupshowing", () => {
      setOpenState(true);
      // `xul:menu` elements with a Fluent id are localized after insertion,
      // which removes any popup declared as a static child. Build the nested
      // popups only after the native menu has been rendered and opened.
      this.initTagFilter(win);
      this.initAddonScopeFilter(win);
      // Fluent localization may run after footer initialization, so refresh
      // the dynamic current value each time the native menu opens.
      this.syncAddonScopeFilterControl();
    });
    popup.addEventListener("popuphidden", () => setOpenState(false));
  }

  private static initTagFilter(win: Window) {
    const menu = win.document.getElementById(
      "footer-settings-tag-menu",
    ) as HTMLElement | null;
    if (!menu) return;
    menu.dataset.settingsLabel ||= getString("filterByTag");
    let popup = win.document.getElementById(
      "footer-settings-tag-popup",
    ) as XULPopupElement | null;
    if (!popup) {
      popup = win.document.createXULElement("menupopup") as XULPopupElement;
      popup.id = "footer-settings-tag-popup";
      popup.addEventListener("popupshowing", () => {
        this.updateTagMenuChecks(this.currentTag ?? "all");
      });
      menu.append(popup);
    }
    popup.setAttribute("nonnative", "true");
    this.refreshTagFilter();
  }

  private static initAddonScopeFilter(win: Window) {
    const menu = win.document.getElementById(
      "footer-settings-scope-menu",
    ) as HTMLElement | null;
    if (!menu) return;
    menu.hidden = false;
    menu.dataset.settingsLabel ||= getString("addonScope");
    let popup = win.document.getElementById(
      "footer-settings-scope-popup",
    ) as XULPopupElement | null;
    if (!popup) {
      popup = win.document.createXULElement("menupopup") as XULPopupElement;
      popup.id = "footer-settings-scope-popup";
      const createItem = (id: string, value: string, label: string) => {
        const item = win.document.createXULElement(
          "menuitem",
        ) as XULMenuItemElement;
        item.id = id;
        item.setAttribute("type", "radio");
        item.setAttribute("name", "footer-settings-addon-scope");
        item.setAttribute("value", value);
        item.setAttribute("label", label);
        return item;
      };
      const compatibleItem = createItem(
        "footer-settings-compatible-addons",
        "compatible",
        getString("showCompatibleAddons"),
      );
      const allItem = createItem(
        "footer-settings-all-addons",
        "all",
        getString("showAllAddons"),
      );
      compatibleItem.addEventListener("command", () => {
        this.setShowAllAddons(false);
      });
      allItem.addEventListener("command", () => {
        this.setShowAllAddons(true);
      });
      popup.append(compatibleItem, allItem);
      menu.append(popup);
    }
    popup.setAttribute("nonnative", "true");
    this.syncAddonScopeFilterControl();
  }

  private static setShowAllAddons(showAllAddons: boolean) {
    if ((getPref("showAllAddons") === true) === showAllAddons) {
      this.syncAddonScopeFilterControl();
      return;
    }
    setPref("showAllAddons", showAllAddons);
    this.syncAddonScopeFilterControl();
    void this.refresh(true);
  }

  private static syncAddonScopeFilterControl() {
    const win = this.window;
    if (!win) return;
    const showAllAddons = getPref("showAllAddons") === true;
    const menu = win.document.getElementById(
      "footer-settings-scope-menu",
    ) as HTMLElement | null;
    const popup = win.document.getElementById("footer-settings-scope-popup");
    const compatibleItem = popup?.querySelector('menuitem[value="compatible"]');
    const allItem = popup?.querySelector('menuitem[value="all"]');
    if (!menu || !compatibleItem || !allItem) return;
    this.setMenuItemChecked(compatibleItem, !showAllAddons);
    this.setMenuItemChecked(allItem, showAllAddons);
    const menuLabel = menu.dataset.settingsLabel ?? "";
    const currentValue = showAllAddons
      ? getString("showAllAddons")
      : getString("showCompatibleAddons");
    menu.setAttribute("label", `${menuLabel} ${currentValue}`.trim());
  }

  private static updateTagMenuChecks(value: string) {
    const popup = this.window?.document.getElementById(
      "footer-settings-tag-popup",
    );
    for (const item of Array.from(popup?.children ?? [])) {
      if (item.localName !== "menuitem") continue;
      this.setMenuItemChecked(item, item.getAttribute("value") === value);
    }
  }

  private static setMenuItemChecked(item: Element, checked: boolean) {
    // Native menu rendering on macOS follows the attribute, not the XUL
    // `checked` property, so keep the attribute as the source of truth.
    if (checked) {
      item.setAttribute("checked", "true");
    } else {
      item.removeAttribute("checked");
    }
  }

  private static setTagFilter(value: string) {
    this.currentTag = value === "all" ? null : value;
    this.updateTagMenuChecks(value);
    this.syncTagFilterControl();
    this.applySearchAndSort();
    void this.updateTable();
  }

  private static buildTagMenuItems() {
    const counts = this.getTagCounts();
    const buildItem = (value: string, label: string, style?: string) => {
      const isSelected = (this.currentTag ?? "all") === value;
      return {
        tag: "menuitem" as const,
        attributes: {
          label,
          value,
          crop: "end",
          type: "radio",
          name: "footer-settings-tag-filter",
          ...(isSelected ? { checked: "true" } : {}),
          ...(style ? { style } : {}),
        },
        listeners: [
          {
            type: "command",
            listener: () => this.setTagFilter(value),
          },
        ],
      };
    };
    return [
      buildItem(
        "all",
        `${getString("filter-all-tags")} (${this.baseAddonInfos.length})`,
      ),
      ...this.getAllTags().map((tag) =>
        buildItem(
          tag,
          `${TableDataTransformer.displayTagLabel(tag)} (${counts.get(tag) ?? 0})`,
          `color: ${tagColor(tag)}; font-weight: 500`,
        ),
      ),
    ];
  }

  private static refreshTagFilter() {
    const popup = this.window?.document.getElementById(
      "footer-settings-tag-popup",
    );
    const menu = this.window?.document.getElementById(
      "footer-settings-tag-menu",
    ) as HTMLElement | null;
    if (menu) {
      menu.dataset.settingsLabel ||= getString("filterByTag");
    }

    const allTags = this.getAllTags();
    // Reset currentTag if it no longer exists in the data
    if (this.currentTag && !allTags.includes(this.currentTag)) {
      this.currentTag = null;
    }

    if (!popup) {
      this.syncTagFilterControl();
      return;
    }

    while (popup.firstChild) popup.removeChild(popup.firstChild);
    for (const item of this.buildTagMenuItems()) {
      ztoolkit.UI.appendElement(item, popup);
    }
    this.updateTagMenuChecks(this.currentTag ?? "all");
    this.syncTagFilterControl();
  }

  private static syncTagFilterControl() {
    const control = this.window?.document.getElementById(
      "footer-settings-tag-menu",
    ) as XULElement | null;
    if (!control) return;
    const label =
      this.currentTag === null
        ? getString("filter-all-tags")
        : TableDataTransformer.displayTagLabel(this.currentTag);
    const menuLabel = control.dataset.settingsLabel ?? "";
    const currentValue = `${menuLabel} ${label}`.trim();
    control.setAttribute("label", currentValue);
    control.setAttribute("tooltiptext", label);
  }

  private static getTagCounts() {
    const counts = new Map<string, number>();
    for (const [addonInfo] of this.baseAddonInfos) {
      TableDataTransformer.displayTags(addonInfo).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    }
    return counts;
  }

  private static setupTagCellChips() {
    const container = this.window?.document.querySelector("#table-container");
    if (!container) return;

    this.tagCellObserver?.disconnect();
    const canInteractWithTagChips = isZoteroVersionAtLeast("8");

    const renderTagCell = (cell: HTMLElement) => {
      const inHeader =
        !!cell.closest(".virtualized-table-header") || !cell.closest(".row");
      if (inHeader) {
        cell.removeAttribute("data-tag-chip-rendered");
        cell.removeAttribute("data-tag-filter");
        return;
      }

      const hasChipWrapper = !!cell.querySelector(":scope > .tag-chip-list");
      const rawText = (
        hasChipWrapper ? cell.dataset.tagRaw : cell.textContent
      )?.trim();
      const currentFilter = this.currentTag ?? "";
      const row = cell.closest(".row");
      if (!rawText) {
        row?.classList.remove(this.recommendedRowClass);
        cell.removeAttribute("data-tag-chip-rendered");
        cell.removeAttribute("data-tag-raw");
        cell.removeAttribute("data-tag-filter");
        cell.replaceChildren();
        return;
      }

      if (
        cell.dataset.tagChipRendered === "true" &&
        cell.dataset.tagRaw === rawText &&
        cell.dataset.tagFilter === currentFilter
      ) {
        return;
      }

      const doc = cell.ownerDocument;
      if (!doc) return;
      const wrapper = doc.createElement("div");
      wrapper.className = "tag-chip-list";
      const tags = rawText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      row?.classList.toggle(
        this.recommendedRowClass,
        tags.includes(TableDataTransformer.recommendedTag),
      );

      for (const tag of tags) {
        const chip = doc.createElement("span");
        const color = tagColor(tag);
        chip.className = "tag-chip";
        if (tag === this.currentTag) {
          chip.classList.add("is-active");
        }
        chip.dataset.tagValue = tag;
        chip.textContent = TableDataTransformer.displayTagLabel(tag);
        chip.style.setProperty("--tag-chip-color", color);
        if (canInteractWithTagChips) {
          const stopRowSelection = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
          };
          chip.addEventListener("mousedown", stopRowSelection);
          chip.addEventListener("mouseup", stopRowSelection);
          chip.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            this.currentTag = this.currentTag === tag ? null : tag;
            this.syncTagFilterControl();
            this.applySearchAndSort();
            void this.updateTable();
          });
        } else {
          // Zotero 7's virtualized table swallows chip click events unreliably.
          // Keep the chip styling for readability, but treat tags as display-only.
          chip.classList.add("is-static");
        }
        wrapper.append(chip);
      }

      cell.dataset.tagRaw = rawText;
      cell.dataset.tagChipRendered = "true";
      cell.dataset.tagFilter = currentFilter;
      cell.setAttribute(
        "title",
        tags.map((tag) => TableDataTransformer.displayTagLabel(tag)).join(", "),
      );
      cell.replaceChildren(wrapper);
    };

    const applyChips = () => {
      container
        .querySelectorAll<HTMLElement>(".cell.menu-tags")
        .forEach((cell: HTMLElement) => {
          if (!cell.querySelector(":scope > .tag-chip-list")) {
            cell.dataset.tagRaw = cell.textContent?.trim() ?? "";
          }
          renderTagCell(cell);
        });
    };

    this.applyTagCellChips = applyChips;
    applyChips();
    const win = container.ownerDocument?.defaultView;
    if (!win) return;
    const observer = new win.MutationObserver(applyChips);
    this.tagCellObserver = observer;
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private static initRefreshButton(win: Window) {
    const refreshButton = win.document.querySelector(
      "#refresh",
    ) as HTMLButtonElement;
    refreshButton.addEventListener("click", async () => {
      if (refreshButton.disabled) {
        return;
      }
      await this.refresh(true);
    });
  }

  private static async actionWithRefreshAnimate(
    actions: Promise<void>[],
  ): Promise<boolean> {
    const refreshButton =
      this.window?.document.querySelector<HTMLButtonElement>("#refresh");
    const animationId = ++this.refreshAnimationId;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.setAttribute("status", "animate");
      refreshButton.setAttribute("aria-busy", "true");
    }
    try {
      await Promise.all(actions);
      return animationId === this.refreshAnimationId;
    } finally {
      if (animationId === this.refreshAnimationId && refreshButton) {
        refreshButton.removeAttribute("status");
        refreshButton.removeAttribute("aria-busy");
        refreshButton.disabled = false;
      }
    }
  }

  private static initAutoUpdate(win: Window) {
    const autoUpdateItem = win.document.querySelector(
      "#auto-update",
    ) as XULMenuItemElement | null;
    if (!autoUpdateItem) return;
    const syncChecked = () => {
      this.setMenuItemChecked(autoUpdateItem, getPref("autoUpdate"));
    };
    syncChecked();
    autoUpdateItem.addEventListener("command", () => {
      const selected = !getPref("autoUpdate");
      setPref("autoUpdate", selected);
      syncChecked();
      if (selected) {
        void this.updateExistAddons();
      }
    });
  }

  private static initHideEntrance(win: Window) {
    const hideToolbarItem = win.document.querySelector(
      "#hide-toolbar-entrance",
    ) as XULMenuItemElement | null;
    if (!hideToolbarItem) return;
    const syncChecked = () => {
      this.setMenuItemChecked(hideToolbarItem, getPref("hideToolbarEntrance"));
    };
    syncChecked();
    hideToolbarItem.addEventListener("command", () => {
      const selected = !getPref("hideToolbarEntrance");
      setPref("hideToolbarEntrance", selected);
      syncChecked();
      this.registerInAllToolbars();
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
      case "menu-history-versions":
        if (selectAddons.length !== 1) {
          break;
        }
        {
          const addonInfo = selectAddons[0][0];
          const name =
            displayAddonReleaseInfo(addonInfo)?.release.name ??
            addonInfo.name ??
            "";
          if (addonInfo.repo) {
            HistoricalVersions.showWindow(name, addonInfo.repo);
          }
        }
        break;
      case "menu-rollback-previous":
        if (selectAddons.length !== 1) {
          break;
        }
        await AddonInfoDetail.rollbackToPrevious(selectAddons[0][0]);
        break;
      case "menu-open-xpi-location":
        selectAddons.forEach(async (selectedAddon) => {
          const dbAddon = await getXPIDatabase().getAddon(
            (addon: any) =>
              addon.id ===
              displayAddonReleaseInfo(selectedAddon[0])?.release.id,
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

    try {
      const addonInfos = await TableDataTransformer.transformAddonInfos(force);
      if (curRefreshTag !== this.refreshTag) {
        return;
      }

      this.baseAddonInfos = addonInfos;
      this.refreshTagFilter();
      this.applySearchAndSort();
    } catch (error) {
      ztoolkit.log(`failed to update addon table: ${error}`);
    }
  }

  private static applySearchAndSort() {
    let addonInfos = this.baseAddonInfos;

    // Filter by tag (AND with search — tag narrows the pool first)
    if (this.currentTag) {
      const tag = this.currentTag;
      addonInfos = addonInfos.filter(([addonInfo]) =>
        TableDataTransformer.displayTags(addonInfo).includes(tag),
      );
    }

    // Filter by search text within the tag-narrowed pool
    if (this.searchHandler) {
      addonInfos = this.searchHandler.filterAddons(addonInfos);
    }

    // Sort by the selected column, using compatibility only as a tie-breaker.
    const sortColumn = this.columnManager.getSortColumn();
    addonInfos = TableDataTransformer.sortAddonInfos(addonInfos, sortColumn);
    this.addonInfos = addonInfos;
  }

  private static getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const [addonInfo] of this.baseAddonInfos) {
      TableDataTransformer.displayTags(addonInfo).forEach((tag) =>
        tagSet.add(tag),
      );
    }
    return [...tagSet].sort((left, right) => {
      if (left === TableDataTransformer.recommendedTag) {
        return -1;
      }
      if (right === TableDataTransformer.recommendedTag) {
        return 1;
      }
      return left.localeCompare(right);
    });
  }

  private static async updateTable() {
    const tableHelper = this.tableHelper;
    const win = this.window;
    if (!tableHelper || !win) {
      return;
    }

    try {
      tableHelper.render();
    } catch (error) {
      ztoolkit.log(`failed to render add-on table: ${error}`);
      return;
    }

    const applyChips = this.applyTagCellChips;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          applyChips?.();
        } catch (error) {
          ztoolkit.log(`failed to render add-on tags: ${error}`);
        } finally {
          resolve();
        }
      }, 0);
    });
  }

  private static async outdateAddons() {
    const catalog = this.addonInfos.map(([addonInfo]) => addonInfo);
    const localAddons = (await getAddonManager().getAllAddons()).filter(
      (addon) => addon.id,
    );
    const addons: [AddonInfo, LocalAddon][] = [];
    for (const addonInfo of catalog) {
      const addon = findNativeRelatedAddon(addonInfo, localAddons, catalog);
      if (addon) {
        addons.push([addonInfo, addon]);
      }
    }
    return addons.filter(
      ([addonInfo, addon]) =>
        addonCanUpdate(addonInfo, addon) &&
        releaseMatchesInstalledAddon(addonInfo, addon, catalog),
    );
  }
}
