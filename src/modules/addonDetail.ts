import { AddonInfo, addonReleaseInfo, addonReleaseTime, relatedAddons, xpiDownloadUrls } from "./addonInfo";
import { getString } from "../utils/locale";
import { compareVersion, installAddonFrom, undoUninstall, uninstall } from "../utils/utils";
import { config } from "../../package.json";
import { isWindowAlive } from "../utils/window";
const { XPIDatabase } = ChromeUtils.import("resource://gre/modules/addons/XPIDatabase.jsm");
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

export class AddonInfoDetail {
  private static window?: Window;
  private static addonInfo?: AddonInfo;

  /**
   * Close detail window
   */
  static async close() {
    this.window?.close();
  }

  /**
   * Show detail window for specific AddonInfo
   * @param addonInfo AddonInfo specified
   */
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
    win.addEventListener('keypress', (e: KeyboardEvent) => {
      if (((Zotero.isMac && e.metaKey && !e.ctrlKey) || (!Zotero.isMac && e.ctrlKey)) && !e.altKey && e.key === 'w') {
        this.close();
      }
    });

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
      await uninstall(await this.localAddon(), { popConfirmDialog: true });
      this.uninstallButton.disabled = false;
    });
    this.removeButton.addEventListener("click", async e => {
      if (this.removeButton.disabled) { return; }
      this.removeButton.disabled = true;
      await uninstall(await this.localAddon());
      this.removeButton.disabled = false;
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
    this.authorIcon.addEventListener("click", e => {
      if (!addonInfo.author?.url) { return; }
      Zotero.launchURL(`${addonInfo.author.url}`);
    });
    this.addonName.addEventListener("click", e => {
      if (!addonInfo.repo) { return; }
      Zotero.launchURL(`https://github.com/${addonInfo.repo}`);
    });
    this.addonIcon.addEventListener("click", e => {
      if (!addonInfo.repo) { return; }
      Zotero.launchURL(`https://github.com/${addonInfo.repo}`);
    });

    await this.refresh();
  }

  private static async installAddon(addon: AddonInfo) {
    const urls = xpiDownloadUrls(addon).filter(x => {
      return (x?.length ?? 0) > 0;
    }) as string[];
    await installAddonFrom(urls, { name: addonReleaseInfo(addon)?.name ?? addon.name, popWin: true });
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
  private static get removeButton() {
    return this.window?.document.querySelector("#remove") as HTMLButtonElement;
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
  private static get authorIcon() {
    return this.window?.document.querySelector("#avatar-icon") as HTMLImageElement;
  }
  private static get addonName() {
    return this.window?.document.querySelector("#addon-name") as HTMLLinkElement;
  }
  private static get addonIcon() {
    return this.window?.document.querySelector("#addon-icon") as HTMLImageElement;
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

  /**
   * Refresh shown detail window if need
   */
  static async refresh() {
    const win = this.window;
    const addonInfo = this.addonInfo;
    if (!win || !addonInfo || !isWindowAlive(win)) { return; }
    const releaseInfo = addonReleaseInfo(addonInfo);
    const tagName = releaseInfo?.tagName;
    const version = releaseInfo?.xpiVersion;
    const releaseTime = addonReleaseTime(addonInfo);
    const localAddon = await this.localAddon();

    const windowTitle = win.document.querySelector("#win-title") as HTMLTitleElement;
    windowTitle.textContent = releaseInfo?.name ?? addonInfo.name;

    this.addonIcon.src = localAddon ? AddonManager.getPreferredIconURL(localAddon) : "";
    this.addonIcon.hidden = !localAddon;
    this.addonName.textContent = releaseInfo?.name ?? addonInfo.name;

    this.authorIcon.src = addonInfo.author?.avatar ?? "";
    this.authorName.textContent = addonInfo.author?.name ?? "Unknown";

    const starIcon = win.document.querySelector("#stars-icon") as HTMLImageElement;
    starIcon.src = `https://img.shields.io/github/stars/${addonInfo.repo}?label=${getString('menu-star')}`;
    const downloadLatestCountIcon = win.document.querySelector("#download-latest-count-icon") as HTMLImageElement;
    downloadLatestCountIcon.src = tagName ? `https://img.shields.io/github/downloads/${addonInfo.repo}/${tagName!}/total?label=${getString('menu-download-latest-count')}` : "";
    const downloadAllCountIcon = win.document.querySelector("#download-all-count-icon") as HTMLImageElement;
    downloadAllCountIcon.src = tagName ? `https://img.shields.io/github/downloads/${addonInfo.repo}/total?label=${getString('menu-download-all-count')}` : "";
    const remoteVersionIcon = win.document.querySelector("#remote-version-icon") as HTMLImageElement;
    remoteVersionIcon.src = `https://img.shields.io/badge/${getString('menu-remote-version')}-${version?.replace('-', '--') ?? getString('unknown')}-orange`;
    const localVersionIcon = win.document.querySelector("#local-version-icon") as HTMLImageElement;
    localVersionIcon.src = (localAddon?.version) ? `https://img.shields.io/badge/${getString('menu-local-version')}-${localAddon!.version!.replace('-', '--')}-red` : "";
    const releaseTimeIcon = win.document.querySelector("#release-time-icon") as HTMLImageElement;
    releaseTimeIcon.src = releaseTime ? `https://img.shields.io/badge/${getString('menu-remote-update-time')}-${releaseTime}-yellowgreen` : "";

    const description = win.document.querySelector("#description") as HTMLLabelElement;
    description.textContent = localAddon?.description ?? releaseInfo?.description ?? addonInfo.description ?? "";

    this.installButton.hidden = true;
    this.updateButton.hidden = true;
    this.reinstallButton.hidden = true;
    this.uninstallButton.hidden = true;
    this.removeButton.hidden = true;
    this.uninstallUndoButton.hidden = true;
    this.enableButton.hidden = true;
    this.disableButton.hidden = true;

    const relatedAddon = await relatedAddons([addonInfo]);

    const addonCanUpdate = (addonInfo: AddonInfo, addon: any) => {
      const version = addonReleaseInfo(addonInfo)?.xpiVersion;
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
        this.removeButton.hidden = !dbAddon[0].pendingUninstall;
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