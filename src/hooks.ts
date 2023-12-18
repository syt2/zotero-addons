import { config } from "../package.json";
import { initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { AddonTable } from "./modules/addonTable";
import { AddonInfoManager } from "./modules/addonInfo";
import { currentSource } from "./utils/configuration";
import { AddonInfoDetail } from "./modules/addonDetail";
import { AddonListenerManager } from "./modules/addonListenerManager";
import { getPref } from "./utils/prefs";
import { registerConfigScheme } from "./modules/registerScheme";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // TODO: Remove this after zotero#3387 is merged
  if (__env__ === "development") {
    // Keep in sync with the scripts/startup.mjs
    const loadDevToolWhen = `Plugin ${config.addonID} startup`;
    ztoolkit.log(loadDevToolWhen);
  }

  initLocale();

  registerConfigScheme();

  await onMainWindowLoad(window);

  (async () => {
    if (currentSource().id === "source-auto") {
      // 自动切换到可连接的源地址
      await AddonInfoManager.autoSwitchAvaliableApi();
    } else {
      await AddonInfoManager.shared.fetchAddonInfos(true);
    }

    // 若在获取过程中已经展示，则刷新
    AddonTable.refresh(false);

    if (getPref('autoUpdate')) {
      AddonTable.updateExistAddons();
    }

    // 首次在新版本上启动时检查不兼容插件
    AddonTable.checkUncompatibleAtFirstTime();
  })();

  AddonListenerManager.addListener();
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  AddonTable.registerInToolbar();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  AddonTable.close();
  AddonInfoDetail.close();
  AddonListenerManager.removeListener();
  document.querySelector("#zotero-toolbaritem-addons")?.remove();
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
