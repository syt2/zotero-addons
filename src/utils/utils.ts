import { ProgressWindowHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { xpiURLSourceName } from "../modules/addonInfo";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const { AddonManager } = ChromeUtils.import(
  "resource://gre/modules/AddonManager.jsm",
);

/**
 * Undo uninstall add-on
 * @param addon The add-on to undo uninstall
 */
export async function undoUninstall(addon: any) {
  try {
    addon.cancelUninstall();
  } catch (error) {
    ztoolkit.log(`undo ${addon.name} failed: ${error}`);
  }
}

/**
 * Uninstall an add-on
 * @param addon The add-on to uninstall
 * @param options Additional options
 * @param options.popConfirmDialog Present a comfirm dialog berfore install
 * @param options.canRestore Enable undo uninstall after uninstall
 */
export async function uninstall(
  addon: any,
  options?: { popConfirmDialog?: boolean; canRestore?: boolean },
) {
  if (options?.popConfirmDialog) {
    const confirm = await (Services as any).prompt.confirmEx(
      null,
      getString("uninstall-confirm-title"),
      getString("uninstall-confirm-message", {
        args: { name: addon.name ?? "Unknown" },
      }),
      Services.prompt.BUTTON_POS_0! *
      Services.prompt.BUTTON_TITLE_IS_STRING! +
      Services.prompt.BUTTON_POS_1! *
      Services.prompt.BUTTON_TITLE_CANCEL!,
      getString("uninstall-confirm-confirm"),
      null,
      null,
      "",
      {},
    );
    if (confirm !== 0) {
      return;
    }
  }

  const popWin = new ztoolkit.ProgressWindow(getString("addon-name"), {
    closeOnClick: true,
    closeTime: 3000,
  });
  try {
    await addon.uninstall(options?.canRestore);
    popWin.createLine({
      text: getString("uninstall-succeed", {
        args: { name: addon.name ?? "Unknown" },
      }),
      type: `success`,
      progress: 0,
    });
  } catch (error) {
    ztoolkit.log(`uninstall ${addon.name} failed: ${error}`);
    popWin
      .createLine({
        text: getString("uninstall-failed", {
          args: { name: addon.name ?? "Unknown" },
        }),
        type: `fail`,
        progress: 0,
      })
      .addDescription(`${error}`.slice(0, 45));
  }
  popWin.show(3000);
}

/**
 * install add-on from url
 * @param url A url string or url string array with this add-on
 * @param options Additional options
 * @param options.name The add-on name
 * @param options.popWin Present a progress window during downloading and installing
 * @param options.startIndex Specify which URL to use for recursion, usually not necessary to specify when calling
 */
export async function installAddonFrom(
  url: string | string[],
  options?: {
    name?: string;
    popWin?: boolean;
    startIndex?: number;
  },
) {
  if (!Array.isArray(url)) {
    url = [url];
  }
  const startIndex = options?.startIndex ?? 0;
  if (startIndex >= url.length || startIndex < 0) {
    return;
  }
  const xpiUrl = url[startIndex];
  const xpiName = options?.name ?? extractFileNameFromUrl(xpiUrl) ?? "Unknown";
  let sourceName = xpiURLSourceName(xpiUrl);
  if (sourceName === "source-others") {
    sourceName = `${getString(sourceName)} ${startIndex + 1}`;
  } else {
    // @ts-ignore
    sourceName = getString(sourceName);
  }
  const source = getString("downloading-source", {
    args: { name: sourceName },
  });

  let popWin: ProgressWindowHelper | undefined = undefined;
  if (options?.popWin) {
    popWin = new ztoolkit.ProgressWindow(getString("addon-name"), {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: getString("downloading", {
          args: { name: xpiName + ` (${source})` },
        }),
        type: "default",
        progress: 0,
      })
      .show(-1);
  }

  // reference in gecko
  // > getInstallForURL:
  // > https://github.com/mozilla/gecko-dev/blob/f170bc26fdcfda53a270dc4f257202e62f4b781f/toolkit/mozapps/extensions/internal/XPIInstall.jsm#L4418
  // > DownloadAddonInstall:
  // > https://github.com/mozilla/gecko-dev/blob/f170bc26fdcfda53a270dc4f257202e62f4b781f/toolkit/mozapps/extensions/internal/XPIInstall.jsm#L2225
  // > installAddonFromURL example:
  // > https://github.com/mozilla/gecko-dev/blob/fc757816ed9d8f8552dbcb96c1f89f8108f37b2a/browser/components/enterprisepolicies/Policies.sys.mjs#L2618
  // > AddonManager states and error types:
  // > `https://github.com/mozilla/gecko-dev/blob/fc757816ed9d8f8552dbcb96c1f89f8108f37b2a/toolkit/mozapps/extensions/AddonManager.sys.mjs#L3993`
  const actualInstall = async () => {
    try {
      const install = await AddonManager.getInstallForURL(xpiUrl, {
        telemetryInfo: { source: config.addonID },
      });
      return await new Promise<boolean>((resolve) => {
        const listener = {
          onDownloadStarted: (install: any) => {
            if (!popWin) {
              return;
            }
            // 下载进度条
            (async () => {
              while (install.state === AddonManager.STATE_DOWNLOADING) {
                await Zotero.Promise.delay(200);
                if (install.maxProgress > 0 && install.progress > 0) {
                  popWin.changeLine({
                    progress: (100 * install.progress) / install.maxProgress,
                  });
                }
              }
            })();
          },
          onDownloadEnded: (install: any) => {
            // Install failed, error will be reported elsewhere.
            if (!install.addon) {
              return;
            }

            if (install.addon.appDisabled) {
              ztoolkit.log(`Incompatible add-on from ${xpiUrl}`);
              install.removeListener(listener);
              install.cancel();
              popWin?.changeLine({
                text: `${getString("install-failed", { args: { name: xpiName } })} [${getString("install-failed-uncompatible")}]`,
                type: "fail",
                progress: 0,
              });
              resolve(false);
              return;
            }
            popWin?.changeLine({
              text: getString("installing", { args: { name: xpiName } }),
              type: "default",
              progress: 0,
            });
          },
          onDownloadFailed: () => {
            ztoolkit.log(
              `download from ${xpiUrl} failed ${AddonManager.errorToString(install.error)}`,
            );
            install.removeListener(listener);
            popWin
              ?.changeLine({
                text: getString("download-failed", {
                  args: { name: xpiName + ` (${source})` },
                }),
                type: "fail",
                progress: 0,
              })
              .addDescription(
                AddonManager.errorToString(install.error).slice(0, 45),
              );
            resolve(true);
          },
          onInstallFailed: () => {
            ztoolkit.log(
              `install failed ${AddonManager.errorToString(install.error)} from ${xpiUrl}`,
            );
            install.removeListener(listener);
            popWin
              ?.changeLine({
                text: `${getString("install-failed", { args: { name: xpiName } })} [${AddonManager.errorToString(install.error)}]`,
                type: "fail",
                progress: 0,
              })
              .addDescription(
                AddonManager.errorToString(install.error).slice(0, 45),
              );
            resolve(true);
          },
          onInstallEnded: (install: any, addon: any) => {
            install.removeListener(listener);
            ztoolkit.log(`install success`);
            popWin?.changeLine({
              text: getString("install-succeed", { args: { name: xpiName } }),
              type: "success",
              progress: 0,
            });
            resolve(false);
          },
        };
        install.addListener(listener);
        // install.install();
        install.install();
      });
    } catch (e) {
      ztoolkit.log(`install from ${xpiUrl} failed: ${e}`);
      popWin
        ?.changeLine({
          text: getString("install-failed", { args: { name: xpiName } }),
          type: "fail",
          progress: 0,
        })
        .addDescription(`${e}`.slice(0, 45));
      return true;
    }
  };

  const doNextUrlInstall = await actualInstall();
  popWin?.startCloseTimer(2000);
  if (doNextUrlInstall && Array.isArray(url) && url.length > 1) {
    options = options ?? {};
    options.startIndex = startIndex + 1;
    return await installAddonFrom(url, options);
  }
}

/**
 * extract file name from url
 * @param url url
 * @returns filename
 */
export function extractFileNameFromUrl(url: string) {
  try {
    return new URL(url).pathname.split("/").pop();
  } catch {
    //
  }
}
