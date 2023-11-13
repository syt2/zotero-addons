import { LargePrefHelper } from "zotero-plugin-toolkit/dist/helpers/largePref";
import { AddonInfo } from "../modules/addonInfo";
import { Sources } from "./configuration";
import { config } from "../../package.json";

type addonIDConfig = [string, boolean]; // addonID, canAutoChange
export class addonIDMapManager {

  static shared = new addonIDMapManager();

  private autoUpdateDate = 0;
  private repoToAddonIDs: { [key: string]: addonIDConfig } = {};
  private largePrefHelper: LargePrefHelper = new LargePrefHelper("zotero.addons.idmap", config.prefsPrefix, "parser");

  constructor() {
    try {
      const addonIDMap = this.largePrefHelper.getValue('addonIDMap');
      this.autoUpdateDate = addonIDMap.updateDate ?? 0;
      this.repoToAddonIDs = addonIDMap.repoToAddonIDs ?? {};
    } catch (error) {
      this.autoUpdateDate = 0;
      this.repoToAddonIDs = {};
    }
  }

  get repoToAddonIDMap() {
    return this.repoToAddonIDs;
  }

  associateRepoWithID(repo: string, addonID: string, canAutoChange: boolean) {
    this.repoToAddonIDs[repo] = [addonID, canAutoChange];
    this.largePrefHelper.setValue('addonIDMap', {
      updateDate: this.autoUpdateDate,
      repoToAddonIDs: this.repoToAddonIDs,
    });
  }

  async fetchAddonIDIfNeed() {
    // 7天内不更新
    if (new Date().getTime() - this.autoUpdateDate < 1000 * 60 * 60 * 24 * 7) { return; }

    const urls = Sources.filter(source => {
      if (source.api) {
        return source.id === "source-zotero-scraper-github-backup" ||
          source.id === "source-zotero-scraper-ghproxy-backup" ||
          source.id === "source-zotero-scraper-jsdelivr-backup";
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
        this.largePrefHelper.setValue('addonIDMap', {
          updateDate: this.autoUpdateDate,
          repoToAddonIDs: this.repoToAddonIDs,
        });
        break;
      } catch (error) {
        ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
      }
    }

  }
}