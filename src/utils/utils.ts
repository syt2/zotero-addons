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

export async function installAddonFrom(url: string, xpiName: string, forceInstall = false): Promise<string | undefined> {
  try {
    const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
    const response = await Zotero.HTTP.request('GET', url, {
      responseType: 'arraybuffer',
    });
    const xpiDownloadPath = PathUtils.join(
      PathUtils.tempDir,
      `${xpiName}.xpi`,
    );
    await IOUtils.write(xpiDownloadPath, new Uint8Array(response.response));
    const xpiFile = Zotero.File.pathToFile(xpiDownloadPath);
    const xpiInstaller = await AddonManager.getInstallForFile(xpiFile);

     // url或插件无效
    if (!xpiInstaller.addon 
      || !xpiInstaller.addon.isCompatible 
      || !xpiInstaller.addon.isPlatformCompatible 
      || !xpiInstaller.addon.strictCompatibility) { 
      return; 
    }

    // 非强制安装，下载插件后检查版本号，如果已有版本>=现存版本，跳过
    if (!forceInstall && 
      xpiInstaller.existingAddon &&
      xpiInstaller.existingAddon.version && 
      xpiInstaller.addon.version && 
      compareVersion(xpiInstaller.existingAddon.version, xpiInstaller.addon.version) >= 0) {
      return xpiInstaller.addon.id;
    }
    xpiInstaller.install();
    return xpiInstaller.addon.id;
  } catch (error) {
    ztoolkit.log(`install addon ${xpiName} from ${url} failed: ${error}`);
    return;
  }
}