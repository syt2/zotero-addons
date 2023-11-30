import { AddonInfo, addonReleaseInfo, relatedAddons, xpiDownloadUrls } from "./addonInfo";
import { getString } from "../utils/locale";
import { compareVersion, installAddonWithPopWindowFrom, undoUninstall, uninstall } from "../utils/utils";
import { config } from "../../package.json";
import { isWindowAlive } from "../utils/window";
const { XPIDatabase } = ChromeUtils.import("resource://gre/modules/addons/XPIDatabase.jsm");


export class AddonInfoDetail {
  private static window?: Window;
  private static addonInfo?: AddonInfo;

  static async close() {
    this.window?.close();
  }

  static async showDetailWindow(addonInfo: AddonInfo) {
    this.window?.close();
    this.addonInfo = addonInfo;
    const windowArgs = { _initPromise: Zotero.Promise.defer() };
    const win = (window as any).openDialog(
      `chrome://${config.addonRef}/content/addonDetail.xhtml`,
      `${config.addonRef}-addonDetail`,
      `chrome,centerscreen,resizable,status,dialog=no,width=520,height=240`,
      windowArgs,
    );
    await windowArgs._initPromise.promise;
    this.window = win;

    this.installButton.addEventListener("click", async e => {
      if (this.installButton.disabled) { return; }
      this.installButton.disabled = true;
      await this.installAddon(addonInfo);
      this.installButton.disabled = false;
    });
    this.updateButton.addEventListener("click", async e => {
      if (this.updateButton.disabled) { return; }
      this.updateButton.disabled = true;
      await this.installAddon(addonInfo);
      this.updateButton.disabled = false;
    });
    this.reinstallButton.addEventListener("click", async e => {
      if (this.reinstallButton.disabled) { return; }
      this.reinstallButton.disabled = true;
      await this.installAddon(addonInfo);
      this.reinstallButton.disabled = false;
    });
    this.uninstallButton.addEventListener("click", async e => {
      if (this.uninstallButton.disabled) { return; }
      this.uninstallButton.disabled = true;
      await uninstall(await this.localAddon());
      this.uninstallButton.disabled = false;
    });
    this.uninstallUndoButton.addEventListener("click", async e => {
      if (this.uninstallUndoButton.disabled) { return; }
      this.uninstallUndoButton.disabled = true;
      await undoUninstall(await this.localAddon());
      this.uninstallUndoButton.disabled = false;
    });
    this.enableButton.addEventListener("click", async e => {
      if (this.enableButton.disabled) { return; }
      this.enableButton.disabled = true;
      await (await this.localAddon()).enable();
      this.enableButton.disabled = false;
    });
    this.disableButton.addEventListener("click", async e => {
      if (this.disableButton.disabled) { return; }
      this.disableButton.disabled = true;
      await (await this.localAddon()).disable();
      this.disableButton.disabled = false;
    });

    this.authorName.addEventListener("click", e => {
      if (!addonInfo.author?.url) { return; }
      Zotero.launchURL(`${addonInfo.author.url}`);
    });
    this.addonName.addEventListener("click", e => {
      if (!addonInfo.repo) { return; }
      Zotero.launchURL(`https://github.com/${addonInfo.repo}`);
    });

    await this.refresh();
  }

  private static async installAddon(addon: AddonInfo) {
    const urls = xpiDownloadUrls(addon).filter(x => {
      return (x?.length ?? 0) > 0;
    }) as string[];
    await installAddonWithPopWindowFrom(urls, addon.name, addon.repo, true);
  }

