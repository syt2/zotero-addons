import {
  Source,
  Sources,
  autoSource,
  currentSource,
  setAutoSource,
} from "../utils/configuration";
import { getXPIDatabase, getAddonManager } from "../utils/compat";
import {
  buildXpiDownloadUrlsFromGitHub,
  completeXpiDownloadUrls,
  xpiDownloadUrlList,
} from "../utils/xpiDownloadUrls";
import {
  firstSuccessfulStaggered,
  type StaggerScheduler,
} from "../utils/staggeredRequests";
// Re-export types from types module
export { InstallStatus } from "../types";
export type { AddonInfo, HistoricalRelease, ReleaseCacheData } from "../types";
import { InstallStatus } from "../types";
import type { AddonInfo, LocalAddon, HistoricalRelease, ReleaseCacheData, XpiDownloadUrls } from "../types";

const CURRENT_SOURCE_FETCH_TIMEOUT_MS = 5000;
const AUTO_SOURCE_FETCH_TIMEOUT_MS = 10000;
const AUTO_SOURCE_STAGGER_DELAY_MS = 3000;

export interface AddonInfoFetchOptions {
  timeout?: number;
  cancellerReceiver?: (canceller: VoidFunction) => void;
}

export interface AddonInfoManagerDependencies {
  currentSource: () => Readonly<Source>;
  sources: readonly Readonly<Source>[];
  setAutoSource: (source: Readonly<Source>) => void;
  fetchAddonInfos: (
    url: string,
    options?: AddonInfoFetchOptions,
  ) => Promise<AddonInfo[]>;
  now: () => Date;
  staggerScheduler?: StaggerScheduler;
  log: (message: string) => void;
}

/**
 * Extract download urls of xpi file from AddonInfo
 * @param addonInfo AddonInfo specified
 * @returns Download urls (Adapted to current Zotero version)
 */
export function xpiDownloadUrls(addonInfo: AddonInfo) {
  const suppliedDownloadURLs = addonReleaseInfo(addonInfo)?.xpiDownloadUrl;
  if (!suppliedDownloadURLs) {
    return [];
  }
  const downloadsURLs = completeXpiDownloadUrls(suppliedDownloadURLs);
  const sourceID =
    currentSource().id === "source-auto"
      ? autoSource()?.id
      : currentSource().id;
  const result = xpiDownloadUrlList(downloadsURLs);
  let firstElement: string | undefined = undefined;
  switch (sourceID) {
    case "source-zotero-scraper-github":
      firstElement = downloadsURLs.github;
      break;
    case "source-zotero-scraper-ghproxy":
      firstElement = downloadsURLs.ghProxy;
      break;
    case "source-zotero-scraper-ghfast":
      firstElement = downloadsURLs.ghFast;
      break;
    case "source-zotero-scraper-ghproxynet":
      firstElement = downloadsURLs.ghProxyNet;
      break;
    case "source-zotero-scraper-jsdelivr":
      firstElement = downloadsURLs.jsdeliver;
      break;
    case "source-zotero-scraper-gitee":
      firstElement = downloadsURLs.gitee;
      break;
  }
  if (firstElement) {
    const index = result.indexOf(firstElement);
    if (index >= 0) {
      result.unshift(result.splice(index, 1)[0]);
    }
  }
  return result.filter((e) => e);
}

/**
 * Extract add-on release information from AddonInfo
 * @param addonInfo AddonInfo
 * @returns AddonInfo.releases (Adapted to current Zotero version)
 */
export function addonReleaseInfo(addonInfo: AddonInfo) {
  const release = addonInfo.releases?.find(
    (release) => Services.vc.compare(release.targetZoteroVersion, Zotero.version.split(".")[0]) == 0 
  ) ?? addonInfo.releases?.find(
    (release) => Services.vc.compare(release.targetZoteroVersion, Zotero.version) >= 0,
  )
  if ((release?.xpiDownloadUrl?.github?.length ?? 0) === 0) {
    return;
  }
  return release;
}

