import { config } from "../../package.json";
import { getString } from "../utils/locale";
const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

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

export async function undoUninstall(addon: any) {
  try {
    addon.cancelUninstall();
  } catch (error) {
    ztoolkit.log(`undo ${addon.name} failed: ${error}`);
  }
}

export async function uninstall(addon: any, options?: { popConfirmDialog?: boolean, canRestore?: boolean }) {
  if (options?.popConfirmDialog) {
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
    await addon.uninstall(options?.canRestore);
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

export async function installAddonFrom(url: string | string[], options?: {
  name?: string,
  popWin?: boolean,
}): Promise<string | boolean> {
  let urls: string[] = [];
  if (typeof url === 'string') {
    urls = [url];
  } else {
    urls = url;
  }
  if (urls.length <= 0) { return false; }

  let popWin = undefined;
  if (options?.popWin) {
    popWin = new ztoolkit.ProgressWindow(config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    }).createLine({
      text: `${getString("installing")} ${options.name ?? extractFileNameFromUrl(urls[0])}`,
      type: "default",
      progress: 0,
    }).show(-1);
  }
  let result = false;
  for (const xpiUrl of urls) {
    if (!xpiUrl || xpiUrl.length <= 0) { continue; }
    try {
      const install = await AddonManager.getInstallForURL(xpiUrl);
      const addon = await install.install();
      result = addon.id;
      break;
    } catch (error) {
      ztoolkit.log(`install from ${xpiUrl} failed: ${error}`);
    }
  }
  if (options?.popWin && popWin) {
    popWin.changeLine({
      text: `${options.name ?? extractFileNameFromUrl(urls[0])} ${result ? getString("install-succeed") : getString("install-failed")}`,
      type: result ? "success" : "fail",
      progress: 0,
    });
    popWin.startCloseTimer(1000);
  }
  return result;
}

// 从url中提取文件名
export function extractFileNameFromUrl(url: string) {
  try {
    return new URL(url).pathname.split('/').pop();
  } catch {
    //
  }
}