/**
 * Addon installation service
 * Handles addon installation, uninstallation, and updates
 */

import { ProgressWindowHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getAddonManager } from "../utils/compat";
import { resolveProgressWindowOwner } from "../utils/window";
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
  /** Time without download progress before trying the next source. */
  stallTimeoutMs?: number;
  /** Sampling window used to detect a persistently slow source. */
  slowSpeedWindowMs?: number;
  /** Minimum average speed before trying the next source. */
  minimumBytesPerSecond?: number;
  /** Owner for dependent progress windows. */
  window?: Window;
}

const DEFAULT_STALL_TIMEOUT_MS = 8000;
const DEFAULT_SLOW_SPEED_WINDOW_MS = 12000;
const DEFAULT_MINIMUM_BYTES_PER_SECOND = 16 * 1024;
const DOWNLOAD_PROGRESS_POLL_INTERVAL_MS = 500;

export type DownloadFailoverReason = "stalled" | "too-slow" | undefined;

/**
 * Decide whether a download should move to the next mirror.
 *
 * The final source is never cancelled for being slow: keeping a slow last
 * resort is better than turning a usable download into a hard failure.
 */
export function downloadFailoverReason(options: {
  hasFallback: boolean;
  idleForMs: number;
  sampleDurationMs: number;
  sampleBytes: number;
  stallTimeoutMs?: number;
  slowSpeedWindowMs?: number;
  minimumBytesPerSecond?: number;
}): DownloadFailoverReason {
  if (!options.hasFallback) {
    return undefined;
  }

  const stallTimeoutMs = options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;
  if (options.idleForMs >= stallTimeoutMs) {
    return "stalled";
  }

  const slowSpeedWindowMs =
    options.slowSpeedWindowMs ?? DEFAULT_SLOW_SPEED_WINDOW_MS;
  if (options.sampleDurationMs < slowSpeedWindowMs) {
    return undefined;
  }

  const minimumBytesPerSecond =
    options.minimumBytesPerSecond ?? DEFAULT_MINIMUM_BYTES_PER_SECOND;
  const bytesPerSecond =
    (Math.max(0, options.sampleBytes) * 1000) / options.sampleDurationMs;
  return bytesPerSecond < minimumBytesPerSecond ? "too-slow" : undefined;
}

/**
 * Uninstall options
 */
export interface UninstallOptions {
  popConfirmDialog?: boolean;
  canRestore?: boolean;
  /** Owner for dependent progress windows. */
  window?: Window;
}

/**
 * Get XPI source name from URL
 */