/**
 * Extract add-on xpi release time from AddonInfo
 * @param addonInfo AddonInfo
 * @returns AddonInfo.releases.releaseDate string with yyyy/MM/dd hh:mm:ss format (Adapted to current Zotero version)
 */
export function addonReleaseTime(addonInfo: AddonInfo) {
  const inputDate = new Date(addonReleaseInfo(addonInfo)?.releaseDate ?? "");
  if (inputDate) {
    const year = inputDate.getFullYear();
    const month = String(inputDate.getMonth() + 1).padStart(2, "0");
    const day = String(inputDate.getDate()).padStart(2, "0");
    const hours = String(inputDate.getHours()).padStart(2, "0");
    const minutes = String(inputDate.getMinutes()).padStart(2, "0");
    const seconds = String(inputDate.getSeconds()).padStart(2, "0");
    const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    return formattedDate;
  }
}

/**
 * Extract and filter local addon obj from AddonInfo
 * @param addonInfos AddonInfo array
 * @returns [AddonInfo, addon][] pair which addon installed
 */
export async function relatedAddons(addonInfos: AddonInfo[]) {
  const addons: [AddonInfo, LocalAddon][] = [];
  const localAddons = (await getAddonManager().getAllAddons()).filter(
    (e) => e.id,
  );

  for (const addonInfo of addonInfos) {
    const relateAddon =
      localAddons.find(
        (addon) => addonReleaseInfo(addonInfo)?.id === addon.id,
      ) ??
      localAddons.find((addon) => {
        if (
          addon.name &&
          (addonReleaseInfo(addonInfo)?.name === addon.name ||
            addonInfo.name === addon.name)
        ) {
          return true;
        }
        if (addon.homepageURL && addon.homepageURL.includes(addonInfo.repo)) {
          return true;
        }
        if (addon.updateURL && addon.updateURL.includes(addonInfo.repo)) {
          return true;
        }
        return false;
      });
    if (relateAddon) {
      addons.push([addonInfo, relateAddon]);
    }
  }
  return addons;
}

/**
 * Get addon install status
 * @param addonInfo AddonInfo
 * @param relateAddon AddonInfo and its related local addon. If passed undefined, InstallStatus.unknown will return
 * @returns InstallStatus
 */
export async function addonInstallStatus(
  addonInfo: AddonInfo,
  relateAddon?: [AddonInfo, LocalAddon],
) {
  if (relateAddon) {
    // has local addon
    if (relateAddon[1]) {
      const dbAddon = await getXPIDatabase().getAddon(
        (addon) => addon.id === relateAddon[1].id,
      );
      if (dbAddon && dbAddon.pendingUninstall) {
        // deleted
        return InstallStatus.pendingUninstall;
      } else {
        // exist
        if (
          relateAddon[1].appDisabled ||
          !relateAddon[1].isCompatible ||
          !relateAddon[1].isPlatformCompatible
        ) {
          return InstallStatus.incompatible;
        } else if (relateAddon[1].userDisabled) {
          return InstallStatus.disabled;
        } else if (addonCanUpdate(relateAddon[0], relateAddon[1])) {
          return InstallStatus.updatable;
        } else {
          return InstallStatus.normal;
        }
      }
    } else {
      // incompatible
      return InstallStatus.incompatible;
    }
  } else {
    // not found
    return addonReleaseInfo(addonInfo)?.id
      ? InstallStatus.notInstalled
      : InstallStatus.unknown;
  }
}

/**
 * Check addon can upgrade
 * @param addonInfo AddonInfo
 * @param addon local addon
 * @returns bool
 */
export function addonCanUpdate(addonInfo: AddonInfo, addon: LocalAddon) {
  const version = addonReleaseInfo(addonInfo)?.xpiVersion;
  if (!version || !addon.version) {
    return false;
  }
  return Services.vc.compare(addon.version, version) < 0;
}

