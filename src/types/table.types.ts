/**
 * Table related type definitions
 */

import type { ColumnOptions } from "zotero-plugin-toolkit";
import type { AddonInfo } from "./addon.types";

/**
 * Table menu item ID
 */
export type TableMenuItemID =
  | "menu-install"
  | "menu-update"
  | "menu-reinstall"
  | "menu-install-and-update"
  | "menu-enable"
  | "menu-disable"
  | "menu-uninstall"
  | "menu-remove"
  | "menu-uninstall-undo"
  | "menu-homepage"
  | "menu-refresh"
  | "menu-systemAddon"
  | "menu-updateAllIfNeed"
  | "menu-open-xpi-location"
  | "menu-sep";

/**
 * Table column ID
 */
export type TableColumnID =
  | "menu-name"
  | "menu-desc"
  | "menu-star"
  | "menu-remote-update-time"
  | "menu-remote-version"
  | "menu-local-version"
  | "menu-install-state";

/**
 * Table row data
 */
export type TableRowData = Partial<Record<TableColumnID, string>>;

/**
 * AddonInfo associated with table row data
 * [AddonInfo, TableRowData]
 */
export type AssociatedAddonInfo = [AddonInfo, TableRowData];

/**
 * Extended column options
 */
export interface ExtendedColumnOptions extends ColumnOptions {
  ordinal?: number;
  sortDirection?: 1 | -1;
  hidden?: boolean;
}