export function xpiURLSourceName(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "source-others";
  }
  if (hostname === "github.com") {
    return "source-github";
  } else if (hostname === "gitee.com") {
    return "source-gitee";
  } else if (hostname === "ghproxy.com" || hostname === "gh-proxy.org") {
    return "source-ghproxy";
  } else if (hostname === "ghfast.top") {
    return "source-ghfast";
  } else if (hostname === "ghproxy.net") {
    return "source-ghproxynet";
  } else if (hostname === "cdn.jsdelivr.net") {
    return "source-jsdelivr";
  } else if (hostname === "kkgithub.com") {
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
  const progressWindowOwner = resolveProgressWindowOwner(options?.window);
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
    window: progressWindowOwner,
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
  const urls = Array.isArray(url) ? url : [url];
  const progressWindowOwner = resolveProgressWindowOwner(options?.window);
  const startIndex = options?.startIndex ?? 0;
  if (startIndex >= urls.length || startIndex < 0) {
    return;
  }
  const xpiUrl = urls[startIndex];
  const hasFallback = startIndex + 1 < urls.length;
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
      window: progressWindowOwner,
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
        let settled = false;
        const finish = (tryNextSource: boolean) => {
          if (settled) {
            return false;
          }
          settled = true;
          install.removeListener(listener);
          resolve(tryNextSource);
          return true;
        };
        const cancelForFailover = (
          reason: Exclude<DownloadFailoverReason, undefined>,
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          install.removeListener(listener);
          ztoolkit.log(
            `download from ${xpiUrl} ${reason}; trying the next source`,
          );
          popWin
            ?.changeLine({
              text: getString("download-failed", {
                args: { name: xpiName + ` (${source})` },
              }),
              type: "fail",
              progress: 0,
            })
            .addDescription(reason);
          try {
            install.cancel();
          } catch (error) {
            ztoolkit.log(`cancel download from ${xpiUrl} failed: ${error}`);
          }
          resolve(true);
        };
        const listener: IInstallListener = {
          onDownloadStarted: (install: IAddonInstall) => {
            // Track progress independently of the progress window so a stalled
            // background install can also fail over.
            (async () => {
              let lastProgress = Math.max(0, install.progress);
              let lastProgressAt = Date.now();
              let sampleStartedAt = lastProgressAt;
              let sampleStartProgress = lastProgress;

              while (
                !settled &&
                install.state === getAddonManager().STATE_DOWNLOADING
              ) {
                await new Promise((resolve) =>
                  setTimeout(resolve, DOWNLOAD_PROGRESS_POLL_INTERVAL_MS),
                );
                if (
                  settled ||
                  install.state !== getAddonManager().STATE_DOWNLOADING
                ) {
                  break;
                }

                const now = Date.now();
                const progress = Math.max(0, install.progress);
                if (progress > lastProgress) {
                  lastProgress = progress;
                  lastProgressAt = now;
                }
                if (install.maxProgress > 0 && install.progress > 0) {
                  popWin?.changeLine({
                    progress: (100 * install.progress) / install.maxProgress,
                  });
                }

                // Do not cancel between the final byte and Zotero's
                // onDownloadEnded notification.
                if (
                  install.maxProgress > 0 &&
                  progress >= install.maxProgress
                ) {
                  continue;
                }

                const reason = downloadFailoverReason({
                  hasFallback,
                  idleForMs: now - lastProgressAt,
                  sampleDurationMs: now - sampleStartedAt,
                  sampleBytes: progress - sampleStartProgress,
                  stallTimeoutMs: options?.stallTimeoutMs,
                  slowSpeedWindowMs: options?.slowSpeedWindowMs,
                  minimumBytesPerSecond: options?.minimumBytesPerSecond,
                });
                if (reason) {
                  cancelForFailover(reason);
                  break;
                }

                const slowSpeedWindowMs =
                  options?.slowSpeedWindowMs ?? DEFAULT_SLOW_SPEED_WINDOW_MS;
                if (now - sampleStartedAt >= slowSpeedWindowMs) {
                  sampleStartedAt = now;
                  sampleStartProgress = progress;
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
              finish(false);
              install.cancel();
              popWin?.changeLine({
                text: `${getString("install-failed", { args: { name: xpiName } })} [${getString("install-failed-uncompatible")}]`,
                type: "fail",
                progress: 0,
              });
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
            finish(true);
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
          },
          onInstallFailed: () => {
            ztoolkit.log(
              `install failed ${getAddonManager().errorToString(install.error)} from ${xpiUrl}`,
            );
            finish(true);
            popWin
              ?.changeLine({
                text: `${getString("install-failed", { args: { name: xpiName } })} [${getAddonManager().errorToString(install.error)}]`,
                type: "fail",
                progress: 0,
              })
              .addDescription(
                getAddonManager().errorToString(install.error).slice(0, 45),
              );
          },
          onInstallEnded: (install: IAddonInstall, addon: LocalAddon) => {
            finish(false);
            ztoolkit.log(`install success`);
            popWin?.changeLine({
              text: getString("install-succeed", { args: { name: xpiName } }),
              type: "success",
              progress: 0,
            });
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
  if (doNextUrlInstall && urls.length > 1) {
    const nextOptions = {
      ...options,
      startIndex: startIndex + 1,
      window: progressWindowOwner,
    };
    return await installAddonFrom(urls, nextOptions);
  }
}
