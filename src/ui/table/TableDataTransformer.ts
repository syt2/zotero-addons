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
  addonReleaseTime,
  displayAddonReleaseInfo,
  relatedAddons,
} from "../../modules/addonInfo";
import type {
  AssociatedAddonInfo,
  TableColumnID,
  ExtendedColumnOptions,
} from "../../types";
import { withTimeout } from "../../utils/async";

const RELATED_ADDONS_TIMEOUT_MS = 3000;

export class TableDataTransformer {
  static readonly recommendedTag = "__recommended__";
  static readonly recommendedTagLabel = "❤️";

  static displayTagLabel(tag: string): string {
    return tag === TableDataTransformer.recommendedTag
      ? TableDataTransformer.recommendedTagLabel
      : tag;
  }

  /**
   * Get tags displayed in the table UI.
   * Recommended addons receive an extra star tag.
   */
  static displayTags(addonInfo: AddonInfo): string[] {
    const tags = addonInfo.tags ? [...addonInfo.tags] : [];
    if (
      addonInfo.recommended &&
      !tags.includes(TableDataTransformer.recommendedTag)
    ) {
      tags.unshift(TableDataTransformer.recommendedTag);
    }
    return tags;
  }

  /**
   * Transform addon infos to table row data
   */
  static async transformAddonInfos(
    force = false,
  ): Promise<AssociatedAddonInfo[]> {
    const addonInfos = await AddonInfoManager.shared.fetchAddonInfos(force);
    // Local add-on metadata is supplementary. Zotero 11 can delay the
    // AddonManager while it is refreshing the extension database; do not let
    // that block the remote list from rendering.
    let relateAddons: Awaited<ReturnType<typeof relatedAddons>>;
    let localMetadataAvailable = true;
    try {
      relateAddons = await withTimeout(
        relatedAddons(addonInfos).catch((error: unknown) => {
          ztoolkit.log(`failed to query local add-ons: ${error}`);
          localMetadataAvailable = false;
          return [];
        }),
        RELATED_ADDONS_TIMEOUT_MS,
      );
    } catch (error) {
      ztoolkit.log(`timed out querying local add-ons: ${error}`);
      relateAddons = [];
      localMetadataAvailable = false;
    }

    return Promise.all(
      addonInfos.map(async (addonInfo) => {
        const result: Partial<Record<TableColumnID, string>> = {};
        const releaseMatch = displayAddonReleaseInfo(addonInfo);
        const releaseInfo = releaseMatch?.release;
        result["menu-name"] = releaseInfo?.name ?? addonInfo.name;
        result["menu-desc"] =
          releaseInfo?.description ?? addonInfo.description ?? "";
        result["menu-star"] =
          addonInfo.stars === 0
            ? "0"
            : addonInfo.stars
              ? String(addonInfo.stars)
              : "?";
        const rawRemoteVersion =
          releaseInfo?.xpiVersion?.toLowerCase().replace("v", "") ?? "";
        const remoteVersion =
          releaseMatch && !releaseMatch.compatible
            ? `${rawRemoteVersion} (${getString("state-uncompatible")})`
            : rawRemoteVersion;
        result["menu-remote-version"] = remoteVersion;
        result["menu-local-version"] = "";
        const releaseTime = addonReleaseTime(addonInfo, releaseInfo);
        if (releaseTime) {
          result["menu-remote-update-time"] = releaseTime;
        }
        const relateAddon = localMetadataAvailable
          ? relateAddons.find((addonPair) => {
              const addonID = releaseInfo?.id;
              if (addonID) {
                return addonID == addonPair[1].id;
              } else {
                return addonInfo.repo === addonPair[0].repo;
              }
            })
          : undefined;
        result["menu-local-version"] = localMetadataAvailable
          ? (relateAddon?.[1].version ?? "-")
          : "?";
        const installState = localMetadataAvailable
          ? await addonInstallStatus(addonInfo, relateAddon)
          : InstallStatus.unknown;
        result["menu-install-state"] =
          TableDataTransformer.installStatusDescription(installState);
        result["menu-tags"] =
          TableDataTransformer.displayTags(addonInfo).join(", ");
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
            (
              displayAddonReleaseInfo(a)?.release.name ??
              a.name ??
              ""
            ).toLowerCase(),
            (
              displayAddonReleaseInfo(b)?.release.name ??
              b.name ??
              ""
            ).toLowerCase(),
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
            displayAddonReleaseInfo(a)?.release.releaseDate ?? "",
            displayAddonReleaseInfo(b)?.release.releaseDate ?? "",
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
