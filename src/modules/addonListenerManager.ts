import { getAddonManager } from "../utils/compat";
import { getEventBus, AddonEvents } from "../core";
import type { IAddonEventListener } from "../types";

/**
 * Addon event listener manager
 * Uses EventBus to decouple from specific UI components
 */
export class AddonListenerManager {
  private static eventBus = getEventBus();

  /**
   * Emit addon changed event
   */
  private static emitAddonChanged = (): void => {
    AddonListenerManager.eventBus.emit(AddonEvents.ADDON_CHANGED);
  };

  /**
   * Addon event listener
   * All events emit the same ADDON_CHANGED event
   */
  private static addonEventListener: IAddonEventListener = {
    onEnabled: AddonListenerManager.emitAddonChanged,
    onEnabling: AddonListenerManager.emitAddonChanged,
    onDisabled: AddonListenerManager.emitAddonChanged,
    onDisabling: AddonListenerManager.emitAddonChanged,
    onInstalled: AddonListenerManager.emitAddonChanged,
    onInstalling: AddonListenerManager.emitAddonChanged,
    onUninstalled: AddonListenerManager.emitAddonChanged,
    onUninstalling: AddonListenerManager.emitAddonChanged,
    onOperationCancelled: AddonListenerManager.emitAddonChanged,
    onPropertyChanged: AddonListenerManager.emitAddonChanged,
  };

  /**
   * Add addon listener in Zotero
   */
  static addListener(): void {
    getAddonManager().addAddonListener(
      this.addonEventListener as unknown as Parameters<
        ReturnType<typeof getAddonManager>["addAddonListener"]
      >[0],
    );
  }

  /**
   * Remove addon listener in Zotero
   */
  static removeListener(): void {
    getAddonManager().removeAddonListener(
      this.addonEventListener as unknown as Parameters<
        ReturnType<typeof getAddonManager>["removeAddonListener"]
      >[0],
    );
  }
}
