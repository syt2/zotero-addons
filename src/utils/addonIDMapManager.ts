import { getPref, setPref } from "./prefs";

type addonIDConfig = [string, boolean]; // addonID, canAutoChange
export class addonIDMapManager {
  static shared = new addonIDMapManager();

  private autoUpdateDate = 0;
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
}