export interface AddonInfo {
  [key: string]: string | number | undefined;
  name: string;
  id: string;
  homepage?: string;
  description?: string;
  download_link?: string;
  start_count?: number;
}

export class AddonInfoManager {
  static shared = new AddonInfoManager();
  private _fetching = false;
  private _addonInfos: AddonInfo[] = [];
  private constructor() {
    this.fetchAddonInfos();
  }

  get addonInfos() {
    return this._addonInfos;
  }

  async fetchAddonInfos(forceRefresh = false) {
    // 不在刷新，且不需要强制刷新
    if (!forceRefresh && !this._fetching) {
      return this.addonInfos;
    }
    // 正在刷新，直到刷新成功后返回
    if (this._fetching) {
      while (this._fetching) {
        await new Promise((reslove) => setTimeout(reslove, 500));
      }
      return this.addonInfos;
    }
    // 不在刷新，则置为刷新态并刷新
    this._fetching = true;
    this._addonInfos = await AddonInfoAPI.fetchAddonInfos();
    this._fetching = false;
    return this.addonInfos;
  }
}

export class AddonInfoAPI {
  // fetch addon infos from source
  static async fetchAddonInfos(): Promise<AddonInfo[]> {
    const url =
      "https://github.com/syt2/zotero-addons-scraper/releases/latest/download/addon_infos.json";
    try {
      const response = await Zotero.HTTP.request("GET", url);
      return JSON.parse(response.response);
    } catch (error) {
      ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
    }
    return [];
  }
}
