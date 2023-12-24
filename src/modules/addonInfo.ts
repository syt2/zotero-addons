import { Sources, autoSource, currentSource, setAutoSource } from "../utils/configuration";
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

// cpoy from https://github.com/zotero-chinese/zotero-plugins/blob/3fe315d38e740bf8742186cd59e08903317493c9/src/plugins.ts#L1C1-L52C2
export interface AddonInfo {
  /**
   * 插件名称
   */
  name: string;
  /**
   * 插件仓库
   *
   * 例如：northword/zotero-format-metadata
   *
   * 注意前后均无 `/`
   */
  repo: string;
  /**
   * 插件的发布地址信息
   */
  releases: Array<{
    /**
     * 当前发布版对应的 Zotero 版本
     */
    targetZoteroVersion: string;
    /**
     * 当前发布版对应的下载通道
     *
     * `latest`：最新正式发布；
     * `pre`：最新预发布；
     * `string`：发布对应的 `git.tag_name`；
     * 注意 `git.tag_name` 有的有 `v` 而有的没有，可以通过发布链接来判断
     * 程序执行后，`tagName` 将替换为实际的 `git.tag_name`
     */
    tagName: "latest" | "pre" | string;
    /**
     * 插件 ID，自 XPI 中提取
     */
    id?: string;

    /**
     * 插件版本，自 XPI 中提取
     */
    xpiVersion?: string;

    xpiDownloadUrl?: {
      github: string;
      gitee?: string;
      ghProxy?: string;
      jsdeliver?: string;
      kgithub?: string;
    };
    releaseDate?: string;
    downloadCount?: number;
    assetId?: number;
  }>;

  description?: string;
  star?: number;
  watchers?: number;
  author?: {
    name: string;
    url: string;
    avatar: string;
  };
}

export function xpiDownloadUrls(addonInfo: AddonInfo) {
  const z7DownloadUrls = addonReleaseInfo(addonInfo)?.xpiDownloadUrl;
  if (!z7DownloadUrls) { return []; }
  const sourceID = currentSource().id === "source-auto" ? autoSource()?.id : currentSource().id;
  switch (sourceID) {
    case "source-zotero-chinese-github":
      return [z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub].filter(e => e);
    case "source-zotero-chinese-ghproxy":
      return [z7DownloadUrls.ghProxy, z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.kgithub].filter(e => e);
    case "source-zotero-chinese-jsdelivr":
      return [z7DownloadUrls.jsdeliver, z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub].filter(e => e);
    case "source-zotero-chinese-gitee":
      return [z7DownloadUrls.gitee, z7DownloadUrls.github, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub].filter(e => e);
    default:
      return [z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub].filter(e => e);
  }
}

export function addonReleaseInfo(addonInfo: AddonInfo) {
  const release = addonInfo.releases.find(release => release.targetZoteroVersion === (ztoolkit.isZotero7() ? "7" : "6"));
  if ((release?.xpiDownloadUrl?.github?.length ?? 0) === 0) { return; }
  return release
}

export function addonReleaseTime(addonInfo: AddonInfo) {
  const inputDate = new Date(addonReleaseInfo(addonInfo)?.releaseDate ?? "");
  if (inputDate) {
    const year = inputDate.getFullYear();
    const month = String(inputDate.getMonth() + 1).padStart(2, '0');
    const day = String(inputDate.getDate()).padStart(2, '0');
    const hours = String(inputDate.getHours()).padStart(2, '0');
    const minutes = String(inputDate.getMinutes()).padStart(2, '0');
    const seconds = String(inputDate.getSeconds()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    return formattedDate;
  }
}

export type AssociatedAddonInfo = [AddonInfo, { [key: string]: string }]
export async function relatedAddons(addonInfos: AddonInfo[]) {
  const addons: [AddonInfo, any][] = [];
  for (const addon of await AddonManager.getAllAddons()) {
    if (!addon.id) { continue; }
    const relateAddon = addonInfos.find(addonInfo => {
      if (addonReleaseInfo(addonInfo)?.id === addon.id) { return true; }
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

// export enum InstallState {
//   unknown = 0,
//   notInstalled = 1,
//   normal = 2,
//   outdate = 3,
//   disabled = 4,
//   uncompatible = 5,
//   pendingUninstall = 6,
// }


class AddonInfoAPI {
  static async fetchAddonInfos(url: string, timeout?: number, onTimeoutCallback?: VoidFunction): Promise<AddonInfo[]> {
    ztoolkit.log(`fetch addon infos from ${url}`);
    try {
      const options: { timeout?: number } = {};
      if (timeout) {
        options.timeout = timeout;
      }
      const response = await Zotero.HTTP.request("GET", url, options);
      const addons = JSON.parse(response.response) as AddonInfo[];
      const validAddons = addons.filter(addon => addonReleaseInfo(addon));
      return validAddons.sort((a: AddonInfo, b: AddonInfo) => {
        return (b.star ?? 0) - (a.star ?? 0);
      });
    } catch (error) {
      ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
      if (error instanceof Zotero.HTTP.TimeoutException) {
        onTimeoutCallback?.();
      }
    }
    return [];
  }
}

export class AddonInfoManager {
  static shared = new AddonInfoManager();

  private constructor() { }

  get addonInfos() {
    const url = currentSource().api;
    if (!url) { return []; }
    if (url in this.sourceInfos) {
      return this.sourceInfos[url];
    }
    return [];
  }

  private sourceInfos: { [key: string]: AddonInfo[] } = {};
  async fetchAddonInfos(forceRefresh = false) {
    const source = currentSource();
    if (source.id === "source-auto" && !source.api) {
      return await AddonInfoManager.autoSwitchAvaliableApi();
    }
    const url = source.api;
    if (!url) { return []; }
    // 不在刷新，且不需要强制刷新
    if (!forceRefresh && this.addonInfos) {
      return this.addonInfos;
    }
    const infos = await AddonInfoAPI.fetchAddonInfos(url, 5000);
    if (infos.length > 0) {
      this.sourceInfos[url] = infos;
    }
    return this.addonInfos;
  }

  static async autoSwitchAvaliableApi(timeout: number = 3000) {
    for (const source of Sources) {
      if (!source.api) { continue; }
      const infos = await AddonInfoAPI.fetchAddonInfos(source.api, timeout, () => {
        ztoolkit.log(`check source from ${source.api} timeout!`);
      });
      if (infos.length > 0) {
        this.shared.sourceInfos[source.api] = infos;
        setAutoSource(source);
        ztoolkit.log(`switch to ${source.id} automatically`);
        return infos;
      }
    }
    return [];
  }
}