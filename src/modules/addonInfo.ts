import {
  Source,
  Sources,
  autoSource,
  currentSource,
  setAutoSource,
} from "../utils/configuration";
import { getXPIDatabase, getAddonManager } from "../utils/compat";
// Re-export types from types module
export { InstallStatus } from "../types";
export type { AddonInfo, HistoricalRelease, ReleaseCacheData } from "../types";
import { InstallStatus } from "../types";
import type { AddonInfo, LocalAddon, HistoricalRelease, ReleaseCacheData, XpiDownloadUrls } from "../types";

/**
 * Extract download urls of xpi file from AddonInfo
 * @param addonInfo AddonInfo specified
 * @returns Download urls (Adapted to current Zotero version)
 */
export function xpiDownloadUrls(addonInfo: AddonInfo) {
  const downloadsURLs = addonReleaseInfo(addonInfo)?.xpiDownloadUrl;
  if (!downloadsURLs) {
    return [];
  }
  const sourceID =
    currentSource().id === "source-auto"
      ? autoSource()?.id
      : currentSource().id;
  const result = Object.values(downloadsURLs).filter((e) => !!e);
  let firstElement: string | undefined = undefined;
  switch (sourceID) {
    case "source-zotero-chinese-github":
    case "source-zotero-scraper-github":
      firstElement = downloadsURLs.github;
      break;
    case "source-zotero-chinese-ghproxy":
    case "source-zotero-scraper-ghproxy":
      firstElement = downloadsURLs.ghProxy;
      break;
    case "source-zotero-chinese-jsdelivr":
    case "source-zotero-scraper-jsdelivr":
      firstElement = downloadsURLs.jsdeliver;
      break;
    case "source-zotero-chinese-gitee":
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
   * @param timeout set timeout if specified
   * @param onTimeoutCallback timeout callback if specified timeout
   * @returns AddonInfo[]
   */
  static async fetchAddonInfos(
    url: string,
    timeout?: number,
    onTimeoutCallback?: VoidFunction,
  ): Promise<AddonInfo[]> {
    ztoolkit.log(`fetch addon infos from ${url}`);
    try {
      const options: { timeout?: number } = {};
      if (timeout) {
        options.timeout = timeout;
      }
      const response = await Zotero.HTTP.request("GET", url, options);
      const addons = JSON.parse(response.response) as AddonInfo[];
      const validAddons = addons.filter((addon) => addonReleaseInfo(addon));
      // return validAddons.sort((a: AddonInfo, b: AddonInfo) => {
      //   return (b.stars ?? 0) - (a.stars ?? 0);
      // });
      return validAddons;
    } catch (error) {
      ztoolkit.log(`fetch fetchAddonInfos from ${url} failed: ${error}`);
      if (error instanceof (Zotero.HTTP as any).TimeoutException) {
        onTimeoutCallback?.();
      }
    }
    return [];
  }
}

export class AddonInfoManager {
  static shared = new AddonInfoManager();

  private constructor() {
    //
  }

  /**
   * Get AddonInfos from memory
   */
  get addonInfos() {
    const url = currentSource().api;
    if (!url) {
      return [];
    }
    if (url in this.sourceInfos) {
      if (
        new Date().getTime() - this.sourceInfos[url][0].getTime() >=
        12 * 60 * 60 * 1000
      ) {
        this.fetchAddonInfos(true);
      }
      return this.sourceInfos[url][1];
    }
    return [];
  }

  private sourceInfos: { [key: string]: [Date, AddonInfo[]] } = {};
  /**
   * Fetch AddonInfos from current selected source
   * @param forceRefresh force fetch
   * @returns AddonInfo[]
   */
  async fetchAddonInfos(forceRefresh = false) {
    const source = currentSource();
    if (source.id === "source-auto" && !source.api) {
      return await AddonInfoManager.autoSwitchAvaliableApi();
    }
    const url = source.api;
    if (!url) {
      return [];
    }
    // 不在刷新，且不需要强制刷新
    if (!forceRefresh && this.addonInfos) {
      return this.addonInfos;
    }
    const infos = await AddonInfoAPI.fetchAddonInfos(url, 5000);
    if (infos.length > 0) {
      this.sourceInfos[url] = [new Date(), infos];
    }
    return this.addonInfos;
  }

  /**
   * Switch to a connectable source (sequential)
   * @param timeout Timeout for each source request in ms
   * @returns AddonInfos from first available source
   */
  static async autoSwitchAvaliableApi(timeout = 3000) {
    const sourcesWithApi = Sources.filter(
      (source): source is Source & { api: string } => !!source.api,
    );

    for (const source of sourcesWithApi) {
      try {
        ztoolkit.log(`trying source: ${source.id}`);
        const infos = await AddonInfoAPI.fetchAddonInfos(
          source.api,
          timeout,
          () => {
            ztoolkit.log(`source ${source.id} timeout after ${timeout}ms`);
          },
        );

        if (infos.length > 0) {
          this.shared.sourceInfos[source.api] = [new Date(), infos];
          setAutoSource(source);
          ztoolkit.log(`switched to ${source.id} automatically`);
          return infos;
        }
      } catch (error) {
        ztoolkit.log(`source ${source.id} failed: ${error}`);
      }
    }

    ztoolkit.log("all sources failed");
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
  return {
    github: githubUrl,
    ghProxy: `https://gh-proxy.org/${githubUrl}`,
    kgithub: githubUrl.replace("github.com", "kkgithub.com"),
  };
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

  const result = Object.values(urls).filter((e) => !!e) as string[];
  let firstElement: string | undefined = undefined;

  switch (sourceID) {
    case "source-zotero-scraper-github":
      firstElement = urls.github;
      break;
    case "source-zotero-scraper-ghproxy":
      firstElement = urls.ghProxy;
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
