import { getPref, setPref } from "./prefs";
import { currentBuildCompatibilityPolicy } from "./releaseChannel";

/**
 * Add-on Source ID
 */
export type SourceID =
  | "source-auto"
  | "source-zotero-scraper-github"
  | "source-zotero-scraper-gitee"
  | "source-zotero-scraper-ghproxy"
  | "source-zotero-scraper-ghfast"
  | "source-zotero-scraper-ghproxynet"
  | "source-zotero-scraper-jsdelivr"
  | "source-custom";

/**
 * Add-on Source
 * id: Source ID
 * api: Retrieve the JSON of addonInfo through this URL
 */
export interface Source {
  id: SourceID;
  api?: string;
  /**
   * Version-filtered index. `{zoteroMajor}` is replaced with the current
   * Zotero major version before requesting it.
   */
  versionedApi?: string;
}

/**
 * Support sources
 */
export const Sources: Readonly<Readonly<Source>[]> = <const>[
  {
    id: "source-auto",
  },
  {
    id: "source-zotero-scraper-github",
    api: "https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
    versionedApi:
      "https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-zotero-scraper-gitee",
    api: "https://gitee.com/ytshen/zotero-addon-scraper/raw/publish/addon_infos.json",
    versionedApi:
      "https://gitee.com/ytshen/zotero-addon-scraper/raw/publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-zotero-scraper-jsdelivr",
    api: "https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/addon_infos.json",
    versionedApi:
      "https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-zotero-scraper-ghproxy",
    api: "https://gh-proxy.org/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
    versionedApi:
      "https://gh-proxy.org/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-zotero-scraper-ghfast",
    api: "https://ghfast.top/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
    versionedApi:
      "https://ghfast.top/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-zotero-scraper-ghproxynet",
    api: "https://ghproxy.net/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
    versionedApi:
      "https://ghproxy.net/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos_{zoteroMajor}.json",
  },
  {
    id: "source-custom",
  },
];

interface IndexResolutionOptions {
  showAllAddons?: boolean;
  zoteroVersion?: string;
  usePreviousMajorFallback?: boolean;
}

function currentMajorVersion(zoteroVersion?: string) {
  return (zoteroVersion ?? Zotero.version).split(".")[0];
}

function resolveVersionedApi(source: Readonly<Source>, zoteroMajor: string) {
  return source.versionedApi?.replace("{zoteroMajor}", zoteroMajor);
}

function resolveIndexApis(
  source: Readonly<Source>,
  zoteroMajor: string,
  usePreviousMajorFallback: boolean,
) {
  const currentMajor = Number.parseInt(zoteroMajor, 10);
  if (!Number.isFinite(currentMajor)) {
    return [];
  }
  const majors = usePreviousMajorFallback
    ? [currentMajor, currentMajor - 1]
    : [currentMajor];
  return majors
    .map((major) => resolveVersionedApi(source, String(major)))
    .filter((api): api is string => Boolean(api));
}

/**
 * Resolve every index that represents the compatibility catalog for a source.
 * Preview builds return current-major followed by previous-major; stable
 * builds return only the current-major index.
 */
export function resolveSourceApis(
  source: Readonly<Source>,
  options?: IndexResolutionOptions,
) {
  const policy = currentBuildCompatibilityPolicy();
  const showAllAddons =
    options?.showAllAddons ??
    (!policy.isPreviewBuild && getPref("showAllAddons") === true);
  if (showAllAddons || !source.versionedApi) {
    return source.api ? [source.api] : [];
  }
  const usePreviousMajorFallback =
    options?.usePreviousMajorFallback ?? policy.usePreviousMajorFallback;
  return resolveIndexApis(
    source,
    currentMajorVersion(options?.zoteroVersion),
    usePreviousMajorFallback,
  );
}

/**
 * Resolve the primary index URL for a source. The all-addons index is used
 * only when explicitly requested; callers that fetch the compatibility catalog
 * should prefer resolveSourceApis().
 */
export function resolveSourceApi(
  source: Readonly<Source>,
  options?: IndexResolutionOptions,
) {
  return resolveSourceApis(source, options)[0];
}

/**
 * A source with the complete endpoint set for one compatibility catalog.
 */
export type ResolvedSource = Readonly<Source & { apis?: readonly string[] }>;

/**
 * Attach the resolved compatibility indexes to a source without changing its
 * identity. `api` remains the primary endpoint for backwards compatibility.
 */
export function withResolvedApis(
  source: Readonly<Source>,
  options?: IndexResolutionOptions,
): ResolvedSource {
  const apis = resolveSourceApis(source, options);
  return { ...source, api: apis[0], apis };
}

/**
 * Get selected source
 * @returns selected source
 */
export function currentSource(): Readonly<
  Source & { apis?: readonly string[] }
> {
  const curSource = getPref("source");
  const match = Sources.find((source) => {
    return source.id === curSource;
  });
  if (match) {
    if (match.id === "source-auto") {
      if (autoSource()) {
        return withResolvedApis(autoSource()!);
      }
      return match;
    }
    if (match.id === "source-custom") {
      if (getPref("customSource")) {
        return {
          id: "source-custom",
          api: getPref("customSource"),
        };
      }
      return match;
    }
    return withResolvedApis(match);
  }
  return Sources[0];
}

/**
 * Set selected source
 * @param source Selected source
 */
export function setCurrentSource(source?: string) {
  if (source && Sources.find((e) => e.id === source)) {
    setPref("source", source);
  } else {
    setPref("source", "source-auto");
  }
}

let _autoSource: Readonly<Source> | undefined = undefined;
/**
 * Get current auto source
 * @returns auto source with its auto api url
 */
export function autoSource(): Readonly<Source> | undefined {
  return _autoSource;
}

/**
 * Set current auto source
 * @param source A Source
 */
export function setAutoSource(source: Readonly<Source>) {
  _autoSource = source;
}

/**
 * Get custom source's api
 * @returns Custom source's api url string
 */
export function customSourceApi() {
  return getPref("customSource");
}

/**
 * Set custom source's api
 * @param api custom source's api url string
 */
export function setCustomSourceApi(api: string) {
  setPref("customSource", api);
}