/**
 * Check if a version is compatible with current Zotero version
 * @param minVersion Minimum Zotero version (e.g., "7.0")
 * @param maxVersion Maximum Zotero version (e.g., "8.*")
 * @returns true if compatible, false otherwise
 */
export function isVersionCompatible(minVersion?: string, maxVersion?: string): boolean {
  if (!minVersion || !maxVersion) {
    return true; // If no version info, assume compatible
  }
  const currentVersion = Zotero.version;
  const minCompare = Services.vc.compare(currentVersion, minVersion.replace("*", "0"));
  const maxCompare = Services.vc.compare(currentVersion, maxVersion.replace("*", "999"));
  return minCompare >= 0 && maxCompare <= 0;
}

class AddonInfoAPI {
  /**
   * Fetch AddonInfo from url
   * @param url url to fetch AddonInfo JSON
   * @param options request options
   * @returns AddonInfo[]
   */
  static async fetchAddonInfos(
    url: string,
    options?: AddonInfoFetchOptions,
  ): Promise<AddonInfo[]> {
    ztoolkit.log(`fetch addon infos from ${url}`);
    try {
      const response = await Zotero.HTTP.request("GET", url, {
        ...options,
        // Zotero handles Retry-After before errorDelayMax in both 7 and 10,
        // so accepting the response here is the only cross-version way to
        // keep this to one cancellable request. We validate the status below.
        successCodes: false,
      });
      if (
        response.status !== 0 &&
        (response.status < 200 || response.status >= 300)
      ) {
        throw new Error(`HTTP ${response.status}`);
      }
      const addons = JSON.parse(response.response) as AddonInfo[];
      const validAddons = addons.filter((addon) => addonReleaseInfo(addon));
      // return validAddons.sort((a: AddonInfo, b: AddonInfo) => {
      //   return (b.stars ?? 0) - (a.stars ?? 0);
      // });
      return validAddons;
    } catch (error) {
      ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
    }
    return [];
  }
}

const defaultAddonInfoManagerDependencies: AddonInfoManagerDependencies = {
  currentSource,
  sources: Sources,
  setAutoSource,
  fetchAddonInfos: AddonInfoAPI.fetchAddonInfos,
  now: () => new Date(),
  log: (message) => ztoolkit.log(message),
};

export class AddonInfoManager {
  static shared = new AddonInfoManager();

  constructor(
    private readonly dependencies: AddonInfoManagerDependencies = defaultAddonInfoManagerDependencies,
  ) {}

  /**
   * Get AddonInfos from memory
   */
  get addonInfos() {
    const url = this.dependencies.currentSource().api;
    if (!url) {
      return [];
    }
    if (url in this.sourceInfos) {
      if (
        this.dependencies.now().getTime() -
          this.sourceInfos[url][0].getTime() >=
        12 * 60 * 60 * 1000
      ) {
        this.fetchAddonInfos(true);
      }
      return this.sourceInfos[url][1];
    }
    return [];
  }

  private sourceInfos: { [key: string]: [Date, AddonInfo[]] } = {};

