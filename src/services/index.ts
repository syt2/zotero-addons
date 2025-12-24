/**
 * Services module exports
 */

export {
  installAddonFrom,
  uninstall,
  undoUninstall,
  xpiURLSourceName,
  extractFileNameFromUrl,
} from "./AddonInstallService";

export type { InstallOptions, UninstallOptions } from "./AddonInstallService";
