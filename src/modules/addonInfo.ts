import {
  Source,
  Sources,
  autoSource,
  currentSource,
  resolveSourceApi,
  setAutoSource,
} from "../utils/configuration";
import { getXPIDatabase, getAddonManager } from "../utils/compat";
import { getPref } from "../utils/prefs";
import {
  buildXpiDownloadUrlsFromGitHub,
  completeXpiDownloadUrls,
  xpiDownloadUrlList,
} from "../utils/xpiDownloadUrls";
import {
  firstSuccessfulStaggered,
  type StaggerScheduler,
} from "../utils/staggeredRequests";
import { withTimeout } from "../utils/async";
// Re-export types from types module
export { InstallStatus } from "../types";
export type { AddonInfo, HistoricalRelease, ReleaseCacheData } from "../types";
import { InstallStatus } from "../types";
import type {
  AddonInfo,
  LocalAddon,
  HistoricalRelease,
  ReleaseCacheData,
  XpiDownloadUrls,
} from "../types";

const CURRENT_SOURCE_FETCH_TIMEOUT_MS = 5000;
const AUTO_SOURCE_FETCH_TIMEOUT_MS = 10000;
const AUTO_SOURCE_STAGGER_DELAY_MS = 3000;
const REQUEST_FALLBACK_TIMEOUT_MS = 8000;

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
 * Extract a release that is compatible with the running Zotero version.
 * @param addonInfo AddonInfo
 * @returns AddonInfo.releases (Adapted to current Zotero version)
 */
export function addonReleaseInfo(addonInfo: AddonInfo) {
  return resolveAddonRelease(addonInfo, false)?.release;
}

/**
 * Resolve a release for display. In all-addons mode, unsupported add-ons fall
 * back to the release targeting the closest Zotero major version.
 */
export function displayAddonReleaseInfo(addonInfo: AddonInfo) {
  return resolveAddonRelease(addonInfo, getPref("showAllAddons") === true);
}

/**
 * Extract add-on xpi release time from AddonInfo
 * @param addonInfo AddonInfo
 * @returns AddonInfo.releases.releaseDate string with yyyy/MM/dd hh:mm:ss format (Adapted to current Zotero version)
 */
