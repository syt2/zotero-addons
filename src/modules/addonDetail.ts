import {
  AddonInfo,
  addonReleaseInfo,
  addonReleaseTime,
  relatedAddons,
  xpiDownloadUrls,
} from "./addonInfo";
import { getString } from "../utils/locale";
import { installAddonFrom, undoUninstall, uninstall } from "../utils/utils";
import { config } from "../../package.json";
import { isWindowAlive } from "../utils/window";
const { XPIDatabase } = ChromeUtils.importESModule("resource://gre/modules/addons/XPIDatabase.sys.mjs");
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

export class AddonInfoDetail {
  private static window: Window | null;
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
    let resolveInit: () => void;
    const _initPromise = new Promise<void>(resolve => {
      resolveInit = resolve;
    });
    const windowArgs = {
      _initPromise: {
        promise: _initPromise,
        resolve: resolveInit!
      },
      addonInfo: addonInfo,
      site: __env__ === 'development' ? 'Zotero Plugin Market for testing' : 'Zotero Plugin Market',
      downloadSourceAction: async (url: string) => {
        const response = await Zotero.HTTP.request("GET", url);
        return btoa(response.response);
      },
      openInViewAction: (url: string) => Zotero.openInViewer(url),
      zotero: Zotero,
    };
    const win = Zotero.getMainWindow().openDialog(
      `chrome://${config.addonRef}/content/addonDetail.xhtml`,
      `${config.addonRef}-addonDetail`,
      `chrome,centerscreen,resizable,status,dialog=no,width=800,height=640`,
      windowArgs,
    );
    await windowArgs._initPromise.promise;
    this.window = win;
    win?.addEventListener("keypress", (e: KeyboardEvent) => {
      if (
        ((Zotero.isMac && e.metaKey && !e.ctrlKey) ||
          (!Zotero.isMac && e.ctrlKey)) &&
        !e.altKey &&
        e.key === "w"
      ) {
        this.close();
      }
    });

    this.installButton.addEventListener("click", async (e) => {
      if (this.installButton.disabled) {
        return;
      }
      this.installButton.disabled = true;
      await this.installAddon(addonInfo);
      this.installButton.disabled = false;
    });
    this.updateButton.addEventListener("click", async (e) => {
      if (this.updateButton.disabled) {
        return;
      }
      this.updateButton.disabled = true;
      await this.installAddon(addonInfo);
      this.updateButton.disabled = false;
    });
    this.reinstallButton.addEventListener("click", async (e) => {
      if (this.reinstallButton.disabled) {
        return;
      }
      this.reinstallButton.disabled = true;
      await this.installAddon(addonInfo);
      this.reinstallButton.disabled = false;
    });
    this.uninstallButton.addEventListener("click", async (e) => {
      if (this.uninstallButton.disabled) {
        return;
      }
      this.uninstallButton.disabled = true;
      await uninstall(await this.localAddon(), { popConfirmDialog: true });
      this.uninstallButton.disabled = false;
    });
    this.removeButton.addEventListener("click", async (e) => {
      if (this.removeButton.disabled) {
        return;
      }
      this.removeButton.disabled = true;
      await uninstall(await this.localAddon());
      this.removeButton.disabled = false;
    });
    this.uninstallUndoButton.addEventListener("click", async (e) => {
      if (this.uninstallUndoButton.disabled) {
        return;
      }
      this.uninstallUndoButton.disabled = true;
      await undoUninstall(await this.localAddon());
      this.uninstallUndoButton.disabled = false;
    });
    this.enableButton.addEventListener("click", async (e) => {
      if (this.enableButton.disabled) {
        return;
      }
      this.enableButton.disabled = true;
      await (await this.localAddon()).enable();
      this.enableButton.disabled = false;
    });
    this.disableButton.addEventListener("click", async (e) => {
      if (this.disableButton.disabled) {
        return;
      }
      this.disableButton.disabled = true;
      await (await this.localAddon()).disable();
      this.disableButton.disabled = false;
    });

    this.authorName.addEventListener("click", (e) => {
      if (!addonInfo.author?.url) {
        return;
      }
      Zotero.launchURL(`${addonInfo.author.url}`);
    });
    this.authorIcon.addEventListener("click", (e) => {
      if (!addonInfo.author?.url) {
        return;
      }
      Zotero.launchURL(`${addonInfo.author.url}`);
    });
    this.addonName.addEventListener("click", (e) => {
      if (!addonInfo.repo) {
        return;
      }
      Zotero.launchURL(`https://github.com/${addonInfo.repo}`);
    });
    this.addonIcon.addEventListener("click", (e) => {
      if (!addonInfo.repo) {
        return;
      }
      Zotero.launchURL(`https://github.com/${addonInfo.repo}`);
    });

