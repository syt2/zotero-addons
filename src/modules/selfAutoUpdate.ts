import { config } from "../../package.json";
import { compareVersion, installAddonFrom } from "../utils/utils";

export async function updateSelfIfNeed() {
  const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
  const addon = await AddonManager.getAddonByID(config.addonID);
  try {
    const response = await Zotero.HTTP.request('GET', config.updateJSON);
    const addonUpdateInfo = JSON.parse(response.response);
    if (addonUpdateInfo['addons'] 
      && addonUpdateInfo['addons'][config.addonID]
      && addonUpdateInfo['addons'][config.addonID]['updates']
      && addonUpdateInfo['addons'][config.addonID]['updates'].length >= 0
      && addonUpdateInfo['addons'][config.addonID]['updates'][0]['version']
      && compareVersion(addon.version, addonUpdateInfo['addons'][config.addonID]['updates'][0]['version']) < 0) {
      await installAddonFrom(addonUpdateInfo['addons'][config.addonID]['updates'][0]['update_link'], config.addonName, false);
    }
  } catch (error) {
    ztoolkit.log(`autoupdate self failed: ${error}`);
  }
}