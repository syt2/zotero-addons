/**
 * Table data transformer
 * Handles data transformation from AddonInfo to table row data
 */

import { getString } from "../../utils/locale";
import {
  AddonInfo,
  AddonInfoManager,
  InstallStatus,
  addonInstallStatus,
  addonReleaseInfo,
  addonReleaseTime,
  relatedAddons,
} from "../../modules/addonInfo";
import type {
  AssociatedAddonInfo,
  TableColumnID,
  ExtendedColumnOptions,
} from "../../types";

export class TableDataTransformer {
  /**
   * Transform addon infos to table row data
   */
  static async transformAddonInfos(
    force = false,
  ): Promise<AssociatedAddonInfo[]> {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    const relateAddons = await relatedAddons(addonInfos);

    return Promise.all(
      addonInfos.map(async (addonInfo) => {
        const result: Partial<Record<TableColumnID, string>> = {};
        const releaseInfo = addonReleaseInfo(addonInfo);
        result["menu-name"] = releaseInfo?.name ?? addonInfo.name;
        result["menu-desc"] =
          releaseInfo?.description ?? addonInfo.description ?? "";
        result["menu-star"] =
          addonInfo.stars === 0
            ? "0"
            : addonInfo.stars
              ? String(addonInfo.stars)
              : "?";
        const remoteVersion =
          releaseInfo?.xpiVersion?.toLowerCase().replace("v", "") ?? "";
        result["menu-remote-version"] = remoteVersion;
        result["menu-local-version"] = "";
        const releaseTime = addonReleaseTime(addonInfo);
        if (releaseTime) {
          result["menu-remote-update-time"] = releaseTime;
        }
        const relateAddon = relateAddons.find((addonPair) => {
          const addonID = addonReleaseInfo(addonInfo)?.id;
          if (addonID) {
            return addonID == addonPair[1].id;
          } else {
            return addonInfo.repo === addonPair[0].repo;
          }
        });
        result["menu-local-version"] = relateAddon?.[1].version ?? "-";
        const installState = await addonInstallStatus(addonInfo, relateAddon);
        result["menu-install-state"] =
          TableDataTransformer.installStatusDescription(installState);
        return [addonInfo, result] as AssociatedAddonInfo;
      }),
    );
  }

  /**
   * Sort addon infos by column
   */
  static sortAddonInfos(
    addonInfos: AssociatedAddonInfo[],
    sortColumn: ExtendedColumnOptions | undefined,
  ): AssociatedAddonInfo[] {
    if (!sortColumn) {
      return addonInfos;
    }

    const stateMap = TableDataTransformer.buildStateMap();
    const sortOrder = (sortColumn as any).sortDirection;

    return addonInfos.slice().sort((infoA, infoB) => {
      const [a, b] = [infoA[0], infoB[0]];
      let l, r;
      switch (sortColumn.dataKey) {
        case "menu-name":
          [l, r] = [
            (addonReleaseInfo(a)?.name ?? a.name ?? "").toLowerCase(),
            (addonReleaseInfo(b)?.name ?? b.name ?? "").toLowerCase(),
          ];
          if (l == r) {
            break;
          }
          return l > r ? sortOrder : -sortOrder;
        case "menu-star":
          [l, r] = [a.stars ?? 0, b.stars ?? 0];
          if (l == r) {
            break;
          }
          return l > r ? sortOrder : -sortOrder;
        case "menu-install-state":
          [l, r] = [
            stateMap[
              infoA[1]["menu-install-state"] ??
                TableDataTransformer.installStatusDescription(
                  InstallStatus.unknown,
                )
            ] ?? 0,
            stateMap[
              infoB[1]["menu-install-state"] ??
                TableDataTransformer.installStatusDescription(
                  InstallStatus.unknown,
                )
            ] ?? 0,
          ];
          if (l === r) {
            break;
          }
          if (l === 0) {
            return -1;
          }
          if (r === 0) {
            return 1;
          }
          return l > r ? sortOrder : -sortOrder;
        case "menu-remote-update-time":
          [l, r] = [
            addonReleaseInfo(a)?.releaseDate ?? "",
            addonReleaseInfo(b)?.releaseDate ?? "",
          ];
          if (l == r) {
            break;
          }
          return l > r ? sortOrder : -sortOrder;
      }
      return 0;
    });
  }

  /**
   * Get install status description string
   */
  static installStatusDescription(status: InstallStatus): string {
    switch (status) {
      case InstallStatus.unknown:
        return getString("state-unknown");
      case InstallStatus.notInstalled:
        return getString("state-notInstalled");
      case InstallStatus.normal:
        return getString("state-installed");
      case InstallStatus.updatable:
        return getString("state-outdate");
      case InstallStatus.disabled:
        return getString("state-disabled");
      case InstallStatus.incompatible:
        return getString("state-uncompatible");
      case InstallStatus.pendingUninstall:
        return getString("state-pendingUninstall");
    }
  }

  /**
   * Build state map for sorting
   */
  private static buildStateMap(): Record<string, number> {
    const stateMap: Record<string, number> = {};
    const installStates: InstallStatus[] = [
      InstallStatus.unknown,
      InstallStatus.notInstalled,
      InstallStatus.incompatible,
      InstallStatus.disabled,
      InstallStatus.pendingUninstall,
      InstallStatus.normal,
      InstallStatus.updatable,
    ];
    installStates.forEach(
      (status, idx) =>
        (stateMap[TableDataTransformer.installStatusDescription(status)] = idx),
    );
    return stateMap;
  }
}