export function addonReleaseTime(
  addonInfo: AddonInfo,
  releaseInfo = addonReleaseInfo(addonInfo),
) {
  const inputDate = new Date(releaseInfo?.releaseDate ?? "");
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
    const releaseInfo = displayAddonReleaseInfo(addonInfo)?.release;
    const relateAddon =
      localAddons.find((addon) => releaseInfo?.id === addon.id) ??
      localAddons.find((addon) => {
        if (
          addon.name &&
          (releaseInfo?.name === addon.name || addonInfo.name === addon.name)
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
    return displayAddonReleaseInfo(addonInfo)?.release.id
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
export function isVersionCompatible(
  minVersion?: string,
  maxVersion?: string,
): boolean {
  const currentVersion = Zotero.version;
  if (
    minVersion &&
    Services.vc.compare(currentVersion, minVersion.replace(/\*/g, "0")) < 0
  ) {
    return false;
  }
  if (
    maxVersion &&
    Services.vc.compare(currentVersion, maxVersion.replace(/\*/g, "999")) > 0
  ) {
    return false;
  }
  return true;
}

export interface ResolvedAddonRelease {
  release: NonNullable<AddonInfo["releases"]>[number];
  compatible: boolean;
}

function parseMajorVersion(version?: string) {
  if (!version) return undefined;
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) ? major : undefined;
}

function releaseMatchesCurrentZotero(
  release: NonNullable<AddonInfo["releases"]>[number],
) {
  const currentMajor = parseMajorVersion(Zotero.version);
  const targetMajor = parseMajorVersion(release.targetZoteroVersion);
  if (targetMajor !== undefined && targetMajor !== currentMajor) {
    return false;
  }
  return isVersionCompatible(
    release.minZoteroVersion,
    release.maxZoteroVersion,
  );
}

function releaseDistanceFromCurrentZotero(
  release: NonNullable<AddonInfo["releases"]>[number],
) {
  const currentMajor = parseMajorVersion(Zotero.version);
  if (currentMajor === undefined) return Number.MAX_SAFE_INTEGER;

  const targetMajor = parseMajorVersion(release.targetZoteroVersion);
  if (targetMajor !== undefined) {
    return Math.abs(targetMajor - currentMajor);
  }

  const minMajor = parseMajorVersion(
    release.minZoteroVersion?.replace(/\*/g, "0"),
  );
  const maxMajor = parseMajorVersion(
    release.maxZoteroVersion?.replace(/\*/g, "999"),
  );
  if (minMajor !== undefined && currentMajor < minMajor) {
    return minMajor - currentMajor;
  }
  if (maxMajor !== undefined && currentMajor > maxMajor) {
    return currentMajor - maxMajor;
  }
  return 0;
}

/**
 * Resolve the release for a row or detail page.
 * `allowIncompatible` should only be used for display; install and update
 * paths must continue to use `addonReleaseInfo`, which only returns compatible
 * releases.
 */
export function resolveAddonRelease(
  addonInfo: AddonInfo,
  allowIncompatible: boolean,
): ResolvedAddonRelease | undefined {
  const releases = (addonInfo.releases ?? []).filter(
    (release) => (release.xpiDownloadUrl?.github?.length ?? 0) > 0,
  );
  const compatibleRelease = releases.find(releaseMatchesCurrentZotero);
  if (compatibleRelease) {
    return { release: compatibleRelease, compatible: true };
  }
  if (!allowIncompatible || releases.length === 0) {
    return undefined;
  }

  const closestRelease = releases.reduce((closest, release) => {
    const distanceDelta =
      releaseDistanceFromCurrentZotero(release) -
      releaseDistanceFromCurrentZotero(closest);
    if (distanceDelta !== 0) {
      return distanceDelta < 0 ? release : closest;
    }
    const releaseTime = new Date(release.releaseDate ?? "").getTime() || 0;
    const closestTime = new Date(closest.releaseDate ?? "").getTime() || 0;
    return releaseTime > closestTime ? release : closest;
  });
  return { release: closestRelease, compatible: false };
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
      let cancelRequest: VoidFunction | undefined;
      const requestTimeout = options?.timeout ?? REQUEST_FALLBACK_TIMEOUT_MS;
      const request = Zotero.HTTP.request("GET", url, {
        ...options,
        timeout: requestTimeout,
        errorDelayMax: 0,
        successCodes: false,
        cancellerReceiver: (cancel: VoidFunction) => {
          cancelRequest = cancel;
          options?.cancellerReceiver?.(cancel);
        },
      });
      const response = await withTimeout(request, requestTimeout, () =>
        cancelRequest?.(),
      );
      if (
        response.status !== 0 &&
        (response.status < 200 || response.status >= 300)
      ) {
        throw new Error(`HTTP ${response.status}`);
      }
      const addons = JSON.parse(response.response) as AddonInfo[];
      const validAddons = addons.filter((addon) =>
        displayAddonReleaseInfo(addon),
      );
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
        const api = resolveSourceApi(source) ?? source.api;
        const infos = await this.dependencies.fetchAddonInfos(api, {
          timeout: AUTO_SOURCE_FETCH_TIMEOUT_MS,
          cancellerReceiver: registerCanceller,
        });
        return infos.length > 0 ? { source, api, infos } : undefined;
      }),
      AUTO_SOURCE_STAGGER_DELAY_MS,
      this.dependencies.staggerScheduler,
    );

    if (result) {
      this.sourceInfos[result.api] = [this.dependencies.now(), result.infos];
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
export async function fetchHistoricalReleases(
  repo: string,
): Promise<HistoricalRelease[]> {
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
      return (
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
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
export function buildHistoricalDownloadUrls(
  githubUrl: string,
): XpiDownloadUrls {
  return buildXpiDownloadUrlsFromGitHub(githubUrl);
}

/**
 * Get prioritized download URLs for a historical release based on current source
 * @param historicalRelease The historical release
 * @returns Array of download URLs, ordered by preference based on current source
 */
export function historicalReleaseDownloadUrls(
  historicalRelease: HistoricalRelease,
): string[] {
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
