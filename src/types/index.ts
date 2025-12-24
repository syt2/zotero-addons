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
  AddonPair,
} from "./addon.types";
export { InstallStatus } from "./addon.types";

// Source types
export type {
  SourceID,
  Source,
  SourceFetchResult,
  XpiSourceName,
} from "./source.types";

// Table types
export type {
  TableMenuItemID,
  TableColumnID,
  TableRowData,
  AssociatedAddonInfo,
  AssociatedAddonInfoEx,
  SortConfig,
  TableState,
  ExtendedColumnOptions,
  MenuItemWithAddon,
} from "./table.types";

// Zotero API types
export type {
  IAddonInstall,
  IInstallListener,
  IAddonEventListener,
  IAddonManager,
  IXPIDatabase,
} from "./zotero.types";
