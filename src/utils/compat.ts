/**
 * Compatibility utilities for Zotero 7 and 8
 *
 * Zotero 7: Uses ChromeUtils.import with .jsm files
 * Zotero 8: Uses ChromeUtils.importESModule with .sys.mjs files
 */

/**
 * Check if running on Zotero 8 or later (Firefox 115+)
 */
export function isZotero8() {
  return Services.vc.compare(Zotero.version, "8") > 0 
}

/**
 * Import XPIDatabase module with version compatibility
 */
export function getXPIDatabase() {
  if (isZotero8()) {
    return ChromeUtils.importESModule(
      "resource://gre/modules/addons/XPIDatabase.sys.mjs",
    ).XPIDatabase;
  } else {
    return ChromeUtils.import(
      "resource://gre/modules/addons/XPIDatabase.jsm",
    ).XPIDatabase;
  }
}

/**
 * Import AddonManager module with version compatibility
 */
export function getAddonManager() {
  if (isZotero8()) {
    return ChromeUtils.importESModule(
      "resource://gre/modules/AddonManager.sys.mjs",
    ).AddonManager;
  } else {
    return ChromeUtils.import(
      "resource://gre/modules/AddonManager.jsm",
    ).AddonManager;
  }
}
