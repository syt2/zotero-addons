import { ColumnOptions, VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoManager, addonReleaseInfo, relatedAddons, xpiDownloadUrls } from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import { Sources, currentSource, customSourceApi, setCurrentSource, setCustomSourceApi } from "../utils/configuration";
import { compareVersion, installAddonFrom, installAddonWithPopWindowFrom, undoUninstall, uninstall } from "../utils/utils";
import { addonIDMapManager } from "../utils/addonIDMapManager";
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
type AssociatedAddonInfo = [AddonInfo, { [key: string]: string }]

export class AddonTable {
  static registerInToolbar() {
    const node = document.querySelector("#zotero-tb-advanced-search")!;
    const newNode = node?.cloneNode(true) as XUL.ToolBarButton;
    newNode.setAttribute("id", "zotero-toolbaritem-addons");
    newNode.setAttribute("tooltiptext", getString("menuitem-addons"));
    newNode.setAttribute("command", "");
    newNode.setAttribute("oncommand", "");
    newNode.setAttribute("mousedown", "");
    newNode.addEventListener("click", async (event: any) => {
      this.showAddonsWindow();
    });
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon@${Zotero.isWin ? '0.25x' : '0.5x'}.png)`;
    document.querySelector("#zotero-items-toolbar")?.insertBefore(newNode, node?.nextElementSibling);
  }

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
    await this.installAddons(uncompatibleAddons.map(e => e[0]), { forceInstall: true });
  }

  private static addonInfos: AssociatedAddonInfo[] = [];
  private static window?: Window;
  private static tableHelper?: VirtualizedTableHelper;

  // display addon table window
  static async showAddonsWindow() {
    if (isWindowAlive(this.window)) {
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
    win.onclose = () => {
      AddonInfoDetail.close();
    }
    await windowArgs._initPromise.promise;
    this.window = win;

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
    // win.open(); 
  }

  static async close() {
    this.window?.close();
  }

  static isShown() {
    return isWindowAlive(this.window);
  }

  static async refresh(force = false) {
    if (!this.isShown) { return; }
    const selectIndics = this.tableHelper?.treeInstance.selection.selected;
    const selectAddons = this.addonInfos.filter((e, idx) => selectIndics?.has(idx));
    await this.updateAddonInfos(force);
    this.updateTable();
    selectAddons.forEach(oldAddon => {
      const newIdx = this.addonInfos.findIndex((newAddon) => oldAddon[0].id === newAddon[0].id || oldAddon[0].repo === newAddon[0].repo);
      if (newIdx >= 0) {
        this.tableHelper?.treeInstance.selection.rangedSelect(newIdx, newIdx, true, false);
      }
    });
  }

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
        text: `${addon[0].name} ${addon[1].version} => ${addon[0].releases[0].currentVersion}`,
        progress: num++ / addons.length,
      });
      await this.installAddons([addon[0]], { slience: true });
    }
    progressWin.changeLine({
      text: getString('update-succeed'),
      progress: 100,
      type: "success",
    });
    progressWin.startCloseTimer(3000);
  }

  private static async tableMenuItems() {
    const result: TableMenuItemID[] = [];
    const selects = this.tableHelper?.treeInstance.selection.selected;

    if (selects) {
      if (selects.size == 1) {
        const idx = [...selects][0];
        if (idx >= 0 && idx < this.addonInfos.length) {
          const addonInfo = this.addonInfos[idx];
          const relatedAddon = await relatedAddons([addonInfo[0]]);
          if (relatedAddon.length > 0) {
            if (relatedAddon[0][1].appDisabled) {
              result.push("menu-reinstall");
            } else if (this.addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
              result.push("menu-update");
            } else {
              result.push("menu-reinstall");
            }
            const dbAddon = XPIDatabase.getAddons().filter((addon: any) => addon.id === relatedAddon[0][1].id);
            if (dbAddon.length > 0) {
              if (dbAddon[0].pendingUninstall) {
                result.push("menu-uninstall-undo");
                result.push("menu-remove");
              } else {
                result.push("menu-uninstall");
              }
            }
            if (!relatedAddon[0][1].appDisabled && (dbAddon.length <= 0 || !dbAddon[0].pendingUninstall)) {
              if (relatedAddon[0][1].userDisabled) {
                result.push("menu-enable");
              } else {
                result.push("menu-disable");
              }
            }
          } else {
            result.push("menu-install");
          }
        }
        result.push("menu-homepage");
      } else {
        result.push("menu-install-and-update");
      }
      result.push("menu-sep");
    }

    result.push("menu-refresh");
    result.push("menu-sep");

    if ((await this.outdateAddons()).length > 0) {
      result.push("menu-updateAllIfNeed");
      result.push("menu-sep");
    }

    result.push("menu-systemAddon");
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
      .setProp("getRowString", (index) => this.addonInfos[index][1].name || "")
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
        if (ev < 0 || (ev >= treeInstance._getColumns()?.length ?? 0)) { return; }
        const column = treeInstance?._getColumns()[ev];
        // 不接受排序的column
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
        if (item === "menu-sep") {
          return {
            tag: "menuseparator",
          }
        } else {
          return {
            tag: "menuitem",
            attributes: {
              label: getString(item),
              value: item,
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
    switch (item) {
      case "menu-install":
      case "menu-reinstall":
      case "menu-update":
      case "menu-install-and-update":
        this.installAddons(selectAddons.map(e => e[0]), { forceInstall: true });
        break;
      case "menu-uninstall":
        this.uninstallAddons(selectAddons.map(e => e[0]), true);
        break;
      case "menu-remove":
        this.uninstallAddons(selectAddons.map(e => e[0]), false);
        break;
      case "menu-uninstall-undo":
        this.undoUninstallAddons(selectAddons.map(e => e[0]));
        break;
      case "menu-enable":
        this.enableAddons(selectAddons.map(e => e[0]), true);
        break;
      case "menu-disable":
        this.enableAddons(selectAddons.map(e => e[0]), false);
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
    forceInstall?: boolean,
    slience?: boolean,
  }) {
    await Promise.all(addons.map(async addon => {
      const urls = xpiDownloadUrls(addon).filter(x => {
        return (x?.length ?? 0) > 0;
      }) as string[];
      if (options?.slience) {
        await installAddonFrom(urls, addon.name, addon.repo, options.forceInstall)
      } else {
        await installAddonWithPopWindowFrom(urls, addon.name, addon.repo, options?.forceInstall);
      }
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
      const result: { [key: string]: string } = {};
      result["menu-name"] = addonInfo.name;
      result["menu-desc"] = addonInfo.description ?? "";
      result['menu-star'] = addonInfo.star === 0 ? "0" : addonInfo.star ? String(addonInfo.star) : "?"
      result["menu-remote-version"] = addonReleaseInfo(addonInfo)?.currentVersion?.toLowerCase().replace('v', '') ?? "";
      result["menu-local-version"] = "";
      result["menu-remote-update-time"] = addonReleaseInfo(addonInfo)?.releaseData ?? "";
      const inputDate = new Date(addonReleaseInfo(addonInfo)?.releaseData ?? "");
      if (inputDate) {
        const year = inputDate.getFullYear();
        const month = String(inputDate.getMonth() + 1).padStart(2, '0');
        const day = String(inputDate.getDate()).padStart(2, '0');
        const hours = String(inputDate.getHours()).padStart(2, '0');
        const minutes = String(inputDate.getMinutes()).padStart(2, '0');
        const seconds = String(inputDate.getSeconds()).padStart(2, '0');
        const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        result["menu-remote-update-time"] = formattedDate;
      }
      const relateAddon = relateAddons.find(addonPair => { return addonInfo.repo === addonPair[0].repo; });
      if (relateAddon) { /// 本地有该插件
        result["menu-local-version"] = relateAddon[1]?.version ?? "";
        if (relateAddon[1]) {
          const dbAddon = XPIDatabase.getAddons().filter((addon: any) => addon.id === relateAddon[1].id);
          if (dbAddon.length > 0 && dbAddon[0].pendingUninstall) { // 插件被删除
            result["menu-install-state"] = getString("state-pendingUninstall");
          } else { // 插件已安装
            if (relateAddon[1].appDisabled || !relateAddon[1].isCompatible || !relateAddon[1].isPlatformCompatible) {
              result["menu-install-state"] = getString('state-uncompatible');
            } else if (relateAddon[1].userDisabled) {
              result["menu-install-state"] = getString('state-disabled')
            } else if (this.addonCanUpdate(relateAddon[0], relateAddon[1])) {
              result["menu-install-state"] = getString("state-outdate");
            } else {
              result["menu-install-state"] = getString("state-installed");
            }
          }
        } else { // 插件不兼容当前zotero
          result["menu-install-state"] = getString('state-uncompatible');
        }
      } else { // 本地未找到该插件
        result["menu-install-state"] = (addonInfo.id || addonIDMapManager.shared.repoToAddonIDMap[addonInfo.repo]?.[0]) ? getString('state-notInstalled') : getString('state-unknown');
      }
      return [
        addonInfo,
        result,
      ]
    }));

    const stateMap: { [key: string]: number } = {};
    let idx = 0;
    stateMap[getString('state-unknown')] = idx++;
    stateMap[getString('state-notInstalled')] = idx++;
    stateMap[getString('state-uncompatible')] = idx++;
    stateMap[getString('state-disabled')] = idx++;
    stateMap[getString('state-pendingUninstall')] = idx++;
    stateMap[getString('state-installed')] = idx++;
    stateMap[getString('state-outdate')] = idx++;

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
            [l, r] = [stateMap[infoA[1]['menu-install-state']] ?? 0, stateMap[infoB[1]['menu-install-state']] ?? 0];
            if (l === r) { break; }
            if (l === 0) { return -1; }
            if (r === 0) { return 1; }
            return l > r ? sortOrder : -sortOrder;
          case "menu-remote-update-time":
            [l, r] = [addonReleaseInfo(a)?.releaseData ?? "", addonReleaseInfo(b)?.releaseData ?? ""];
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

  private static addonCanUpdate(addonInfo: AddonInfo, addon: any) {
    const version = addonReleaseInfo(addonInfo)?.currentVersion;
    if (!version || !addon.version) { return false; }
    return compareVersion(addon.version, version) < 0;
  }

  private static async outdateAddons() {
    const addons = await relatedAddons(this.addonInfos.map(infos => infos[0]));
    return addons.filter(([addonInfo, addon]) => this.addonCanUpdate(addonInfo, addon));
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
