import { initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { AddonTable } from "./modules/addonTable";
import { AddonInfoManager } from "./modules/addonInfo";
import { currentSource } from "./utils/configuration";
import { AddonInfoDetail } from "./modules/addonDetail";
import { AddonListenerManager } from "./modules/addonListenerManager";
import { getPref } from "./utils/prefs";
import { registerConfigScheme } from "./modules/registerScheme";
import { Guide } from "./modules/guide";
import { getEventBus, AddonEvents, clearEventBus } from "./core";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerConfigScheme();
  Guide.initPrefs();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  (async () => {
    if (currentSource().id === "source-auto") {
      // if selected auto source, switch to a connectable source automatically at launching
      await AddonInfoManager.autoSwitchAvaliableApi();
    } else {
      // fetch addonInfo from specific source
      await AddonInfoManager.shared.fetchAddonInfos(true);
    }

    // refresh table if AddonTable already displayed, so specific `force` to false
    AddonTable.refresh(false);

    if (getPref("autoUpdate")) {
      // update automatically if need
      AddonTable.updateExistAddons();
    }
  })();

  AddonListenerManager.addListener();

  // Subscribe to addon changed events for UI refresh
  getEventBus().on(AddonEvents.ADDON_CHANGED, () => {
    AddonTable.refresh();
    AddonInfoDetail.refresh();
  });

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  AddonTable.registerInToolbar();
  AddonTable.registerInMenuTool();

  Guide.showGuideInMainWindowIfNeed(win);
  // win.MozXULElement.insertFTLIfNeeded(
  //   `${addon.data.config.addonRef}-mainWindow.ftl`,
  // );
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  AddonTable.close();
  AddonInfoDetail.close();
  AddonListenerManager.removeListener();
  AddonTable.unregisterAll();
  // Clear all event subscriptions
  clearEventBus();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
