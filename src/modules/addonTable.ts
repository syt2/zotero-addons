import { ColumnOptions, VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoManager, InstallStatus, addonCanUpdate, addonInstallStatus, addonReleaseInfo, addonReleaseTime, relatedAddons, xpiDownloadUrls } from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import { Sources, currentSource, customSourceApi, setCurrentSource, setCustomSourceApi } from "../utils/configuration";
import { installAddonFrom, undoUninstall, uninstall } from "../utils/utils";
import { LargePrefHelper } from "zotero-plugin-toolkit/dist/helpers/largePref";
import { getPref, setPref } from "../utils/prefs";
import { AddonInfoDetail } from "./addonDetail";
const { XPIDatabase } = ChromeUtils.import("resource://gre/modules/addons/XPIDatabase.jsm");
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

type TableMenuItemID =
  "menu-install" |
  "menu-update" |
  "menu-reinstall" |
  "menu-install-and-update" |
  "menu-enable" |
  "menu-disable" |
  "menu-uninstall" |
  "menu-remove" |
  "menu-uninstall-undo" |
  "menu-homepage" |
  "menu-refresh" |
  "menu-systemAddon" |
  "menu-updateAllIfNeed" |
  "menu-sep";

type TableColumnID =
  "menu-name" |
  "menu-desc" |
  "menu-star" |
  "menu-remote-update-time" |
  "menu-remote-version" |
  "menu-local-version" |
  "menu-install-state";

/**
 * AddonInfo with its table column value 
 */
type AssociatedAddonInfo = [AddonInfo, Partial<Record<TableColumnID, string>>];

