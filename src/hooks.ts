import { config } from "../package.json";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { AddonTable } from "./modules/addonTable";
import { AddonInfoManager } from "./modules/addonInfo";
import { currentSource } from "./utils/configuration";
import { AddonInfoDetail } from "./modules/addonDetail";
import { AddonListenerManager } from "./modules/addonListenerManager";
import { getPref } from "./utils/prefs";
import { registerConfigScheme } from "./modules/registerScheme";
import { Guide } from "./modules/guide";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerConfigScheme();
  Guide.initPrefs();

  await onMainWindowLoad(window);

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

    if (getPref('autoUpdate')) {
      // update automatically if need
      AddonTable.updateExistAddons();
    }

    // Check incompatible plugins if need
    AddonTable.checkUncompatibleAtFirstTime();
  })();

  AddonListenerManager.addListener();
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  AddonTable.registerInToolbar();
  AddonTable.registerInMenuTool();

  Guide.showGuideInMainWindowIfNeed(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  AddonTable.close();
  AddonInfoDetail.close();
  AddonListenerManager.removeListener();
  AddonTable.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
