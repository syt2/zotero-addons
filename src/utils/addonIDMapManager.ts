import { LargePrefHelper } from "zotero-plugin-toolkit/dist/helpers/largePref";
import { config } from "../../package.json";

// 为避免存在无id的插件信息，在每次安装插件后，都会保存下对应插件的id
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
}