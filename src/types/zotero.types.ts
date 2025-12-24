/**
 * Zotero API type definitions
 * Wrapper types for Zotero's AddonManager and XPIDatabase
 */

import type { LocalAddon, DBAddon } from "./addon.types";

/**
 * Addon install object returned by AddonManager.getInstallForURL
 */
export interface IAddonInstall {
  state: number;
  progress: number;
  maxProgress: number;
  error: number;
  addon: LocalAddon | null;
  addListener(listener: IInstallListener): void;
  removeListener(listener: IInstallListener): void;
  install(): Promise<void>;
  cancel(): void;
}

/**
 * Install event listener
 */
export interface IInstallListener {
  onDownloadStarted?(install: IAddonInstall): void;
  onDownloadEnded?(install: IAddonInstall): void;
  onDownloadFailed?(install: IAddonInstall): void;
  onInstallFailed?(install: IAddonInstall): void;
  onInstallEnded?(install: IAddonInstall, addon: LocalAddon): void;
}

/**
 * Addon event listener for AddonManager
 */
export interface IAddonEventListener {
  onEnabled?(addon: LocalAddon): void;
  onEnabling?(addon: LocalAddon): void;
  onDisabled?(addon: LocalAddon): void;
  onDisabling?(addon: LocalAddon): void;
  onInstalled?(addon: LocalAddon): void;
  onInstalling?(addon: LocalAddon): void;
  onUninstalled?(addon: LocalAddon): void;
  onUninstalling?(addon: LocalAddon): void;
  onOperationCancelled?(addon: LocalAddon): void;
  onPropertyChanged?(addon: LocalAddon): void;
}

/**
 * AddonManager interface
 */
export interface IAddonManager {
  getAllAddons(): Promise<LocalAddon[]>;
  getInstallForURL(
    url: string,
    options?: { telemetryInfo?: { source: string } },
  ): Promise<IAddonInstall>;
  addAddonListener(listener: IAddonEventListener): void;
  removeAddonListener(listener: IAddonEventListener): void;
  getPreferredIconURL(addon: LocalAddon): string;
  errorToString(error: number): string;
  updateEnabled: boolean;
  autoUpdateDefault: boolean;
  STATE_DOWNLOADING: number;
}

/**
 * XPIDatabase interface
 */
export interface IXPIDatabase {
  getAddon(predicate: (addon: DBAddon) => boolean): Promise<DBAddon | null>;
}
