/**
 * Addon installation service
 * Handles addon installation, uninstallation, and updates
 */

import { ProgressWindowHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getAddonManager } from "../utils/compat";
import type {
  AddonInfo,
  LocalAddon,
  IAddonInstall,
  IInstallListener,
} from "../types";

/**
 * Installation options
 */
export interface InstallOptions {
  name?: string;
  popWin?: boolean;
  startIndex?: number;
}

/**
 * Uninstall options
 */
export interface UninstallOptions {
  popConfirmDialog?: boolean;
  canRestore?: boolean;
}

/**
 * Get XPI source name from URL
 */
export function xpiURLSourceName(url: string): string {
  if (url.startsWith("https://github.com")) {
    return "source-github";
  } else if (url.startsWith("https://gitee.com")) {
    return "source-gitee";
  } else if (url.startsWith("https://ghproxy.com")) {
    return "source-ghproxy";
  } else if (url.startsWith("https://cdn.jsdelivr.net")) {
    return "source-jsdelivr";
  } else if (url.startsWith("https://kkgithub.com")) {
    return "source-kgithub";
  } else {
    return "source-others";
  }
}

/**
 * Extract filename from URL
 */
export function extractFileNameFromUrl(url: string): string | undefined {
  try {
    return new URL(url).pathname.split("/").pop();
  } catch {
    return undefined;
  }
}

/**
 * Undo uninstall add-on
 * @param addon The add-on to undo uninstall
 * @returns true if successful
 */
export async function undoUninstall(addon: LocalAddon): Promise<boolean> {
  try {
    addon.cancelUninstall();
    return true;
  } catch (error) {
    ztoolkit.log(`undo ${addon.name} failed: ${error}`);
    return false;
  }
}

/**
 * Uninstall an add-on
 * @param addon The add-on to uninstall
 * @param options Additional options
 */
export async function uninstall(
  addon: LocalAddon,
  options?: UninstallOptions,
): Promise<boolean> {
  if (options?.popConfirmDialog) {
    const confirm = await (Services as any).prompt.confirmEx(
      null as any,
      getString("uninstall-confirm-title"),
      getString("uninstall-confirm-message", {
        args: { name: addon.name ?? "Unknown" },
      }),
      Services.prompt.BUTTON_POS_0! * Services.prompt.BUTTON_TITLE_IS_STRING! +
        Services.prompt.BUTTON_POS_1! * Services.prompt.BUTTON_TITLE_CANCEL!,
      getString("uninstall-confirm-confirm"),
      "",
      "",
      "",
      { value: false },
    );
    if (confirm !== 0) {
      return false;
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
    popWin.show(3000);
    return true;
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
    popWin.show(3000);
    return false;
  }
}

/**
 * Install add-on from URL
 * @param url A url string or url string array with this add-on
 * @param options Additional options
 */
export async function installAddonFrom(
  url: string | string[],
  options?: InstallOptions,
): Promise<void> {
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
    sourceName = `${getString(sourceName as any)} ${startIndex + 1}`;
  } else {
    // @ts-expect-error ignore getString type check
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

  const actualInstall = async (): Promise<boolean> => {
    try {
      const install = await getAddonManager().getInstallForURL(xpiUrl, {
        telemetryInfo: { source: config.addonID },
      });
      return await new Promise<boolean>((resolve) => {
        const listener: IInstallListener = {
          onDownloadStarted: (install: IAddonInstall) => {
            if (!popWin) {
              return;
            }
            // Download progress
            (async () => {
              while (install.state === getAddonManager().STATE_DOWNLOADING) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                if (install.maxProgress > 0 && install.progress > 0) {
                  popWin.changeLine({
                    progress: (100 * install.progress) / install.maxProgress,
                  });
                }
              }
            })();
          },
          onDownloadEnded: (install: IAddonInstall) => {
            // Install failed, error will be reported elsewhere.
            if (!install.addon) {
              return;
            }

            if ((install.addon as any).appDisabled) {
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
              `download from ${xpiUrl} failed ${getAddonManager().errorToString(install.error)}`,
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
                getAddonManager().errorToString(install.error).slice(0, 45),
              );
            resolve(true);
          },
          onInstallFailed: () => {
            ztoolkit.log(
              `install failed ${getAddonManager().errorToString(install.error)} from ${xpiUrl}`,
            );
            install.removeListener(listener);
            popWin
              ?.changeLine({
                text: `${getString("install-failed", { args: { name: xpiName } })} [${getAddonManager().errorToString(install.error)}]`,
                type: "fail",
                progress: 0,
              })
              .addDescription(
                getAddonManager().errorToString(install.error).slice(0, 45),
              );
            resolve(true);
          },
          onInstallEnded: (install: IAddonInstall, addon: LocalAddon) => {
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
        install.addListener(listener as any);
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
