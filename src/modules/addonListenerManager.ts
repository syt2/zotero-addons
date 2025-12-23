import { AddonInfoDetail } from "./addonDetail";
import { AddonTable } from "./addonTable";
import { getAddonManager } from "../utils/compat";

export class AddonListenerManager {
  private static addonEventListener = {
    onEnabled: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onEnabling: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onDisabled: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onDisabling: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onInstalled: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onInstalling: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onUninstalled: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onUninstalling: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onOperationCancelled: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
    onPropertyChanged: async (addon: any) => {
      AddonTable.refresh();
      AddonInfoDetail.refresh();
    },
  };

  /**
   * Add addon listener in Zotero
   */
  static addListener() {
    getAddonManager().addAddonListener(this.addonEventListener);
  }

  /**
   * Remove addon listener in Zotero
   */
  static removeListener() {
    getAddonManager().removeAddonListener(this.addonEventListener);
  }
}
