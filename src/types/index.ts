/**
 * Type definitions aggregation
 */

// Addon types
export type {
  XpiDownloadUrls,
  AddonRelease,
  AddonAuthor,
  AddonInfo,
  LocalAddon,
  DBAddon,
  HistoricalRelease,
  ReleaseCacheData,
} from "./addon.types";
export { InstallStatus } from "./addon.types";

// Table types
export type {
  TableMenuItemID,
  TableColumnID,
  TableRowData,
  AssociatedAddonInfo,
  ExtendedColumnOptions,
} from "./table.types";

// Zotero API types
export type {
  IAddonInstall,
  IInstallListener,
  IAddonEventListener,
  IAddonManager,
  IXPIDatabase,
} from "./zotero.types";
