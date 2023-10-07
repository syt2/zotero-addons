import { getString } from "./locale";
import { getPref, setPref } from "./prefs";

interface Source {
  id: 
  "source-default" | 
  "source-custom";
  api?: string;
};

export const Sources: Readonly<Readonly<Source>[]> = <const>[
  {
    id: "source-default",
    api: "https://github.com/syt2/zotero-addons-scraper/releases/latest/download/addon_infos.json",
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
  if (match) { return match; }
  return Sources[0];
}

export function setCurrentSource(source?: string) {
  if (source && Sources.find(e => e.id === source)) {
    setPref('source', source);
  } else {
    setPref('source', 'source-default');
  }
}

export function customSourceApi() {
  return getPref('customSource') as string
}

export function setCustomSourceApi(api: string) {
  setPref('customSource', api);
}