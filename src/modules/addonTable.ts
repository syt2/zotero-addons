import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AddonInfo, AddonInfoAPI, AddonInfoManager } from "./addonInfo";




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

  // display addon table window
  static async showAddonsWindow() {
    const windowArgs = { _initPromise: Zotero.Promise.defer(), };
    const win = (window as any).openDialog(
      `chrome://${config.addonRef}/content/addons.xhtml`,
      `${config.addonRef}-addons`,
      `chrome,centerscreen,resizable,status,width=800,height=400,dialog=no`,
      windowArgs
    )!;
    await windowArgs._initPromise.promise;
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

    const tableHelper = new ztoolkit.VirtualizedTable(win!)
      .setContainerId(`table-container`)
      .setProp({
        id: `header`,
        columns: columns,
        showHeader: true,
        multiSelect: false,
        staticColumns: true,
        disableFontSizeScaling: false,
      })
      .setProp("getRowCount", () => this.addonInfos[1].length)
      .setProp("getRowData", (index) => this.addonInfos[1][index])
      .setProp("getRowString", (index) => this.addonInfos[1][index].name || "")
      // .setProp("onSelectionChange", (selection) => {
        // updateButtons();
      // })
      .render(undefined, _ => {
        this.refresh(tableHelper);
      });
    (win.document.querySelector("#refresh") as HTMLButtonElement).addEventListener("click", event => {
      this.refresh(tableHelper);
    });
    (win.document.querySelector("#gotoPage") as HTMLButtonElement).addEventListener("click", event => {
      tableHelper.treeInstance.selection.selected.forEach(select => {
        if (select < 0 || select >= this.addonInfos[1].length) { return; }
        const pageURL = this.addonInfos[0][select].page;
        if (pageURL) {
          Zotero.launchURL(pageURL);
        }
      });
    });
    (win.document.querySelector("#install") as HTMLButtonElement).addEventListener("click", event => {
      for (const select of tableHelper.treeInstance.selection.selected) {
        if (select < 0 || select >= this.addonInfos[1].length) { continue; }
        ztoolkit.log(select);
        ztoolkit.log(this.addonInfos[0][select]);
      }

    });
    win.open();
  }

  private static async refresh(tableHelper: VirtualizedTableHelper) {
    await this.updateAddonInfos();
    ztoolkit.log(this.addonInfos[0])
    this.updateTable(tableHelper);
  }

  private static async updateAddonInfos() {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(false);
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

  private static async updateTable(tableHelper: VirtualizedTableHelper) {
    return new Promise<void>((resolve) => {
      tableHelper.render(undefined, _ => { resolve(); });
    });
  }
}