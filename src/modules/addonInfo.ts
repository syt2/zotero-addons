

export interface AddonObject {
  // addon name
  name: string;
  // addon id
  id: string;

  // addon github full name
  githubRepos?: string;

  // addon main page
  page?: string;
  // addon description
  description?: string;
  // addon download link
  downloadLink?: string;
}


export interface AddonInfo {
  [key: string]: string | number | undefined;
  name: string;
  id: string;
  page?: string;
  description?: string;
  downloadLink?: string;
  startCount?: number;
}

export class AddonInfoManager {
  static shared = new AddonInfoManager();
  private _fetching = false;
  private _addonInfos: AddonInfo[] = []
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
        await new Promise(reslove => setTimeout(reslove, 500));
      }
      return this.addonInfos;
    }
    // 不在刷新，则置为刷新态并刷新
    this._fetching = true;
    this._addonInfos = await AddonInfoAPI.getAddonInfos();
    this._fetching = false;
    return this.addonInfos;
  }
  
}

export class AddonInfoAPI { 
  static async getAddonInfos() {
    const addonObjects = await this.fetchAddonObjects();
    return this.parseAddonObjects(addonObjects);
  }

  // fetch addon infos from source 
  private static async fetchAddonObjects(): Promise<AddonObject[]> {
    return [
      {
        name: "Zotero Tag",
        id: "zoterotag@euclpts.com",
        githubRepos: "windingwind/zotero-actions-tags",
      }, 
      {
        name: "zotfile",
        id: "zotfile@columbia.edu",
        githubRepos: "jlegewie/zotfile",
      },
      {
        name: "Better BibTeX",
        id: "better-bibtex@iris-advies.com",
        githubRepos: "retorquere/zotero-better-bibtex",
      },
      {
        name: "zotero-pdf-preview",
        id: "pdfpreview@windingwind.com",
        githubRepos: "windingwind/zotero-pdf-preview",
      },
      {
        name: "Scholaread",
        id: "shenyutao@zotero.scholaread.com",
        page: "https://www.scholaread.com/settings",
        description: "scholaread Addon for Zotero",
        downloadLink: "https://www.scholaread.com/assets/zotero/zotero-scholaread.xpi",
      }
    ]
  }
  
  private static async parseAddonObjects(addonObjects: AddonObject[]) {
    const results: AddonInfo[] = [];
    for (const addonObject of addonObjects) {
      const addonInfo: AddonInfo = {
        name: addonObject.name,
        id: addonObject.id,
        page: addonObject.page,
        description: addonObject.description,
        downloadLink: addonObject.downloadLink,
      }
      if (addonObject.githubRepos) {
        addonObject.page = `https://github.com/${addonObject.githubRepos}`;
        try {
          const response = await Zotero.HTTP.request("GET", `https://api.github.com/repos/${addonObject.githubRepos}`);
          const githubInfo = JSON.parse(response.response);
          if (!addonInfo.description && githubInfo.description) {
            addonInfo.description = githubInfo.description;
          }
          if (!addonInfo.startCount && githubInfo.watchers) {
            addonInfo.startCount = githubInfo.watchers;
          }
          try {
            const response = await Zotero.HTTP.request("GET", `https://api.github.com/repos/${addonObject.githubRepos}/releases/latest`);
            const releaseInfo = JSON.parse(response.response);
            if (!addonInfo.downloadLink) {
              for (const asset of releaseInfo.assets) {
                if (asset.name.endsWith('.xpi')) {
                  addonInfo.downloadLink = asset.browser_download_url;
                  break;
                }
              }
            }
          } catch (error: any) {
            ztoolkit.log(`fetch ${addonObject.name} release info from https://api.github.com/repos/${addonObject.githubRepos}/releases/latest failed: ${error}`);
          }
        } catch (error: any) {
          ztoolkit.log(`fetch ${addonObject.name} from https://api.github.com/repos/${addonObject.githubRepos} failed: ${error}`);
        }
      }
      results.push(addonInfo);
    }
    return results;
  }
}