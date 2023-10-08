import { config } from "../../package.json";

async function updateFrom(url?: string) {
  const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
  const response = await Zotero.HTTP.request('GET', url ?? config.releasePage, {
    responseType: 'arraybuffer',
  });
  const xpiDownloadPath = PathUtils.join(
    PathUtils.tempDir,
    `${config.addonName}.xpi`,
  );
  await IOUtils.write(xpiDownloadPath, new Uint8Array(response.response));
  const xpiFile = Zotero.File.pathToFile(xpiDownloadPath);
  const xpiInstaller = await AddonManager.getInstallForFile(xpiFile);
  xpiInstaller.install();
}

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
        await updateFrom(addonUpdateInfo['addons'][config.addonID]['updates'][0]['update_link']);
    }
  } catch (error) {
    ztoolkit.log(`autoupdate self failed: ${error}`);
  }
}

export function compareVersion(versionA: string, versionB: string): number {
  const partsA = versionA.toLowerCase().replace('v', '').split('.')
  const partsB = versionB.toLowerCase().replace('v', '').split('.')

  for (let i = 0; i < 3; i++) {
      if (partsA[i] < partsB[i]) {
          return -1;
      } else if (partsA[i] > partsB[i]) {
          return 1;
      }
  }
  return 0; // 版本号相同
}