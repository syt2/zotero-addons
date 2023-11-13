import { currentSource, customSourceApi } from "../utils/configuration";

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
     */
    tagName: "latest" | "pre" | string;

    currentVersion?: string;
    xpiDownloadUrl?: {
      github: string;
      gitee?: string;
      ghProxy?: string;
      jsdeliver?: string;
      kgithub?: string;
    };
    releaseData?: string;
    downloadCount?: number;
    assetId?: number;
  }>;

  description?: string;
  star?: number;
  author?: {
    name: string;
    url: string;
    avatar: string;
  };

  // 插件id，用以判断插件是否安装，zotero-chinese仓库暂无此项，保留供后续使用
  id?: string;
}

export function z7XpiDownloadUrls(addonInfo: AddonInfo) {
  const z7DownloadUrls = addonInfo.releases.find(release => release.targetZoteroVersion === (ztoolkit.isZotero7() ? "7" : "6"))?.xpiDownloadUrl;
  if (!z7DownloadUrls) { return []; }
  switch (currentSource().id) {
    case "source-zotero-chinese-github":
      return [z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub];
    case "source-zotero-chinese-ghproxy":
      return [z7DownloadUrls.ghProxy, z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.kgithub];
    case "source-zotero-chinese-jsdelivr":
      return [z7DownloadUrls.jsdeliver, z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub];
    case "source-zotero-chinese-gitee":
      return [z7DownloadUrls.gitee, z7DownloadUrls.github, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub];
    default:
      return [z7DownloadUrls.github, z7DownloadUrls.gitee, z7DownloadUrls.jsdeliver, z7DownloadUrls.ghProxy, z7DownloadUrls.kgithub];
  }
}

export class AddonInfoManager {
  static shared = new AddonInfoManager();
  private constructor() {
    this.fetchAddonInfos();
  }

  get addonInfos() {
    const url = currentSource().api ?? customSourceApi();
    if (url in this.sourceInfos) {
      return this.sourceInfos[url];
    }
    return [];
  }

  private sourceInfos: { [key: string]: AddonInfo[] } = {};
  async fetchAddonInfos(forceRefresh = false) {
    const url = currentSource().api ?? customSourceApi();
    // 不在刷新，且不需要强制刷新
    if (!forceRefresh && this.addonInfos) {
      return this.addonInfos;
    }
    const infos = await AddonInfoAPI.fetchAddonInfos(url);
    if (infos.length > 0) {
      this.sourceInfos[url] = infos;
    }
    return this.addonInfos;
  }
}

class AddonInfoAPI {
  // fetch addon infos from source
  static async fetchAddonInfos(url: string): Promise<AddonInfo[]> {
    ztoolkit.log(`fetch addon infos from ${url}`);
    try {
      const response = await Zotero.HTTP.request("GET", url);
      const addons = JSON.parse(response.response) as AddonInfo[];
      const validAddons = addons.filter(addon => {
        const release = addon.releases.find(release => release.targetZoteroVersion === (ztoolkit.isZotero7() ? "7" : "6"));
        if (release?.xpiDownloadUrl?.github) { return true; }
        return false;
      })
      return validAddons.sort((a: AddonInfo, b: AddonInfo) => {
        return (b.star ?? 0) - (a.star ?? 0);
      });
    } catch (error) {
      ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
    }
    return [];
  }
}
