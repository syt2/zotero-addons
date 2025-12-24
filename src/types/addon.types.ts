/**
 * Addon related type definitions
 */

/**
 * XPI download URLs from different sources
 */
export interface XpiDownloadUrls {
  github: string;
  gitee?: string;
  ghProxy?: string;
  jsdeliver?: string;
  kgithub?: string;
}

/**
 * Addon release information
 */
export interface AddonRelease {
  /**
   * Target Zotero version for this release
   */
  targetZoteroVersion: string;
  /**
   * Release tag name
   * - `latest`: Latest stable release
   * - `pre`: Latest pre-release
   * - `string`: Specific git tag name
   */
  tagName: "latest" | "pre" | string;
  /**
   * Addon ID extracted from XPI
   */
  id?: string;
  /**
   * Addon name extracted from XPI
   */
  name?: string;
  /**
   * Addon description extracted from XPI
   */
  description?: string;
  /**
   * Addon version extracted from XPI
   */
  xpiVersion?: string;
  /**
   * Minimum required Zotero version (may contain *)
   */
  minZoteroVersion?: string;
  /**
   * Maximum supported Zotero version (may contain *)
   */
  maxZoteroVersion?: string;
  /**
   * XPI download URLs
   */
  xpiDownloadUrl?: XpiDownloadUrls;
  /**
   * Release date
   */
  releaseDate?: string;
}

/**
 * Addon author information
 */
export interface AddonAuthor {
  name: string;
  url: string;
  avatar: string;
}

/**
 * Remote addon information
 * Data structure from zotero-plugins repository
 */
export interface AddonInfo {
  /**
   * Addon name
   */
  name?: string;
  /**
   * Addon repository (e.g., "northword/zotero-format-metadata")
   */
  repo: string;
  /**
   * Addon releases
   */
  releases?: AddonRelease[];
  /**
   * Addon description
   */
  description?: string;
  /**
   * GitHub stars count
   */
  stars?: number;
  /**
   * Addon author
   */
  author?: AddonAuthor;
}

/**
 * Local installed addon
 * Wrapper for Zotero AddonManager returned object
 */
export interface LocalAddon {
  id: string;
  name: string;
  version: string;
  description?: string;
  homepageURL?: string;
  updateURL?: string;
  userDisabled: boolean;
  appDisabled: boolean;
  isCompatible: boolean;
  isPlatformCompatible: boolean;
  /**
   * Auto-update setting
   * - 0: off
   * - 1: default
   * - 2: on
   */
  applyBackgroundUpdates?: number;

  // Methods
  enable(): Promise<void>;
  disable(): Promise<void>;
  uninstall(canRestore?: boolean): Promise<void>;
  cancelUninstall(): void;
}

/**
 * Database addon information
 */
export interface DBAddon {
  id: string;
  path?: string;
  pendingUninstall: boolean;
}

/**
 * Addon install status enumeration
 */
export enum InstallStatus {
  unknown = 0,
  notInstalled = 1,
  normal = 2,
  updatable = 3,
  disabled = 4,
  incompatible = 5,
  pendingUninstall = 6,
}