  private autoSourceOperationPromise: Promise<AddonInfo[]> | undefined;
  /**
   * Fetch AddonInfos from current selected source
   * @param forceRefresh force fetch
   * @returns AddonInfo[]
   */
  async fetchAddonInfos(forceRefresh = false) {
    const source = this.dependencies.currentSource();
    if (source.id === "source-auto" && !source.api) {
      return await this.runAutoSourceOperation(() => this.findAvailableApi());
    }
    const url = source.api;
    if (!url) {
      return [];
    }
    // 不在刷新，且不需要强制刷新
    if (!forceRefresh) {
      const cachedInfos = this.addonInfos;
      if (cachedInfos.length > 0) {
        return cachedInfos;
      }
    }
    const cachedInfos = this.sourceInfos[url]?.[1] ?? [];
    if (forceRefresh && source.id === "source-auto") {
      return await this.runAutoSourceOperation(async () => {
        const infos = await this.dependencies.fetchAddonInfos(url, {
          timeout: CURRENT_SOURCE_FETCH_TIMEOUT_MS,
        });
        if (infos.length > 0) {
          this.sourceInfos[url] = [this.dependencies.now(), infos];
          return infos;
        }

        const switchedInfos = await this.findAvailableApi();
        return switchedInfos.length > 0 ? switchedInfos : cachedInfos;
      });
    }

    const infos = await this.dependencies.fetchAddonInfos(url, {
      timeout: CURRENT_SOURCE_FETCH_TIMEOUT_MS,
    });
    if (infos.length > 0) {
      this.sourceInfos[url] = [this.dependencies.now(), infos];
      return infos;
    }
    return cachedInfos;
  }

  /**
   * Start source requests in order, adding the next source every three seconds.
   * Earlier requests remain active until one returns a valid add-on index.
   */
  static async autoSwitchAvaliableApi() {
    return await this.shared.runAutoSourceOperation(() =>
      this.shared.findAvailableApi(),
    );
  }

  private async runAutoSourceOperation(
    operation: () => Promise<AddonInfo[]>,
  ): Promise<AddonInfo[]> {
    if (this.autoSourceOperationPromise) {
      return await this.autoSourceOperationPromise;
    }

    this.autoSourceOperationPromise = operation();
    try {
      return await this.autoSourceOperationPromise;
    } finally {
      this.autoSourceOperationPromise = undefined;
    }
  }

  private async findAvailableApi(): Promise<AddonInfo[]> {
    const sourcesWithApi = this.dependencies.sources.filter(
      (source): source is Source & { api: string } => !!source.api,
    );

    const result = await firstSuccessfulStaggered(
      sourcesWithApi.map((source) => async (registerCanceller) => {
        this.dependencies.log(`trying source: ${source.id}`);
        const infos = await this.dependencies.fetchAddonInfos(source.api, {
          timeout: AUTO_SOURCE_FETCH_TIMEOUT_MS,
          cancellerReceiver: registerCanceller,
        });
        return infos.length > 0 ? { source, infos } : undefined;
      }),
      AUTO_SOURCE_STAGGER_DELAY_MS,
      this.dependencies.staggerScheduler,
    );

    if (result) {
      this.sourceInfos[result.source.api] = [
        this.dependencies.now(),
        result.infos,
      ];
      this.dependencies.setAutoSource(result.source);
      this.dependencies.log(`switched to ${result.source.id} automatically`);
      return result.infos;
    }

    this.dependencies.log("all sources failed");
    return [];
  }
}

/**
 * Check if current source is a scraper source (supports historical releases)
 * @returns true if source is scraper-based
 */
export function isScraperSource(): boolean {
  const sourceID =
    currentSource().id === "source-auto"
      ? autoSource()?.id
      : currentSource().id;
  return (
    sourceID === "source-zotero-scraper-github" ||
    sourceID === "source-zotero-scraper-gitee" ||
    sourceID === "source-zotero-scraper-ghproxy" ||
    sourceID === "source-zotero-scraper-ghfast" ||
    sourceID === "source-zotero-scraper-ghproxynet" ||
    sourceID === "source-zotero-scraper-jsdelivr"
  );
}

/**
 * Build release cache URL for a given repo based on current source
 * @param repo Repository name (e.g., "syt2/zotero-addons")
 * @returns URL to fetch release cache JSON
 */
