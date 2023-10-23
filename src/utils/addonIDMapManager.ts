import { AddonInfo } from "../modules/addonInfo";
import { Sources } from "./configuration";
import { getPref, setPref } from "./prefs";

type addonIDConfig = [string, boolean]; // addonID, canAutoChange
export class addonIDMapManager {
  static shared = new addonIDMapManager();

  private autoUpdateDate: number = 0;
  private repoToAddonIDs: { [key: string]: addonIDConfig } = {};

  constructor() {
    try {
      const addonIDMapString = getPref('addonIDMap');
      if (typeof addonIDMapString === 'string') {
        const obj = JSON.parse(addonIDMapString);
        this.autoUpdateDate = obj.updateDate ?? 0;
        this.repoToAddonIDs = obj.repoToAddonIDs ?? {};
      }
    } catch (error) {
      this.autoUpdateDate = 0;
      this.repoToAddonIDs = {};
      ztoolkit.log(`read from addonIDMap failed: ${error}`);
    }
  }

  get repoToAddonIDMap() {
    return this.repoToAddonIDs;
  }

  associateRepoWithID(repo: string, addonID: string, canAutoChange: boolean) {
    this.repoToAddonIDs[repo] = [addonID, canAutoChange];
    setPref('addonIDMap', JSON.stringify({
      updateDate: this.autoUpdateDate,
      repoToAddonIDs: this.repoToAddonIDs,
    }));
  }

  async fetchAddonIDIfNeed() {
    // 7天内不更新
    if (new Date().getTime() - this.autoUpdateDate < 1000 * 60 * 60 * 24 * 7) { return; }

    const urls = Sources.filter(source => {
      if (source.api) {
        return source.id === "source-zotero-chinese-github-backup" ||
          source.id === "source-zotero-chinese-ghproxy-backup";
      }
    }).map(source => source.api!);

    for (const url of urls) {
      try {
        const response = await Zotero.HTTP.request("GET", url);
        const addons = JSON.parse(response.response) as AddonInfo[];
        for (const addon of addons.filter(addon => (addon.id?.length ?? 0) > 0)) {
          if (addon.repo in this.repoToAddonIDs && !this.repoToAddonIDs[addon.repo][1]) {
            continue;
          }
          this.repoToAddonIDs[addon.repo] = [addon.id!, true];
        }
        this.autoUpdateDate = new Date().getTime();
        setPref('addonIDMap', JSON.stringify({
          updateDate: this.autoUpdateDate,
          repoToAddonIDs: this.repoToAddonIDs,
        }));
        break;
      } catch (error) {
        ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
      }
    }

  }
}