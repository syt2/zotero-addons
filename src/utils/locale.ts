import { config } from "../../package.json";

/**
 * Initialize locale data
 */
export function initLocale() {
  addon.data.locale = {
    stringBundle: Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle(`chrome://${config.addonRef}/locale/addon.properties`),
  };
}

/**
 * Get locale string
 * @param localString
 * @param noReload
 */
export function getString(localString: string, noReload = false): string {
  try {
    return addon.data.locale?.stringBundle.GetStringFromName(localString);
  } catch (e) {
    if (!noReload) {
      initLocale();
      return getString(localString, true);
    }
    return localString;
  }
}