function buildReleaseCacheUrl(repo: string): string | undefined {
  const sourceID =
    currentSource().id === "source-auto"
      ? autoSource()?.id
      : currentSource().id;

  // Release cache uses # as separator instead of /
  // e.g., "windingwind/zotero-pdf-translate" -> "windingwind%23zotero-pdf-translate"
  const encodedRepo = encodeURIComponent(repo.replace("/", "#"));

  switch (sourceID) {
    case "source-zotero-scraper-github":
      return `https://raw.githubusercontent.com/syt2/zotero-addons-scraper/refs/heads/publish/release_cache/${encodedRepo}.json`;
    case "source-zotero-scraper-gitee":
      return `https://gitee.com/ytshen/zotero-addon-scraper/raw/publish/release_cache/${encodedRepo}.json`;
    case "source-zotero-scraper-jsdelivr":
      return `https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/release_cache/${encodedRepo}.json`;
    case "source-zotero-scraper-ghproxy":
      return `https://gh-proxy.org/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/refs/heads/publish/release_cache/${encodedRepo}.json`;
    case "source-zotero-scraper-ghfast":
      return `https://ghfast.top/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/refs/heads/publish/release_cache/${encodedRepo}.json`;
    case "source-zotero-scraper-ghproxynet":
      return `https://ghproxy.net/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/refs/heads/publish/release_cache/${encodedRepo}.json`;
    default:
      return undefined;
  }
}

/**
 * Fetch historical releases for a given repo
 * @param repo Repository name (e.g., "syt2/zotero-addons")
 * @returns Array of historical releases, sorted by published_at descending
 */
export async function fetchHistoricalReleases(repo: string): Promise<HistoricalRelease[]> {
  if (!isScraperSource()) {
    return [];
  }

  const url = buildReleaseCacheUrl(repo);
  if (!url) {
    return [];
  }

  ztoolkit.log(`Fetching historical releases from ${url}`);

  try {
    const response = await Zotero.HTTP.request("GET", url, { timeout: 10000 });
    const data = JSON.parse(response.response) as ReleaseCacheData;

    // Sort by published_at descending (newest first)
    const releases = data.checked_releases || [];
    releases.sort((a, b) => {
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    return releases;
  } catch (error) {
    ztoolkit.log(`Failed to fetch historical releases: ${error}`);
    return [];
  }
}

/**
 * Build download URLs for a historical release based on the GitHub URL
 * @param githubUrl The original GitHub download URL
 * @returns XpiDownloadUrls object with various mirror URLs
 */
export function buildHistoricalDownloadUrls(githubUrl: string): XpiDownloadUrls {
  return buildXpiDownloadUrlsFromGitHub(githubUrl);
}

/**
 * Get prioritized download URLs for a historical release based on current source
 * @param historicalRelease The historical release
 * @returns Array of download URLs, ordered by preference based on current source
 */
export function historicalReleaseDownloadUrls(historicalRelease: HistoricalRelease): string[] {
  const urls = buildHistoricalDownloadUrls(historicalRelease.xpi_download_url);
  const sourceID =
    currentSource().id === "source-auto"
      ? autoSource()?.id
      : currentSource().id;

  const result = xpiDownloadUrlList(urls);
  let firstElement: string | undefined = undefined;

  switch (sourceID) {
    case "source-zotero-scraper-github":
      firstElement = urls.github;
      break;
    case "source-zotero-scraper-ghproxy":
      firstElement = urls.ghProxy;
      break;
    case "source-zotero-scraper-ghfast":
      firstElement = urls.ghFast;
      break;
    case "source-zotero-scraper-ghproxynet":
      firstElement = urls.ghProxyNet;
      break;
    case "source-zotero-scraper-jsdelivr":
    case "source-zotero-scraper-gitee":
      // For jsdelivr and gitee, prefer ghProxy as they don't have direct XPI mirrors
      firstElement = urls.ghProxy;
      break;
  }

  if (firstElement) {
    const index = result.indexOf(firstElement);
    if (index >= 0) {
      result.unshift(result.splice(index, 1)[0]);
    }
  }

  return result.filter((e) => e);
}
