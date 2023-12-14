import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoManager, z7XpiDownloadUrls } from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import { Sources, currentSource, customSourceApi, setCurrentSource, setCustomSourceApi } from "../utils/configuration";
import { compareVersion, currentInstalledXpis, installAddonWithPopWindowFrom, uninstall } from "../utils/utils";
import { addonIDMapManager } from "../utils/addonIDMapManager";
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

type TableMenuItemID = 
"menu-install" |
"menu-reinstall" |
"menu-update" |
"menu-install-and-update" |
"menu-uninstall" |
"menu-homepage" | 
"menu-refresh" | 
"menu-updateAllIfNeed" | 
"menu-sep";

type AssociatedAddonInfo = [AddonInfo, { [key: string]: string }]

// type TableColumnDataKey = "name" | "description" | "star" | "installState"
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
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon@32.png)`;
    document.querySelector("#zotero-items-toolbar")?.insertBefore(newNode, node?.nextElementSibling);
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
      `chrome,centerscreen,resizable,status,width=1080,height=520,dialog=no`,
      windowArgs,
    );
    await windowArgs._initPromise.promise;
    this.window = win;

    await this.createTable();

    await this.replaceSourceSelectList(win.document.querySelector("#sourceContainerPlaceholder"));

    (win.document.querySelector("#refresh") as HTMLButtonElement).addEventListener("click", e => this.refresh(true));
    (win.document.querySelector("#updateAllAddons") as HTMLButtonElement).addEventListener("click", event => {
      this.onSelectMenuItem("menu-updateAllIfNeed");
    });
    (win.document.querySelector("#gotoPage") as HTMLButtonElement).addEventListener("click", event => {
      this.onSelectMenuItem("menu-homepage");
    });
    (win.document.querySelector("#install") as HTMLButtonElement).addEventListener("click", event => {
      this.onSelectMenuItem("menu-install");
    });
    (win.document.querySelector("#uninstall") as HTMLButtonElement).addEventListener("click", event => {
      this.onSelectMenuItem("menu-uninstall");
    });
    await this.updateButtonsStatus();
    // win.open();
  }

  static async close() {
    this.window?.close();
  }

  private static sortOrder: ["name" | "star" | "installState", 1 | -1][] = [["star", 1], ["name", -1], ["installState", -1]];
  private static async createTable() {
    const win = this.window;
    if (!win) { return; }
    const columns = [
      {
        dataKey: "name",
        label: "name",
        staticWidth: true,
      },
      {
        dataKey: "description",
        label: "description",
        fixedWidth: false,
      },
      {
        dataKey: "star",
        label: "stars",
        staticWidth: true,
        width: 80,
      },
      {
        dataKey: "installState",
        label: "state",
        staticWidth: true,
        width: 150,
      },
    ].map(column => Object.assign(column, { label: getString(column.label) }));

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
      .setProp("onColumnSort", ev => {
        if (typeof ev === 'number') {
          const column = (this.tableHelper?.treeInstance as any)._getColumns()[ev];
          if (column.dataKey === "description") { return; }
          const idx = this.sortOrder.findIndex(v => v[0] === column.dataKey);
          const element = this.sortOrder.splice(idx, 1)[0]; // Remove the kth element
          this.sortOrder.unshift(element); // Add the element to the front
          this.sortOrder[0][1] = -this.sortOrder[0][1] as any;
        }
        this.refresh(false);
      })
      .setProp("onActivate", ev => {
        this.onSelectMenuItem("menu-homepage");
        return true;
      })
      .setProp("onSelectionChange", ev => { this.updateButtonsStatus(); })
      .render(undefined, (_) => {
        this.refresh();
      });
  }

  private static async updateButtonsStatus() {
    const menuItems = await this.tableMenuItems();
    (this.window?.document.querySelector("#updateAllAddons") as HTMLButtonElement).hidden = !(menuItems.includes("menu-updateAllIfNeed"));
    (this.window?.document.querySelector("#gotoPage") as HTMLButtonElement).hidden = !(menuItems.includes("menu-homepage"));
    (this.window?.document.querySelector("#install") as HTMLButtonElement).hidden = !(menuItems.includes("menu-install") || menuItems.includes("menu-reinstall") || menuItems.includes("menu-update") || menuItems.includes("menu-install-and-update"));
    (this.window?.document.querySelector("#uninstall") as HTMLButtonElement).hidden = !(menuItems.includes("menu-uninstall"));
  }

  private static async replaceSourceSelectList(oldNode: Element) {
    ztoolkit.UI.replaceElement({
      tag: "menulist",
      id: `sources`,
      attributes: {
        value: currentSource().id,
        native: "true",
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
        children: Sources.map((source: any) => ({
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
        this.installAddons(selectAddons.map(e => e[0]), true);
        break;
      case "menu-uninstall":
        this.uninstallAddons(selectAddons.map(e => e[0]))
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
      case "menu-updateAllIfNeed":
        this.updateExistAddons();
        break;
    }
  }


  private static async uninstallAddons(addons: AddonInfo[]) {
    const relatedAddon = await this.relatedAddons(addons);
    for (const [addonInfo, addon] of relatedAddon) {
      await uninstall(addon, true);
    }
    await this.refresh(false);
  }

  private static async installAddons(addons: AddonInfo[], forceInstall: boolean) {
    await Promise.all(addons.map(async addon => {
      const urls = z7XpiDownloadUrls(addon).filter(x => {
        return (x?.length ?? 0) > 0;
      }) as string[];
      await installAddonWithPopWindowFrom(urls, addon.name, addon.repo, forceInstall);
    }));
    await Zotero.Promise.delay(1000);
    await this.refresh(false);
  }

  private static async refresh(force = false) {
    await this.updateAddonInfos(force);
    this.updateTable();
  }

  private static async updateAddonInfos(force = false) {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    const relateAddons = await this.relatedAddons(addonInfos);
    this.addonInfos = await Promise.all(addonInfos.map(async addonInfo => {
      const result: { [key: string]: string } = {};
      result["name"] = addonInfo.name;
      result["description"] = addonInfo.description ?? "";
      result['star'] = addonInfo.star === 0 ? "0" : addonInfo.star ? String(addonInfo.star) : "?"
      const relateAddon = relateAddons.find(addonPair => { return addonInfo.repo === addonPair[0].repo; });
      if (relateAddon) { /// 本地有该插件
        if (relateAddon[1] && relateAddon[1].isCompatible && relateAddon[1].isPlatformCompatible) {
          if (this.addonCanUpdate(relateAddon[0], relateAddon[1])) {
            result["installState"] = getString("state-outdate");
          } else {
            result["installState"] = getString("state-installed");
          }
        } else { // 插件不兼容当前zotero
          result["installState"] = getString('state-uncompatible');
        }
      } else { // 本地未找到该插件
        result["installState"] = currentInstalledXpis.includes(addonInfo.repo) ? getString('state-restart') : (addonInfo.id || addonIDMapManager.shared.repoToAddonIDMap[addonInfo.repo]?.[0]) ? getString('state-notInstalled') : getString('state-unknown');
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
    stateMap[getString('state-pendingUninstall')] = idx++;
    stateMap[getString('state-restart')] = idx++;
    stateMap[getString('state-installed')] = idx++;
    stateMap[getString('state-outdate')] = idx++;

    this.addonInfos = this.addonInfos.sort((infoA, infoB) => {
      const [a, b] = [infoA[0], infoB[0]];
      for (const order of this.sortOrder) {
        switch (order[0]) {
          case "name":
            // eslint-disable-next-line no-case-declarations
            const [na, nb] = [a.name.toLowerCase(), b.name.toLowerCase()];
            if (na === nb) { break; }
            return na < nb ? order[1] : -order[1]
          case "star":
            // eslint-disable-next-line no-case-declarations
            const [sa, sb] = [a.star ?? 0, b.star ?? 0];
            if (sa === sb) { break; }
            return sa < sb ? order[1] : -order[1];
          case "installState":
            // eslint-disable-next-line no-case-declarations
            const [isa, isb] = [infoA[1]['installState'], infoB[1]['installState']];
            // eslint-disable-next-line no-case-declarations
            const [isav, isbv] = [stateMap[isa] ?? 0, stateMap[isb] ?? 0];
            if (isav === isbv) { break; }
            if (isbv === 0) { return -1; }
            if (isav === 0) { return 1; }
            return isav < isbv ? order[1] : -order[1];
        }
      }
      return 0;

    })
  }

  private static async updateTable() {
    return new Promise<void>((resolve) => {
      this.tableHelper?.render(undefined, (_) => {
        resolve();
      });
    });
  }

  private static addonCanUpdate(addonInfo: AddonInfo, addon: any) {
    const release = addonInfo.releases.find(release => release.targetZoteroVersion === (ztoolkit.isZotero7() ? "7" : "6"));
    if (!release || (release.xpiDownloadUrl?.github?.length ?? 0) == 0) { return false; }
    const version = release.currentVersion;
    if (!version || !addon.version) { return false; }
    return compareVersion(addon.version, version) < 0;
  }

  private static async relatedAddons(addonInfos: AddonInfo[]) {
    const addons: [AddonInfo, any][] = [];
    for (const addon of await AddonManager.getAllAddons()) {
      if (!addon.id) { continue; }
      const relateAddon = addonInfos.find(addonInfo => {
        if (addonInfo.id === addon.id) { return true; }
        if (addonInfo.name.length > 0 && addonInfo.name === addon.name) { return true; }
        if (addon.homepageURL && addon.homepageURL.includes(addonInfo.repo)) { return true; }
        if (addon.updateURL && addon.updateURL.includes(addonInfo.repo)) { return true; }
        if (addonIDMapManager.shared.repoToAddonIDMap[addonInfo.repo]?.[0] === addon.id) { return true; }
        return false;
      });
      if (relateAddon) {
        addons.push([relateAddon, addon]);
      }
    }
    return addons;
  }

  private static async outdateAddons() {
    const addons = await this.relatedAddons(this.addonInfos.map(infos => infos[0]));
    return addons.filter(([addonInfo, addon]) => this.addonCanUpdate(addonInfo, addon));
  }

  private static async updateExistAddons() {
    const addons = await this.outdateAddons();
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
      await this.installAddons([addon[0]], false);
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
          const relatedAddon = await this.relatedAddons([addonInfo[0]]);
          if (relatedAddon.length > 0) {
            if (this.addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
              result.push("menu-update");
            } else {
              result.push("menu-reinstall");
            }
            result.push("menu-uninstall");
          } else {
            result.push("menu-install");
          }
        }
        result.push("menu-homepage");
      } else if (selects.size > 1) {
        result.push("menu-install-and-update");
      }
      result.push("menu-sep");
    }

    result.push("menu-refresh");

    if ((await this.outdateAddons()).length > 0) {
      result.push("menu-sep");
      result.push("menu-updateAllIfNeed");
    }

    return result;
  }

}
