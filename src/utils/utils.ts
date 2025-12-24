/**
 * Utility functions
 * Re-exports from services for backward compatibility
 */

// Re-export from services
export {
  installAddonFrom,
  uninstall,
  undoUninstall,
  extractFileNameFromUrl,
} from "../services";

export type { InstallOptions, UninstallOptions } from "../services";
