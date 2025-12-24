/**
 * Source related type definitions
 */

import type { AddonInfo } from "./addon.types";

/**
 * Addon source ID
 */
export type SourceID =
  | "source-auto"
  | "source-zotero-chinese-github"
  | "source-zotero-chinese-gitee"
  | "source-zotero-chinese-jsdelivr"
  | "source-zotero-chinese-ghproxy"
  | "source-zotero-scraper-github"
  | "source-zotero-scraper-gitee"
  | "source-zotero-scraper-ghproxy"
  | "source-zotero-scraper-jsdelivr"
  | "source-custom";

/**
 * Addon source configuration
 */
export interface Source {
  /**
   * Source ID
   */
  id: SourceID;
  /**
   * API URL to fetch addon info JSON
   */
  api?: string;
}

/**
 * Source fetch result
 */
export interface SourceFetchResult {
  source: Source;
  infos: AddonInfo[];
  timestamp: Date;
}

/**
 * XPI URL source name for display
 */
export type XpiSourceName =
  | "source-github"
  | "source-gitee"
  | "source-ghproxy"
  | "source-jsdelivr"
  | "source-kgithub"
  | "source-others";
