/**
 * Table actions
 * Handles addon install/uninstall/enable operations
 */

import {
  AddonInfo,
  addonReleaseInfo,
  relatedAddons,
  xpiDownloadUrls,
} from "../../modules/addonInfo";
import { installAddonFrom, uninstall, undoUninstall } from "../../utils/utils";

export class TableActions {
  /**
   * Install addons from remote source
   */
  static async installAddons(
    addons: AddonInfo[],
    options?: {
      popWin?: boolean;
    },
  ): Promise<void> {
    await Promise.all(
      addons.map(async (addon) => {
        const urls = xpiDownloadUrls(addon).filter((x) => {
          return (x?.length ?? 0) > 0;
        }) as string[];
        await installAddonFrom(urls, {
          name: addonReleaseInfo(addon)?.name ?? addon.name,
          popWin: options?.popWin,
        });
      }),
    );
  }

  /**
   * Uninstall addons
   */
  static async uninstallAddons(
    addons: AddonInfo[],
    popConfirmDialog: boolean,
  ): Promise<void> {
    const relatedAddon = await relatedAddons(addons);
    for (const [_addonInfo, addon] of relatedAddon) {
      await uninstall(addon, { popConfirmDialog: popConfirmDialog });
    }
  }

  /**
   * Undo addon uninstallation
   */
  static async undoUninstallAddons(addons: AddonInfo[]): Promise<void> {
    const relatedAddon = await relatedAddons(addons);
    for (const [_addonInfo, addon] of relatedAddon) {
      await undoUninstall(addon);
    }
  }

  /**
   * Enable or disable addons
   */
  static async enableAddons(
    addons: AddonInfo[],
    enable: boolean,
  ): Promise<void> {
    const relatedAddon = await relatedAddons(addons);
    for (const [_addonInfo, addon] of relatedAddon) {
      if (enable) {
        await addon.enable();
      } else {
        await addon.disable();
      }
    }
  }
}