    await this.refresh();
  }

  private static async installAddon(addon: AddonInfo) {
    const urls = xpiDownloadUrls(addon).filter((x) => {
      return (x?.length ?? 0) > 0;
    }) as string[];
    await installAddonFrom(urls, {
      name: addonReleaseInfo(addon)?.name ?? addon.name,
      popWin: true,
    });
  }

  private static get installButton() {
    return this.window?.document.querySelector("#install") as HTMLButtonElement;
  }
  private static get updateButton() {
    return this.window?.document.querySelector("#update") as HTMLButtonElement;
  }
  private static get reinstallButton() {
    return this.window?.document.querySelector(
      "#reinstall",
    ) as HTMLButtonElement;
  }
  private static get uninstallButton() {
    return this.window?.document.querySelector(
      "#uninstall",
    ) as HTMLButtonElement;
  }
  private static get removeButton() {
    return this.window?.document.querySelector("#remove") as HTMLButtonElement;
  }
  private static get uninstallUndoButton() {
    return this.window?.document.querySelector(
      "#uninstallUndo",
    ) as HTMLButtonElement;
  }
  private static get enableButton() {
    return this.window?.document.querySelector("#enable") as HTMLButtonElement;
  }
  private static get disableButton() {
    return this.window?.document.querySelector("#disable") as HTMLButtonElement;
  }
  private static get authorName() {
    return this.window?.document.querySelector(
      "#author-name",
    ) as HTMLLinkElement;
  }
  private static get authorIcon() {
    return this.window?.document.querySelector(
      "#avatar-icon",
    ) as HTMLImageElement;
  }
  private static get addonName() {
    return this.window?.document.querySelector(
      "#addon-name",
    ) as HTMLLinkElement;
  }
  private static get addonIcon() {
    return this.window?.document.querySelector(
      "#addon-icon",
    ) as HTMLImageElement;
  }
  private static get uncompatibleDescription() {
    return this.window?.document.querySelector(
      "#uncompatibleDescription",
    ) as HTMLLabelElement;
  }
  private static async localAddon(): Promise<any | undefined> {
    if (!this.addonInfo) {
      return undefined;
    }
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
    if (!win || !addonInfo || !isWindowAlive(win)) {
      return;
    }
    const releaseInfo = addonReleaseInfo(addonInfo);
    const tagName = releaseInfo?.tagName;
    const version = releaseInfo?.xpiVersion;
    const releaseTime = addonReleaseTime(addonInfo);
    const localAddon = await this.localAddon();

    const windowTitle = win.document.querySelector(
      "#win-title",
    ) as HTMLTitleElement;
    windowTitle.textContent = releaseInfo?.name ?? addonInfo.name ?? "";

    this.addonIcon.src = localAddon
      ? AddonManager.getPreferredIconURL(localAddon)
      : "";
    this.addonIcon.hidden = !localAddon;
    this.addonName.textContent = releaseInfo?.name ?? addonInfo.name ?? "";

    this.authorIcon.src = addonInfo.author?.avatar ?? "";
    this.authorName.textContent = addonInfo.author?.name ?? "Unknown";

    const starIcon = win.document.querySelector(
      "#stars-icon",
    ) as HTMLImageElement;
    starIcon.src = `https://img.shields.io/github/stars/${addonInfo.repo}?label=${getString("menu-star")}`;
    const downloadLatestCountIcon = win.document.querySelector(
      "#download-latest-count-icon",
    ) as HTMLImageElement;
    downloadLatestCountIcon.src = tagName
      ? `https://img.shields.io/github/downloads/${addonInfo.repo}/${tagName!}/total?label=${getString("menu-download-latest-count")}`
      : "";
    const remoteVersionIcon = win.document.querySelector(
      "#remote-version-icon",
    ) as HTMLImageElement;
    remoteVersionIcon.src = `https://img.shields.io/badge/${getString("menu-remote-version")}-${version?.replace("-", "--") ?? getString("unknown")}-orange`;
    const localVersionIcon = win.document.querySelector(
      "#local-version-icon",
    ) as HTMLImageElement;
    localVersionIcon.src = localAddon?.version
      ? `https://img.shields.io/badge/${getString("menu-local-version")}-${localAddon!.version!.replace("-", "--")}-red`
      : "";
    const releaseTimeIcon = win.document.querySelector(
      "#release-time-icon",
    ) as HTMLImageElement;
    releaseTimeIcon.src = releaseTime
      ? `https://img.shields.io/badge/${getString("menu-remote-update-time")}-${releaseTime}-yellowgreen`
      : "";

    const description = win.document.querySelector(
      "#description",
    ) as HTMLLabelElement;
    description.textContent =
      localAddon?.description ??
      releaseInfo?.description ??
      addonInfo.description ??
      "";

    this.uncompatibleDescription.hidden = true;
    if (releaseInfo?.minZoteroVersion && releaseInfo.maxZoteroVersion) {
      if (
        Services.vc.compare(
          Zotero.version,
          releaseInfo.minZoteroVersion.replace("*", "0"),
        ) < 0 ||
        Services.vc.compare(
          Zotero.version,
          releaseInfo.maxZoteroVersion.replace("*", "999"),
        ) > 0
      ) {
        this.uncompatibleDescription.hidden = false;
        this.uncompatibleDescription.textContent = getString(
          "release-uncompatible-description",
          {
            args: {
              minVersion: releaseInfo.minZoteroVersion,
              maxVersion: releaseInfo.maxZoteroVersion,
              currentVersion: Zotero.version,
            },
          },
        );
      }
    }

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
      if (!version || !addon.version) {
        return false;
      }
      return Services.vc.compare(addon.version, version) < 0;
    };
    if (relatedAddon.length > 0) {
      if (relatedAddon[0][1].appDisabled) {
        this.reinstallButton.hidden = false;
      } else if (addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
        this.updateButton.hidden = false;
      } else {
        this.reinstallButton.hidden = false;
      }
      const dbAddon = await XPIDatabase.getAddon(
        (addon: any) => addon.id === relatedAddon[0][1].id,
      );
      if (dbAddon) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        dbAddon.pendingUninstall
          ? (this.uninstallUndoButton.hidden = false)
          : (this.uninstallButton.hidden = false);
        this.removeButton.hidden = !dbAddon.pendingUninstall;
      }
      if (
        !relatedAddon[0][1].appDisabled &&
        !(dbAddon && dbAddon.pendingUninstall)
      ) {
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
