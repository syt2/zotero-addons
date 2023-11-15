import { getString } from "./locale";
import { getPref, setPref } from "./prefs";


type SourceID =
  "source-auto" |
  "source-zotero-chinese-github" |
  "source-zotero-chinese-gitee" |
  "source-zotero-chinese-jsdelivr" |
  "source-zotero-chinese-ghproxy" |
  "source-zotero-scraper-github-backup" |
  "source-zotero-scraper-ghproxy-backup" |
  "source-zotero-scraper-jsdelivr-backup" |
  "source-custom";

interface Source {
  id: SourceID;
  api?: string;
};

export const Sources: Readonly<Readonly<Source>[]> = <const>[
  {
    id: "source-auto",
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
    api: "https://ghproxy.com/?q=https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/dist/plugins.json",
  },
  {
    id: "source-zotero-scraper-github-backup",
    api: "https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
  },
  {
    id: "source-zotero-scraper-jsdelivr-backup",
    api: "https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/addon_infos.json",
  },
  {
    id: "source-zotero-scraper-ghproxy-backup",
    api: "https://ghproxy.com/?q=https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
  },
  {
    id: "source-custom",
  },
];


export function currentSource(): Readonly<Source> {
  const curSource = getPref('source') as string;
  const match = Sources.find(source => {
    return source.id === curSource;
  });
  if (match) {
    if (match.id === "source-auto") {
      if (autoSource()) {
        return {
          id: "source-auto",
          api: autoSource()?.api,
        }
      }
      return match;
    }
    if (match.id === "source-custom") {
      if (getPref('customSource')) {
        return {
          id: "source-custom",
          api: getPref('customSource') as string,
        }
      }
      return match;
    }
    return match;
  }
  return Sources[0];
}

export function setCurrentSource(source?: string) {
  if (source && Sources.find(e => e.id === source)) {
    setPref('source', source);
  } else {
    setPref('source', 'source-auto');
  }
}

let _autoSource: Readonly<Source> | undefined = undefined;
export function autoSource(): Readonly<Source> | undefined {
  return _autoSource;
}

export function setAutoSource(source: Readonly<Source>) {
  _autoSource = source;
}

export function customSourceApi() {
  return getPref('customSource') as string;
}

export function setCustomSourceApi(api: string) {
  setPref('customSource', api);
}