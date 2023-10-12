import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoManager, z7XpiDownloadUrls } from "./addonInfo";
import { isWindowAlive } from "../utils/window";
import { Sources, currentSource, customSourceApi, setCurrentSource, setCustomSourceApi } from "../utils/configuration";
import { compareVersion, installAddonFrom } from "../utils/utils";
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
declare const ZoteroStandalone: any;

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
    newNode.style.listStyleImage = `url(chrome://${config.addonRef}/content/icons/favicon.png)`;
    document.querySelector("#zotero-items-toolbar")?.insertBefore(newNode, node?.nextElementSibling);
  }

  private static addonInfos: [AddonInfo[], { [key: string]: string }[]] = [
    [],
    [],
  ];
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
    )!;
    await windowArgs._initPromise.promise;
    this.window = win;
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
        width: 50,
      },
      {
        dataKey: "isInstalled",
        label: "state",
        staticWidth: true,
        width: 80,
      },
    ].map(column => Object.assign(column, { label: getString(column.label) }));

    this.tableHelper = new ztoolkit.VirtualizedTable(win!)
      .setContainerId(`table-container`)
      .setProp({
        id: `header`,
        columns: columns,
        showHeader: true,
        multiSelect: true,
        staticColumns: true,
        disableFontSizeScaling: false,
      })
      .setProp("getRowCount", () => this.addonInfos[1].length)
      .setProp("getRowData", (index) => this.addonInfos[1][index])
      .setProp("getRowString", (index) => this.addonInfos[1][index].name || "")
      .setProp("onSelectionChange", (selection) => {
        const selectAddons: AddonInfo[] = [];
        for (const select of selection.selected) {
          if (select < 0 || select >= this.addonInfos[1].length) {
            return;
          }
          selectAddons.push(this.addonInfos[0][select]);
        }
        this.updateButtons(selectAddons);
      })
      .render(undefined, (_) => {
        this.refresh();
      });

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
          const selectSource = (win.document.querySelector("#sources") as XUL.MenuList).getAttribute("value");
          const oldSource = currentSource();
          setCurrentSource(selectSource ?? undefined);
          const newSource = currentSource();
          if (oldSource.id === newSource.id) { return; }
          const hideCustomInput = newSource.id !== "source-custom";
          (win.document.querySelector("#customSource-container") as HTMLElement).hidden = hideCustomInput;
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
    }, win.document.querySelector("#sourceContainerPlaceholder"));

    (win.document.querySelector("#manageAddons") as HTMLButtonElement).addEventListener("click", event => {
      Zotero.openInViewer('chrome://mozapps/content/extensions/aboutaddons.html', doc => ZoteroStandalone.updateAddonsPane);
    });
    (win.document.querySelector("#updateAllAddons") as HTMLButtonElement).hidden = (await this.outdateAddons()).length <= 0;
    (win.document.querySelector("#updateAllAddons") as HTMLButtonElement).addEventListener("click", event => {
      this.updateExistAddons();
    });
    (win.document.querySelector("#refresh") as HTMLButtonElement).addEventListener("click", event => {
      this.refresh(true);
    });
    (win.document.querySelector("#gotoPage") as HTMLButtonElement).addEventListener("click", event => {
      this.tableHelper?.treeInstance.selection.selected.forEach((select) => {
        if (select < 0 || select >= this.addonInfos[1].length) {
          return;
        }
        const pageURL = `https://github.com/${this.addonInfos[0][select].repo}`;
        if (pageURL) {
          Zotero.launchURL(pageURL);
        }
      });
    });
    (win.document.querySelector("#install") as HTMLButtonElement).addEventListener("click", event => {
      const selectAddons: AddonInfo[] = [];
      for (const select of this.tableHelper?.treeInstance.selection.selected ?? []) {
        if (select < 0 || select >= this.addonInfos[1].length) {
          return;
        }
        selectAddons.push(this.addonInfos[0][select]);
      }
      this.installAddons(selectAddons, true);
    });
    (win.document.querySelector("#customSource-container") as HTMLElement).hidden = currentSource().id !== "source-custom";
    (win.document.querySelector("#customSourceInput") as HTMLInputElement).value = customSourceApi();
    (win.document.querySelector("#customSourceInput") as HTMLInputElement).addEventListener("change", event => {
      setCustomSourceApi((event.target as HTMLInputElement).value);
      this.refresh(true);
    });
    win.open();
  }

  private static async installAddons(addons: AddonInfo[], forceInstall: boolean) {
    await Promise.all(addons.map(async addon => {
      const popWin = new ztoolkit.ProgressWindow(config.addonName, {
        closeOnClick: true,
      }).createLine({
        text: `${getString("installing")} ${addon.name}`,
        type: "default",
        progress: 0,
      }).show();
      let installSucceed = false;
      const z7XpiUrls = z7XpiDownloadUrls(addon);
      for (const xpiUrl of z7XpiUrls) {
        if (!xpiUrl || xpiUrl.length <= 0) { continue; }
        ztoolkit.log(`downloading ${addon.name} from ${xpiUrl}`);
        try {
          const addonID = await installAddonFrom(xpiUrl, forceInstall);
          if (addonID) {
            await Zotero.Promise.delay(1000);
            installSucceed = await AddonManager.getAddonByID(addonID);
            break;
          }
        } catch (error) {
          ztoolkit.log(`install from ${xpiUrl} failed: ${error}`);
        }
      }
      popWin.changeLine({
        text: `${addon.name} ${installSucceed ? getString("install-succeed") : getString("install-failed")}`,
        type: installSucceed ? "success" : "fail",
        progress: 0,
      });
      popWin.startCloseTimer(1000);
    }));
    await this.refresh(false);
  }

  private static async updateButtons(selectAddons: AddonInfo[]) {
    const gotoPageButton = this.window?.document.querySelector("#gotoPage") as HTMLButtonElement;
    const installButton = this.window?.document.querySelector("#install") as HTMLButtonElement;
    gotoPageButton.disabled =
      selectAddons.length !== 1 ||
      (selectAddons[0].repo?.length ?? 0) === 0;
    const installDisabled = selectAddons.reduce((previous, current) => {
      return previous && (current.releases.find(release => compareVersion(release.targetZoteroVersion, "7") >= 0)?.xpiDownloadUrl?.github.length ?? 0) === 0;
    }, true);
    installButton.disabled = installDisabled;
    (this.window?.document.querySelector("#updateAllAddons") as HTMLButtonElement).hidden = (await this.outdateAddons()).length <= 0;
  }

  private static async refresh(force = false) {
    await this.updateAddonInfos(force);
    this.updateTable();
  }

  private static async updateAddonInfos(force = false) {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    const relateAddons = await this.relatedAddons(addonInfos);
    this.addonInfos = [
      addonInfos,
      await Promise.all(
        addonInfos.map(async addonInfo => {
          const result: { [key: string]: string } = {};
          result["name"] = addonInfo.name;
          result["description"] = addonInfo.description ?? "";
          result['star'] = addonInfo.star === 0 ? "0" : addonInfo.star ? String(addonInfo.star) : "?"
          result["isInstalled"] = relateAddons.find(addonPair => {
            return addonInfo.repo === addonPair[0].repo;
          }) ? "✅" : addonInfo.id ? "" : getString('state-unknown');
          return result;
        }),
      ),
    ];
  }

  private static async updateTable() {
    return new Promise<void>((resolve) => {
      this.tableHelper?.render(undefined, (_) => {
        resolve();
      });
    });
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
        return false;
      });
      if (relateAddon) {
        addons.push([relateAddon, addon]);
      }
    }
    return addons;
  }

  private static async outdateAddons() {
    const addons = await this.relatedAddons(this.addonInfos[0]);
    return addons.filter(([addonInfo, addon]) => {
      const release = addonInfo.releases.find(release => compareVersion(release.targetZoteroVersion, "7") >= 0);
      if (!release || (release.xpiDownloadUrl?.github.length ?? 0) == 0) { return false; }
      const version = release.currentVersion;
      if (!addon.isCompatible || !addon.isPlatformCompatible || !addon.strictCompatibility) { return true; }
      if (!version || !addon.version) { return false; }
      return compareVersion(addon.version, version) < 0;
    });
  }

  private static async updateExistAddons() {
    const addons = await this.outdateAddons();
    if (addons.length <= 0) { return; }
    const progressWin = new ztoolkit.ProgressWindow(config.addonName, {
      closeOnClick: true,
    }).createLine({
      type: "default",
      progress: 0,
    }).show();
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

  static async close() {
    this.window?.close();
  }
}
