/**
 * Table menu handler
 * Handles right-click menu and menu item actions
 */

import { getString } from "../../utils/locale";
import {
  AddonInfo,
  addonCanUpdate,
  addonReleaseInfo,
  relatedAddons,
} from "../../modules/addonInfo";
import { getXPIDatabase } from "../../utils/compat";
import type { TableMenuItemID, AssociatedAddonInfo } from "../../types";

export interface MenuHandlerDependencies {
  getSelectedIndices: () => Set<number> | undefined;
  getAddonInfos: () => AssociatedAddonInfo[];
  getOutdateAddons: () => Promise<[AddonInfo, any][]>;
}

export class TableMenuHandler {
  private window: Window;
  private deps: MenuHandlerDependencies;

  constructor(window: Window, deps: MenuHandlerDependencies) {
    this.window = window;
    this.deps = deps;
  }

  /**
   * Generate table menu items based on current selection
   */
  async getTableMenuItems(): Promise<[TableMenuItemID, string][]> {
    const result: [TableMenuItemID, string][] = [];
    const selects = this.deps.getSelectedIndices();
    const append = (id: TableMenuItemID, selectCount?: number) => {
      // @ts-expect-error ignore getString type check
      let str = getString(id);
      if (selects && selects.size > 1 && selectCount) {
        str += ` [${selectCount} ${getString("menu-items-count")}]`;
      }
      result.push([id, str]);
    };

    if (selects) {
      const selectedAddonSupportOps =
        await this.getSelectedAddonSupportOperations();
      const possibleTabID: TableMenuItemID[] = [
        "menu-install",
        "menu-reinstall",
        "menu-update",
        "menu-uninstall-undo",
        "menu-remove",
        "menu-uninstall",
        "menu-enable",
        "menu-disable",
        "menu-open-xpi-location",
      ];
      possibleTabID.forEach(
        (e) =>
          selectedAddonSupportOps.has(e) &&
          append(e, selectedAddonSupportOps.get(e)?.length),
      );
      if (selects.size === 1) {
        append("menu-homepage");
      }
      append("menu-sep");
    }

    append("menu-refresh");
    append("menu-sep");

    if ((await this.deps.getOutdateAddons()).length > 0) {
      append("menu-updateAllIfNeed");
      append("menu-sep");
    }

    append("menu-systemAddon");
    if (selects?.size === 1) {
      const addonInfos = this.deps.getAddonInfos();
      for (const idx of selects) {
        const addonInfo = addonInfos[idx];
        const relatedAddon = await relatedAddons([addonInfo[0]]);
        if (relatedAddon.length <= 0) {
          continue;
        }
        const dbAddon = await getXPIDatabase().getAddon(
          (addon: any) => addon.id === relatedAddon[0][1].id,
        );
        if (dbAddon && dbAddon.path) {
          append("menu-open-xpi-location");
        }
      }
    }
    return result;
  }

  /**
   * Get supported operations for selected addons
   */
  async getSelectedAddonSupportOperations(): Promise<
    Map<TableMenuItemID, AddonInfo[]>
  > {
    const selectedAddonOps = new Map<TableMenuItemID, AddonInfo[]>();
    const append = (key: TableMenuItemID, addonInfo: AddonInfo) => {
      const arr = selectedAddonOps.get(key) ?? [];
      arr.push(addonInfo);
      selectedAddonOps.set(key, arr);
    };
    const selects = this.deps.getSelectedIndices();
    if (!selects) {
      return selectedAddonOps;
    }
    const addonInfos = this.deps.getAddonInfos();
    for (const idx of selects) {
      const addonInfo = addonInfos[idx];
      const relatedAddon = await relatedAddons([addonInfo[0]]);
      if (relatedAddon.length > 0) {
        if (relatedAddon[0][1].appDisabled) {
          append("menu-reinstall", addonInfo[0]);
        } else if (addonCanUpdate(relatedAddon[0][0], relatedAddon[0][1])) {
          append("menu-update", addonInfo[0]);
        } else {
          append("menu-reinstall", addonInfo[0]);
        }
        const dbAddon = await getXPIDatabase().getAddon(
          (addon: any) => addon.id === relatedAddon[0][1].id,
        );
        if (dbAddon) {
          if (dbAddon.pendingUninstall) {
            append("menu-uninstall-undo", addonInfo[0]);
            append("menu-remove", addonInfo[0]);
          } else {
            append("menu-uninstall", addonInfo[0]);
          }
        }
        if (
          !relatedAddon[0][1].appDisabled &&
          !(dbAddon && dbAddon.pendingUninstall)
        ) {
          if (relatedAddon[0][1].userDisabled) {
            append("menu-enable", addonInfo[0]);
          } else {
            append("menu-disable", addonInfo[0]);
          }
        }
      } else {
        append("menu-install", addonInfo[0]);
      }
    }
    return selectedAddonOps;
  }

  /**
   * Replace right-click menu element
   */
  async replaceRightClickMenu(
    oldNode: Element,
    onCommand: (item: TableMenuItemID) => Promise<void>,
  ): Promise<void> {
    ztoolkit.UI.replaceElement(
      {
        tag: "menupopup",
        id: "listMenu",
        listeners: [
          {
            type: "command",
            listener: async (ev) => {
              const selectValue = (ev.target as any).getAttribute("value");
              await onCommand(selectValue);
            },
          },
        ],
        children: (await this.getTableMenuItems()).map((item) => {
          if (item[0] === "menu-sep") {
            return {
              tag: "menuseparator",
            };
          } else {
            return {
              tag: "menuitem",
              attributes: {
                label: item[1],
                value: item[0],
              },
            };
          }
        }),
      },
      oldNode,
    );
  }
}
