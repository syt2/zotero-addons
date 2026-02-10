import { getPref, setPref } from "./prefs";

/**
 * Add-on Source ID
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
 * Add-on Source
 * id: Source ID
 * api: Retrieve the JSON of addonInfo through this URL
 */
export interface Source {
  id: SourceID;
  api?: string;
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
  },
  {
    id: "source-zotero-scraper-gitee",
    api: "https://gitee.com/ytshen/zotero-addon-scraper/raw/publish/addon_infos.json",
  },
  {
    id: "source-zotero-scraper-jsdelivr",
    api: "https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/addon_infos.json",
  },
  {
    id: "source-zotero-scraper-ghproxy",
    api: "https://gh-proxy.org/https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
  },
  {
    id: "source-zotero-chinese-github",
    api: "https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/dist/plugins.json",
  },
  {
    id: "source-zotero-chinese-gitee",
    api: "https://gitee.com/northword/zotero-plugins/raw/gh-pages/dist/plugins.json",
  },
  {
    id: "source-zotero-chinese-jsdelivr",
    api: "https://cdn.jsdelivr.net/gh/zotero-chinese/zotero-plugins@gh-pages/dist/plugins.json",
  },
  {
    id: "source-zotero-chinese-ghproxy",
    api: "https://gh-proxy.org/https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/dist/plugins.json",
  },
  {
    id: "source-custom",
  },
];

/**
 * Get selected source
 * @returns selected source
 */
export function currentSource(): Readonly<Source> {
  const curSource = getPref("source");
  const match = Sources.find((source) => {
    return source.id === curSource;
  });
  if (match) {
    if (match.id === "source-auto") {
      if (autoSource()) {
        return {
          id: "source-auto",
          api: autoSource()?.api,
        };
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
    return match;
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