export class AddonTable {
  /**
   * Register entrance in menu tools
   */
  static registerInMenuTool() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
    });
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      label: getString("menuitem-addons"),
      commandListener: (event) => {
        (async () => {
          await this.showAddonsWindow({from: "menu"});
        })();
      },
    });
    ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
    });
  }

  /**
   * Register or unregister entrance in toolbar
   */
  static registerInToolbar() {
    const toolbar = document.querySelector("#zotero-items-toolbar")!;
    if (getPref('hideToolbarEntrance')) {
      toolbar.querySelectorAll("#zotero-toolbaritem-addons").forEach(e => e.remove());
      return;
    }
    const lookupNode = toolbar.querySelector("#zotero-tb-lookup")!;
    const newNode = lookupNode?.cloneNode(true) as XUL.ToolBarButton;
    // const newNode = ztoolkit.UI.createXULElement(document, "toolbarbutton");
    newNode.setAttribute("id", "zotero-toolbaritem-addons");
    newNode.setAttribute("tooltiptext", getString("menuitem-addons"));
    newNode.setAttribute("command", "");
    newNode.setAttribute("oncommand", "");
    newNode.setAttribute("mousedown", "");
    newNode.setAttribute("onmousedown", "");
    newNode.addEventListener("click", async (event: any) => {
      this.showAddonsWindow({from: "toolbar"});
    });
    const searchNode = toolbar.querySelector("#zotero-tb-search");
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon.svg)`;
    toolbar.insertBefore(newNode, searchNode);
  }

  /**
   * Check for incompatible plugins when launching for the first time on a new Zotero version
   */
  static async checkUncompatibleAtFirstTime() {
    const key = 'checkUncompatibleAddonsIn' + (ztoolkit.isZotero7() ? "7" : "6");
    if (getPref(key)) { return; }
    const relateAddon = await relatedAddons(this.addonInfos.map(infos => infos[0]));
    setPref(key, true);
    const uncompatibleAddons = relateAddon.filter(e => e[1].appDisabled || !e[1].isCompatible || !e[1].isPlatformCompatible);
    if (uncompatibleAddons.length <= 0) {
      return;
    }
    const confirm = await Services.prompt.confirmEx(
      null,
      getString('update-all-uncompatible-title'),
      getString('update-all-uncompatible-message'),
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL,
      getString('update-all-uncompatible-confirm'),
      null,
      null,
      "",
      {}
    );
    if (confirm !== 0) {
      return;
    }
    await this.installAddons(uncompatibleAddons.map(e => e[0]), { popWin: true });
  }

  private static addonInfos: AssociatedAddonInfo[] = [];
  private static window?: Window;
  private static tableHelper?: VirtualizedTableHelper;

  /**
   * Display addon table window
   */
  static async showAddonsWindow(options?: { from?: "toolbar" | "menu" }) {
    if (isWindowAlive(this.window)) {
      options?.from && this.updateHideToolbarEntranceInWindow(options.from === "toolbar");
      this.window?.focus();
      this.refresh();
      return;
    }
    const windowArgs = { _initPromise: Zotero.Promise.defer() };
    const win = (window as any).openDialog(
      `chrome://${config.addonRef}/content/addons.xhtml`,
      `${config.addonRef}-addons`,
      `chrome,centerscreen,resizable,status,width=960,height=480,dialog=no`,
      windowArgs,
    );
    win.addEventListener('keypress', (e: KeyboardEvent) => {
      if (((Zotero.isMac && e.metaKey && !e.ctrlKey) || (!Zotero.isMac && e.ctrlKey)) && !e.altKey && e.key === 'w') {
        this.close();
        AddonInfoDetail.close();
      }
    });
    win.onclose = () => {
      AddonInfoDetail.close();
    }
    await windowArgs._initPromise.promise;
    this.window = win;
    options?.from && this.updateHideToolbarEntranceInWindow(options.from === "toolbar");

    await this.createTable();

    await this.replaceSourceSelectList(win.document.querySelector("#sourceContainerPlaceholder"));

    const refreshButton = win.document.querySelector("#refresh") as HTMLButtonElement;
    refreshButton.addEventListener("click", async e => {
      if (refreshButton.disabled) { return; }
      refreshButton.disabled = true;
      await this.refresh(true);
      refreshButton.disabled = false;
    });
    const autoUpdateCheckbox = win.document.querySelector('#auto-update');
    autoUpdateCheckbox.checked = getPref('autoUpdate');
    autoUpdateCheckbox?.addEventListener('command', (e: any) => {
      const selected = (e.target as XUL.Checkbox).checked;
      setPref('autoUpdate', selected);
      if (selected) {
        this.updateExistAddons();
      }
    });
    const hideToolbarCheckbox = win.document.querySelector('#hide-toolbar-entrance');
    hideToolbarCheckbox.checked = getPref('hideToolbarEntrance');
    hideToolbarCheckbox?.addEventListener('command', (e: any) => {
      const selected = (e.target as XUL.Checkbox).checked;
      setPref('hideToolbarEntrance', selected);
      this.registerInToolbar();
    });
    // win.open(); 
  }

  /**
   * Close addon table window
   */
  static async close() {
    this.window?.close();
  }

  /**
   * Check this window is shown
   * @returns bool
   */
  static isShown() {
    return isWindowAlive(this.window);
  }

  /**
   * Refresh this window
   * @param force force fetch AddonInfos from source
   */
  static async refresh(force = false) {
    if (!this.isShown) { return; }
    const selectIndics = this.tableHelper?.treeInstance.selection.selected;
    const selectAddons = this.addonInfos.filter((e, idx) => selectIndics?.has(idx));
    await this.updateAddonInfos(force);
    this.updateTable();
    selectAddons.forEach(oldAddon => {
      const newIdx = this.addonInfos.findIndex((newAddon) => oldAddon[0].repo === newAddon[0].repo || (addonReleaseInfo(newAddon[0])?.id && addonReleaseInfo(newAddon[0])?.id === addonReleaseInfo(oldAddon[0])?.id));
      if (newIdx >= 0) {
        this.tableHelper?.treeInstance.selection.rangedSelect(newIdx, newIdx, true, false);
      }
    });
  }

  /**
   * Update exist upgradable addons
   * @param options Additional options
   * @param options.filterAutoUpdatableAddons Filter only auto upgradable add-ons that specificed in AddonManager
   */
  static async updateExistAddons(options?: { filterAutoUpdatableAddons?: boolean }) {
    if (this.addonInfos.length <= 0) {
      await this.updateAddonInfos(false);
    }
    const addons = (await this.outdateAddons()).filter(e => {
      if (options?.filterAutoUpdatableAddons) {
        const systemUpdatable = AddonManager.updateEnabled;
        if (!systemUpdatable) { return false; }
        if (e[1]?.applyBackgroundUpdates == 2) { return true; } // on
        if (e[1]?.applyBackgroundUpdates == 0) { return false; } // off
        return AddonManager.autoUpdateDefault;
      } else {
        return true;
      }
    })
    if (addons.length <= 0) { return; }
    const progressWin = new ztoolkit.ProgressWindow(config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    }).createLine({
      type: "default",
      progress: 0,
    }).show(-1);
    let num = 0;
    for (const addon of addons) {
      progressWin.changeLine({
        text: `${addon[0].name} ${addon[1].version} => ${addon[0].releases[0].xpiVersion}`,
        progress: num++ / addons.length,
      });
      await this.installAddons([addon[0]]);
    }
    progressWin.changeLine({
      text: getString('update-succeed'),
      progress: 100,
      type: "success",
    });
    progressWin.startCloseTimer(3000);
  }

  private static updateHideToolbarEntranceInWindow(hide: boolean) {
    const hideToolbarCheckbox: any = this.window?.document.querySelector('#hide-toolbar-entrance');
    const autoUpdateCheckbox: any = this.window?.document.querySelector('#auto-update');
    hideToolbarCheckbox.hidden = hide;
    hide ? autoUpdateCheckbox.style.marginLeft = 'auto' : autoUpdateCheckbox.style.removeProperty('margin-left');
  }

  private static async tableMenuItems() {
    const result: [TableMenuItemID, string][] = [];
    const selects = this.tableHelper?.treeInstance.selection.selected;
    const append = (id: TableMenuItemID, selectCount?: number) => {
      let str = getString(id);
      if (selects && selects.size > 1 && selectCount) {
        str += ` [${selectCount} ${getString('menu-items-count')}]`;
      } 
      result.push([id, str]);
    };

    if (selects) {
      const selectedAddonSupportOps = await this.selectedAddonSupportOperations();
      const possibleTabID: TableMenuItemID[] = [
        "menu-install",
        "menu-reinstall",
        "menu-update",
        "menu-uninstall-undo",
        "menu-remove",
        "menu-uninstall",
        "menu-enable",
        "menu-disable",
      ];
      possibleTabID.forEach(e => selectedAddonSupportOps.has(e) && append(e, selectedAddonSupportOps.get(e)?.length));
      if (selects.size === 1) {
        append("menu-homepage");
      }
      append("menu-sep");
    }

    append("menu-refresh");
    append("menu-sep");

    if ((await this.outdateAddons()).length > 0) {
      append("menu-updateAllIfNeed");
      append("menu-sep");
    }

    append("menu-systemAddon");
    return result;
  }

  private static async createTable() {
    const win = this.window;
    if (!win) { return; }
    const columns = this.columns.slice().sort((a, b) => ((a as any).ordinal ?? 0) - ((b as any).ordinal ?? 0));
    let canStoreColumnPrefs = false;
    (async () => {
      // storeColumnPrefs 会在加载table时就运行，此时并不想保存起状态，因此先做个延迟解决下这个case
      await Zotero.Promise.delay(666);
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
      .setProp("getRowString", (index) => this.addonInfos[index][1]["menu-name"] || "")
      .setProp("onItemContextMenu", (ev, x, y) => {
        const replaceElem = win.document.querySelector("#listContainerPlaceholder") ?? win.document.querySelector("#listMenu");
        if (!replaceElem) { return false; }
        (async () => {
          await this.replaceRightClickMenu(replaceElem);
          await Zotero.Promise.delay(10);
          // found in ZoteroPane.onItemsContextMenuOpen
          if (Zotero.isWin) { x += 10; }
          (win.document.querySelector("#listMenu") as any).openPopupAtScreen(x + 1, y + 1, true);
        })();
        return true;
      })
      .setProp("onColumnSort", ev => {
        if (typeof ev !== 'number') { return; }
        const treeInstance = this.tableHelper?.treeInstance as any;
        if (ev < 0 || (ev >= (treeInstance._getColumns()?.length ?? 0))) { return; }
        const column = treeInstance?._getColumns()[ev];
        // columns that diabled sort
        if (["menu-desc", "menu-remote-version", "menu-local-version"].includes(column.dataKey)) {
          delete treeInstance?._columns?._columns[ev]?.sortDirection;
        }
        this.updateColumns();
        this.refresh(false);
      })
      .setProp("onColumnPickerMenu", ev => {
        const replaceElem = win.document.querySelector("#listContainerColumnMenuPlaceholder") ?? win.document.querySelector("#listColumnMenu");
        if (!replaceElem) { return false; }
        (async () => {
          await this.replaceColumnSelectMenu(replaceElem);
          await Zotero.Promise.delay(10);
          (win.document.querySelector("#listColumnMenu") as any).openPopupAtScreen(win.screenX + (ev as any).clientX + 2, win.screenY + (ev as any).clientY + 2, true);
        })();
        return true;
      })
      .setProp("storeColumnPrefs", ev => {
        if (!canStoreColumnPrefs) { return; }
        this.updateColumns();
      })
      .setProp("onActivate", ev => {
        const selectAddons: AddonInfo[] = [];
        for (const select of this.tableHelper?.treeInstance.selection.selected ?? new Set()) {
          if (select < 0 || select >= this.addonInfos.length) { continue; }
          selectAddons.push(this.addonInfos[select][0]);
        }
        selectAddons.forEach(addon => {
          AddonInfoDetail.showDetailWindow(addon);
        });
        return true;
      })
      .render(undefined, (_) => {
        this.refresh(AddonInfoManager.shared.addonInfos.length <= 0);
      });
  }

  private static async selectedAddonSupportOperations() {
    const selectedAddonOps = new Map<TableMenuItemID, AddonInfo[]>();
    const append = (key: TableMenuItemID, addonInfo: AddonInfo) => {
      const arr = selectedAddonOps.get(key) ?? [];
      arr.push(addonInfo);
      selectedAddonOps.set(key, arr);
    }
    const selects = this.tableHelper?.treeInstance.selection.selected;
    if (!selects) { return selectedAddonOps; }
    for (const idx of selects) {
      const addonInfo = this.addonInfos[idx];
      const relatedAddon = await relatedAddons([addonInfo[0]]);
      if (relatedAddon.length > 0) {
        if (relatedAddon[0][1].appDisabled) {
          append("menu-reinstall", addonInfo[0]);
        } else if (addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
          append("menu-update", addonInfo[0]);
        } else {
          append("menu-reinstall", addonInfo[0]);
        }
        const dbAddon = XPIDatabase.getAddons().filter((addon: any) => addon.id === relatedAddon[0][1].id);
        if (dbAddon.length > 0) {
          if (dbAddon[0].pendingUninstall) {
            append("menu-uninstall-undo", addonInfo[0]);
            append("menu-remove", addonInfo[0]);
          } else {
            append("menu-uninstall", addonInfo[0]);
          }
        }
        if (!relatedAddon[0][1].appDisabled && (dbAddon.length <= 0 || !dbAddon[0].pendingUninstall)) {
          if (relatedAddon[0][1].userDisabled) {
            append("menu-enable", addonInfo[0]);
          } else {
            append("menu-disable", addonInfo[0]);
          }
        }
      } else {
        append("menu-install", addonInfo[0]);
      }
    }
    return selectedAddonOps;
  }

  private static async replaceRightClickMenu(oldNode: Element) {
    ztoolkit.UI.replaceElement({
      tag: "menupopup",
      id: "listMenu",
      listeners: [{
        type: "command",
        listener: async (ev) => {
          const selectValue = (ev.target as any).getAttribute("value");
          await this.onSelectMenuItem(selectValue);
        },
      }],
      children: (await this.tableMenuItems()).map(item => {
        if (item[0] === "menu-sep") {
          return {
            tag: "menuseparator",
          }
        } else {
          return {
            tag: "menuitem",
            attributes: {
              label: item[1],
              value: item[0],
            },
          }
        }
      })
    }, oldNode);
  }

  private static async replaceSourceSelectList(oldNode: Element) {
    ztoolkit.UI.replaceElement({
      tag: "menulist",
      id: `sources`,
      attributes: {
        value: currentSource().id,
        native: "true",
      },
      styles: {
        cursor: "pointer",
      },
      listeners: [{
        type: "command",
        listener: ev => {
          const selectSource = (this.window?.document.querySelector("#sources") as XUL.MenuList).getAttribute("value");
          const oldSource = currentSource();
          setCurrentSource(selectSource ?? undefined);
          const newSource = currentSource();
          if (oldSource.id === newSource.id) { return; }
          const hideCustomInput = newSource.id !== "source-custom";
          (this.window?.document.querySelector("#customSource-container") as HTMLElement).hidden = hideCustomInput;
          this.refresh(true);
        },
      }],
      children: [{
        tag: "menupopup",
        children: Sources.map(source => ({
          tag: "menuitem",
          attributes: {
            label: getString(source.id),
            value: source.id,
          }
        }))
      },
      ]
    }, oldNode);

    (this.window?.document.querySelector("#customSource-container") as HTMLElement).hidden = currentSource().id !== "source-custom";
    (this.window?.document.querySelector("#customSourceInput") as HTMLInputElement).value = customSourceApi();
    (this.window?.document.querySelector("#customSourceInput") as HTMLInputElement).addEventListener("change", event => {
      setCustomSourceApi((event.target as HTMLInputElement).value);
      this.refresh(true);
    });
  }

  private static async replaceColumnSelectMenu(oldNode: Element) {
    const columns = this.columns.slice().sort((a, b) => ((a as any).ordinal ?? 0) - ((b as any).ordinal ?? 0));
    const allColumnSelectMenus = columns.filter(c => c.dataKey !== "menu-name").map(c => c.dataKey);
    ztoolkit.UI.replaceElement({
      tag: "menupopup",
      id: "listColumnMenu",
      listeners: [{
        type: "command",
        listener: async (ev) => {
          const selectValue = (ev.target as any).getAttribute("value");
          const idx = ((this.tableHelper?.treeInstance as any)._getColumns()).findIndex((c: any) => c.dataKey === selectValue);
          if (idx >= 0) {
            (this.tableHelper?.treeInstance as any)._columns.toggleHidden(idx);
          }
        },
      }],
      children: allColumnSelectMenus.map(menuItem => ({
        tag: "menuitem",
        attributes: {
          label: getString(menuItem),
          value: menuItem,
          checked: !((this.columns.find(column => column.dataKey === menuItem) as any)?.hidden),
          // disabled: this.columnSelectMenus.length <= 1 && this.columnSelectMenus.includes(menuItem),
        }
      }))
    }, oldNode);
  }

  private static async onSelectMenuItem(item: TableMenuItemID) {
    const selectAddons: AssociatedAddonInfo[] = [];
    for (const select of this.tableHelper?.treeInstance.selection.selected ?? new Set()) {
      if (select < 0 || select >= this.addonInfos.length) { continue; }
      selectAddons.push(this.addonInfos[select]);
    }
    const selectedAddonSupportOps = await this.selectedAddonSupportOperations();
    ztoolkit.log(selectedAddonSupportOps);
    switch (item) {
      case "menu-install":
      case "menu-reinstall":
      case "menu-update":
      case "menu-install-and-update":
        this.installAddons(selectedAddonSupportOps.get(item) ?? [], {popWin: true});
        break;
      case "menu-uninstall":
        this.uninstallAddons(selectedAddonSupportOps.get(item) ?? [], true);
        break;
      case "menu-remove":
        this.uninstallAddons(selectedAddonSupportOps.get(item) ?? [], false);
        break;
      case "menu-uninstall-undo":
        this.undoUninstallAddons(selectedAddonSupportOps.get(item) ?? []);
        break;
      case "menu-enable":
        this.enableAddons(selectedAddonSupportOps.get(item) ?? [], true);
        break;
      case "menu-disable":
        this.enableAddons(selectedAddonSupportOps.get(item) ?? [], false);
        break;
      case "menu-homepage":
        selectAddons.forEach(addon => {
          if (!addon[0].repo) { return; }
          Zotero.launchURL(`https://github.com/${addon[0].repo}`);
        });
        break;
      case "menu-refresh":
        this.refresh(true);
        break;
      case "menu-systemAddon":
        // see in https://github.com/zotero/zotero/blob/c27bac2ad629b2ff216462515c220e2d5ce148ba/chrome/content/zotero/zoteroPane.xhtml#L559
        (document.getElementById("menu_addons") as any).doCommand();
        break;
      case "menu-updateAllIfNeed":
        this.updateExistAddons();
        break;
    }
  }

  private static async enableAddons(addons: AddonInfo[], enable: boolean) {
    const relatedAddon = await relatedAddons(addons);
    for (const [addonInfo, addon] of relatedAddon) {
      enable ? await addon.enable() : await addon.disable();
    }
  }

  private static async uninstallAddons(addons: AddonInfo[], popConfirmDialog: boolean) {
    const relatedAddon = await relatedAddons(addons);
    for (const [addonInfo, addon] of relatedAddon) {
      await uninstall(addon, { popConfirmDialog: popConfirmDialog });
    }
  }

  private static async undoUninstallAddons(addons: AddonInfo[]) {
    const relatedAddon = await relatedAddons(addons);
    for (const [addonInfo, addon] of relatedAddon) {
      await undoUninstall(addon);
    }
  }

  private static async installAddons(addons: AddonInfo[], options?: {
    popWin?: boolean,
  }) {
    await Promise.all(addons.map(async addon => {
      const urls = xpiDownloadUrls(addon).filter(x => {
        return (x?.length ?? 0) > 0;
      }) as string[];
      await installAddonFrom(urls, { name: addon.name, popWin: options?.popWin });
    }));
  }

  private static refreshTag: number = 0;
  private static async updateAddonInfos(force = false) {
    this.refreshTag += 1;
    const curRefreshTag = this.refreshTag;
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    if (curRefreshTag !== this.refreshTag) { return; } // 不是本次刷新
    const relateAddons = await relatedAddons(addonInfos);
    this.addonInfos = await Promise.all(addonInfos.map(async addonInfo => {
      const result: Partial<Record<TableColumnID, string>> = {};
      result["menu-name"] = addonInfo.name;
      result["menu-desc"] = addonInfo.description ?? "";
      result['menu-star'] = addonInfo.star === 0 ? "0" : addonInfo.star ? String(addonInfo.star) : "?"
      result["menu-remote-version"] = addonReleaseInfo(addonInfo)?.xpiVersion?.toLowerCase().replace('v', '') ?? "";
      result["menu-local-version"] = "";
      const releaseTime = addonReleaseTime(addonInfo);
      if (releaseTime) {
        result["menu-remote-update-time"] = releaseTime;
      }
      const relateAddon = relateAddons.find(addonPair => { return addonInfo.repo === addonPair[0].repo; });
      result["menu-local-version"] = relateAddon?.[1].version ?? "";
      const installState = await addonInstallStatus(addonInfo, relateAddon);
      result["menu-install-state"] = this.installStatusDescription(installState);
      return [
        addonInfo,
        result,
      ]
    }));

    const stateMap: { [key: string]: number } = {};
    const installStates: InstallStatus[] = [
      InstallStatus.unknown,
      InstallStatus.notInstalled,
      InstallStatus.incompatible,
      InstallStatus.disabled,
      InstallStatus.pendingUninstall,
      InstallStatus.normal,
      InstallStatus.updatable,
    ];
    installStates.forEach((status, idx) => stateMap[this.installStatusDescription(status)] = idx);

    const sortColumn = this.columns.find(column => 'sortDirection' in column);
    if (sortColumn) {
      const sortOrder = (sortColumn as any).sortDirection;
      this.addonInfos = this.addonInfos.sort((infoA, infoB) => {
        const [a, b] = [infoA[0], infoB[0]];
        let l, r;
        switch (sortColumn.dataKey) {
          case "menu-name":
            [l, r] = [a.name.toLowerCase(), b.name.toLowerCase()];
            if (l == r) { break; }
            return l > r ? sortOrder : -sortOrder;
          case "menu-star":
            [l, r] = [a.star ?? 0, b.star ?? 0];
            if (l == r) { break; }
            return l > r ? sortOrder : -sortOrder;
          case "menu-install-state":
            [l, r] = [stateMap[infoA[1]['menu-install-state'] ?? this.installStatusDescription(InstallStatus.unknown)] ?? 0,
            stateMap[infoB[1]['menu-install-state'] ?? this.installStatusDescription(InstallStatus.unknown)] ?? 0];
            if (l === r) { break; }
            if (l === 0) { return -1; }
            if (r === 0) { return 1; }
            return l > r ? sortOrder : -sortOrder;
          case "menu-remote-update-time":
            [l, r] = [addonReleaseInfo(a)?.releaseDate ?? "", addonReleaseInfo(b)?.releaseDate ?? ""];
            if (l == r) { break; }
            return l > r ? sortOrder : -sortOrder;
        }
        return 0;
      });
    }
  }

  private static async updateTable() {
    return new Promise<void>((resolve) => {
      this.tableHelper?.render(undefined, (_) => {
        resolve();
      });
    });
  }

  private static async outdateAddons() {
    const addons = await relatedAddons(this.addonInfos.map(infos => infos[0]));
    return addons.filter(([addonInfo, addon]) => addonCanUpdate(addonInfo, addon));
  }

  private static installStatusDescription(status: InstallStatus) {
    switch (status) {
      case InstallStatus.unknown:
        return getString('state-unknown');
      case InstallStatus.notInstalled:
        return getString('state-notInstalled');
      case InstallStatus.normal:
        return getString('state-installed');
      case InstallStatus.updatable:
        return getString('state-outdate');
      case InstallStatus.disabled:
        return getString('state-disabled');
      case InstallStatus.incompatible:
        return getString('state-uncompatible');
      case InstallStatus.pendingUninstall:
        return getString('state-pendingUninstall');
    }
  }

  private static largePrefHelper = new LargePrefHelper("zotero.addons.ui", config.prefsPrefix, "parser");
  private static _columns: ColumnOptions[] = [];
  private static get columns(): ColumnOptions[] {
    if (this._columns.length > 0) { return this._columns; }
    const oriCol = [
      {
        dataKey: "menu-name",
        label: "menu-name",
        staticWidth: true,
        hidden: false,
      },
      {
        dataKey: "menu-desc",
        label: "menu-desc",
        fixedWidth: false,
        hidden: false,
      },
      {
        dataKey: "menu-star",
        label: "menu-star",
        staticWidth: true,
        width: 50,
        hidden: false,
      },
      {
        dataKey: "menu-remote-update-time",
        label: "menu-remote-update-time",
        staticWidth: true,
        width: 150,
        hidden: false,
      },
      {
        dataKey: "menu-remote-version",
        label: "menu-remote-version",
        staticWidth: true,
        width: 100,
        hidden: false,
      },
      {
        dataKey: "menu-local-version",
        label: "menu-local-version",
        staticWidth: true,
        width: 85,
        hidden: false,
      },
      {
        dataKey: "menu-install-state",
        label: "menu-install-state",
        staticWidth: true,
        width: 95,
        hidden: false,
      },
    ];
    this._columns = oriCol;
    try {
      const result = this.largePrefHelper.getValue("columns") as ColumnOptions[];
      if (result.length === this._columns.length) {
        this._columns = result;
      }
    } catch (error) {
      //
    }
    this._columns.map(column => Object.assign(column, { label: getString(column.dataKey) }));
    return this._columns;
  }
  private static updateColumns() {
    try {
      this._columns = (this.tableHelper?.treeInstance as any)?._getColumns() as ColumnOptions[];
      if (this._columns.length > 0) {
        this._columns = this._columns.map((column: any) => {
          const { ["className"]: removedClassNameAttr, ...newObjWithourClassName } = column;
          return newObjWithourClassName;
        });
        this.largePrefHelper.setValue("columns", this._columns);
      }
    } catch (error) {
      ztoolkit.log(`updateColumns failed: ${error}`);
    }
  }
}
