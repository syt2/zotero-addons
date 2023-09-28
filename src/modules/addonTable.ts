import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoAPI, AddonInfoManager } from "./addonInfo";
import { isWindowAlive } from "../utils/window";




export class AddonTable {
  // register an item in menu tools
  static registerInMenuTool() {
    ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
    });
    ztoolkit.Menu.register("menuTools", {
      tag: "menuitem",
      label: getString("menuitem-addons"),
      commandListener: (event) => {
        (async () => {
          await this.showAddonsWindow();
        })();
      },
    });
    ztoolkit.Menu.register("menuTools", {
      tag: "menuseparator",
    });
  }

  private static addonInfos: [AddonInfo[], { [key: string]: string; }[]] = [[], []]
  private static window?: Window;
  private static tableHelper?: VirtualizedTableHelper;

  // display addon table window
  static async showAddonsWindow() {
    Zotero.log(isWindowAlive(this.window));
    
    if (isWindowAlive(this.window)) {
      this.window?.focus();
      this.refresh();
      return;
    }

    const windowArgs = { _initPromise: Zotero.Promise.defer(), };
    const win = (window as any).openDialog(
      `chrome://${config.addonRef}/content/addons.xhtml`,
      `${config.addonRef}-addons`,
      `chrome,centerscreen,resizable,status,width=800,height=400,dialog=no`,
      windowArgs
    )!;
    await windowArgs._initPromise.promise;
    this.window = win;
    const columns = [
      {
        dataKey: "name",
        label: "name",
        fixedWidth: false,
      },
      {
        dataKey: "description",
        label: "description",
        fixedWidth: true,
      },
      {
        dataKey: "startCount",
        label: "stars",
        fixedWidth: false,
      }
    ].map((column) => Object.assign(column, { label: getString(column.label), }));

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
        const selectAddons: AddonInfo[] = []
        for (const select of selection.selected) {
          if (select < 0 || select >= this.addonInfos[1].length) { return; }
          selectAddons.push(this.addonInfos[0][select]);
        }
        this.updateButtons(selectAddons);
      })
      .render(undefined, _ => {
        this.refresh();
      });
    (win.document.querySelector("#refresh") as HTMLButtonElement).addEventListener("click", event => {
      this.refresh(true);
    });
    (win.document.querySelector("#gotoPage") as HTMLButtonElement).addEventListener("click", event => {
      this.tableHelper?.treeInstance.selection.selected.forEach(select => {
        if (select < 0 || select >= this.addonInfos[1].length) { return; }
        const pageURL = this.addonInfos[0][select].page;
        if (pageURL) {
          Zotero.launchURL(pageURL);
        }
      });
    });
    (win.document.querySelector("#install") as HTMLButtonElement).addEventListener("click", event => {
      const selectAddons: AddonInfo[] = []
      for (const select of this.tableHelper?.treeInstance.selection.selected ?? []) {
        if (select < 0 || select >= this.addonInfos[1].length) { return; }
        selectAddons.push(this.addonInfos[0][select]);
      }
      this.installAddons(selectAddons);
    });
    win.open();
  }

  private static installAddons(addons: AddonInfo[]) {
    const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    addons.forEach(async addon => {
      if ((addon.downloadLink?.length ?? 0) == 0) { return; }
      try {
        const response = await Zotero.HTTP.request('get', addon.downloadLink, {
          responseType: "arraybuffer",
        });
        const xpiDownloadPath = PathUtils.join(PathUtils.tempDir, `${addon.id}.xpi`);
        await IOUtils.write(xpiDownloadPath, new Uint8Array(response.response));
        const xpiFile = Zotero.File.pathToFile(xpiDownloadPath);
        const xpiInstaller = await AddonManager.getInstallForFile(xpiFile);
        xpiInstaller.install();
      } catch (error) {
        ztoolkit.log(`download from ${addon.downloadLink} failed: ${error}`)
      }
    });
  }

  private static async updateButtons(selectAddons: AddonInfo[]) {
    const gotoPageButton = this.window?.document.querySelector("#gotoPage") as HTMLButtonElement;
    const installButton = this.window?.document.querySelector("#install") as HTMLButtonElement;
    gotoPageButton.disabled = (selectAddons.length !== 1 || (selectAddons[0].page?.length ?? 0) === 0);
    const installDisabled = selectAddons.reduce((previous, current) => {
      return previous && (current.downloadLink?.length ?? 0) === 0;
    }, true);
    installButton.disabled = installDisabled;
  }

  private static async refresh(force = false) {
    await this.updateAddonInfos(force);
    this.updateTable();
  }

  private static async updateAddonInfos(force = false) {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    this.addonInfos = [
      addonInfos,
      addonInfos.map(addonInfo => {
        const result: { [key: string]: string } = {};
        for (const prop in addonInfo) {
          if (Object.prototype.hasOwnProperty.call(addonInfo, prop)) {
            result[prop] = String(addonInfo[prop]);
          }
        }
        return result;
      }),
    ];
  }

  private static async updateTable() {
    return new Promise<void>((resolve) => {
      this.tableHelper?.render(undefined, _ => { resolve(); });
    });
  }
}