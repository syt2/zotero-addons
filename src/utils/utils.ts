import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { addonIDMapManager } from "./addonIDMapManager";
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");

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

export async function uninstall(addon: any, popConfirmDialog = true) {
  if (popConfirmDialog) {
    const confirm = await Services.prompt.confirmEx(
      null,
      getString('uninstall-confirm-title'),
      getString('uninstall-confirm-message') + (addon.name ? '\n' + addon.name : ''),
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL,
      getString('uninstall-confirm-confirm'),
      null,
      null,
      "",
      {}
    );
    if (confirm !== 0) {
      return;
    }
  }
  try {
    await addon.uninstall(true);
    new ztoolkit.ProgressWindow(config.addonName, {
      closeOnClick: true,
      closeTime: 3000,
    }).createLine({
      text: getString('uninstall-succeed'),
      type: `success`,
      progress: 0,
    }).show(3000);
  } catch (error) {
    ztoolkit.log(`uninstall ${addon.name} failed: ${error}`);
    new ztoolkit.ProgressWindow(config.addonName, {
      closeOnClick: true,
      closeTime: 3000,
    }).createLine({
      text: getString('uninstall-failed') + ' ' + `${error}`,
      type: `fail`,
      progress: 0,
    }).show(3000);
  }
}

export async function installAddonWithPopWindowFrom(url: string | string[], name: string, repo: string | undefined = undefined, forceInstall = false) {
  const popWin = new ztoolkit.ProgressWindow(config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  }).createLine({
    text: `${getString("installing")} ${name}`,
    type: "default",
    progress: 0,
  }).show(-1);

  const installSucceed = await installAddonFrom(url, name, repo, forceInstall);

  popWin.changeLine({
    text: `${name} ${installSucceed ? getString("install-succeed") : getString("install-failed")}`,
    type: installSucceed ? "success" : "fail",
    progress: 0,
  });
  popWin.startCloseTimer(1000);
}


export async function installAddonFrom(url: string | string[], name: string | undefined = undefined, repo: string | undefined = undefined, forceInstall = false) {
  let urls: string[] = [];
  if (typeof url === 'string') {
    urls = [url];
  } else {
    urls = url;
  }
  let installSucceed = false;
  for (const xpiUrl of urls) {
    if (!xpiUrl || xpiUrl.length <= 0) { continue; }
    try {
      const addonID = await pInstallAddonFrom(xpiUrl, name, forceInstall);
      if (addonID) {
        if (repo && repo.length) {
          addonIDMapManager.shared.associateRepoWithID(repo, addonID, false);
        }
        installSucceed = true;
        break;
      }
    } catch (error) {
      ztoolkit.log(`install from ${xpiUrl} failed: ${error}`);
    }
  }
  return installSucceed;
}


async function pInstallAddonFrom(url: string, name?: string, forceInstall = false): Promise<string | undefined> {
  const xpiName = name ?? extractFileNameFromUrl(url) ?? "tmp.xpi";
  Zotero.log(`install ${xpiName} from ${url}`);
  try {
    Zotero.log('000');
    const response = await Zotero.HTTP.request('GET', url, {
      responseType: 'arraybuffer',
    });
    Zotero.log('123');
    const xpiDownloadPath = OS.Path.join(
      OS.Constants.Path.tmpDir,
      xpiName,
    );
    Zotero.log('1234');
    await OS.File.writeAtomic(xpiDownloadPath, response.response);
    Zotero.log('1235');
    const xpiFile = Zotero.File.pathToFile(xpiDownloadPath);
    Zotero.log('1236');
    const xpiInstaller = await AddonManager.getInstallForFile(xpiFile);
    Zotero.log('1111');

    // url或插件无效
    if (!xpiInstaller.addon
      || !xpiInstaller.addon.isCompatible
      || !xpiInstaller.addon.isPlatformCompatible) {
      return;
    }
    Zotero.log('2222');

    // 非强制安装，下载插件后检查版本号，如果已有版本>=现存版本，跳过
    if (!forceInstall &&
      xpiInstaller.existingAddon &&
      xpiInstaller.existingAddon.version &&
      xpiInstaller.addon.version &&
      compareVersion(xpiInstaller.existingAddon.version, xpiInstaller.addon.version) >= 0) {
      return xpiInstaller.addon.id;
    }
    Zotero.log('3333');
    xpiInstaller.install();
    Zotero.log('4444');
    Zotero.log(xpiInstaller.addon.id);
    return xpiInstaller.addon.id;
  } catch (error) {
    ztoolkit.log(`install addon ${xpiName} from ${url} failed: ${error}`);
    return;
  }
}

export function extractFileNameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName || undefined;
  } catch (error) {
    return;
  }
}