  private static get installButton() {
    return this.window?.document.querySelector("#install") as HTMLButtonElement;
  }
  private static get updateButton() {
    return this.window?.document.querySelector("#update") as HTMLButtonElement;
  }
  private static get reinstallButton() {
    return this.window?.document.querySelector("#reinstall") as HTMLButtonElement;
  }
  private static get uninstallButton() {
    return this.window?.document.querySelector("#uninstall") as HTMLButtonElement;
  }
  private static get uninstallUndoButton() {
    return this.window?.document.querySelector("#uninstallUndo") as HTMLButtonElement;
  }
  private static get enableButton() {
    return this.window?.document.querySelector("#enable") as HTMLButtonElement;
  }
  private static get disableButton() {
    return this.window?.document.querySelector("#disable") as HTMLButtonElement;
  }
  private static get authorName() {
    return this.window?.document.querySelector("#author-name") as HTMLLinkElement;
  }
  private static get addonName() {
    return this.window?.document.querySelector("#addon-name") as HTMLLinkElement;
  }
  private static async localAddon(): Promise<any | undefined> {
    if (!this.addonInfo) { return undefined; }
    const relateAddons = await relatedAddons([this.addonInfo]);
    let localAddon: any = undefined;
    if (relateAddons.length > 0 && relateAddons[0][1]) {
      localAddon = relateAddons[0][1];
    }
    return localAddon;
  }

  static async refresh() {
    const win = this.window;
    const addonInfo = this.addonInfo;
    if (!win || !addonInfo || !isWindowAlive(win)) { return; }
    const version = addonReleaseInfo(addonInfo)?.currentVersion;
    const localAddon = await this.localAddon();

    const windowTitle = win.document.querySelector("#win-title") as HTMLTitleElement;
    windowTitle.innerHTML = addonInfo.name;

    this.addonName.innerHTML = addonInfo.name;

    const starIcon = win.document.querySelector("#stars-icon") as HTMLImageElement;
    starIcon.src = `https://img.shields.io/github/stars/${addonInfo.repo}?label=${getString('menu-star')}`;
    const downloadCountIcon = win.document.querySelector("#download-count-icon") as HTMLImageElement;
    downloadCountIcon.src = version ? `https://img.shields.io/github/downloads/${addonInfo.repo}/${version!}/total?label=${getString('menu-download-count')}` : "";
    const remoteVersionIcon = win.document.querySelector("#remote-version-icon") as HTMLImageElement;
    remoteVersionIcon.src = `https://img.shields.io/badge/${getString('menu-remote-version')}-${version?.replace('-', '--') ?? getString('unknown')}-gree`;
    const localVersionIcon = win.document.querySelector("#local-version-icon") as HTMLImageElement;
    localVersionIcon.src = (localAddon?.version) ? `https://img.shields.io/badge/${getString('menu-local-version')}-${localAddon!.version!.replace('-', '--')}-red` : "";

    const avatarIcon = win.document.querySelector("#avatar-icon") as HTMLImageElement;
    avatarIcon.src = addonInfo.author?.avatar ?? "";
    this.authorName.innerHTML = addonInfo.author?.name ?? "Unknown";

    const description = win.document.querySelector("#description") as HTMLLabelElement;
    description.innerHTML = localAddon?.description ?? addonInfo.description ?? "";

    this.installButton.hidden = true;
    this.updateButton.hidden = true;
    this.reinstallButton.hidden = true;
    this.uninstallButton.hidden = true;
    this.uninstallUndoButton.hidden = true;
    this.enableButton.hidden = true;
    this.disableButton.hidden = true;

    const relatedAddon = await relatedAddons([addonInfo]);

    const addonCanUpdate = (addonInfo: AddonInfo, addon: any) => {
      const version = addonReleaseInfo(addonInfo)?.currentVersion;
      if (!version || !addon.version) { return false; }
      return compareVersion(addon.version, version) < 0;
    }
    if (relatedAddon.length > 0) {
      if (relatedAddon[0][1].appDisabled) {
        this.reinstallButton.hidden = false;
      } else if (addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
        this.updateButton.hidden = false;
      } else {
        this.reinstallButton.hidden = false;
      }
      const dbAddon = XPIDatabase.getAddons().filter((addon: any) => addon.id === relatedAddon[0][1].id);
      if (dbAddon.length > 0) {
        dbAddon[0].pendingUninstall ? this.uninstallUndoButton.hidden = false : this.uninstallButton.hidden = false;
      }
      if (!relatedAddon[0][1].appDisabled && (dbAddon.length <= 0 || !dbAddon[0].pendingUninstall)) {
        if (relatedAddon[0][1].userDisabled) {
          this.enableButton.hidden = false;
        } else {
          this.disableButton.hidden = false;
        }
      }
    } else {
      this.installButton.hidden = false;
    }
  }
}