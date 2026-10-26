import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

globalThis.Zotero = {
  version: "11.0.3",
  Prefs: { get: () => false },
};
globalThis.Services = {
  prefs: {
    getStringPref: (_key, fallback) => fallback,
    getBoolPref: (_key, fallback) => fallback,
  },
};
globalThis.getPref = () => false;
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { resolveSourceApis } = await jiti.import(
  "../src/utils/configuration.ts",
);

const source = {
  id: "source-zotero-scraper-github",
  api: "https://example.test/addon_infos.json",
  versionedApi: "https://example.test/addon_infos_{zoteroMajor}.json",
};

test("stable compatibility catalog uses only the current major index", () => {
  assert.deepEqual(
    resolveSourceApis(source, {
      showAllAddons: false,
      zoteroVersion: "11.0.3",
      usePreviousMajorFallback: false,
    }),
    ["https://example.test/addon_infos_11.json"],
  );
});

test("preview compatibility catalog resolves current then previous major", () => {
  assert.deepEqual(
    resolveSourceApis(source, {
      showAllAddons: false,
      zoteroVersion: "11.0-beta.1",
      usePreviousMajorFallback: true,
    }),
    [
      "https://example.test/addon_infos_11.json",
      "https://example.test/addon_infos_10.json",
    ],
  );
});

test("preview builds honor a persisted show-all preference", () => {
  globalThis.Zotero = {
    version: "11.0-beta.1",
    Prefs: { get: () => true },
  };
  globalThis.Services.prefs.getStringPref = () => "beta";
  globalThis.Services.prefs.getBoolPref = () => false;
  assert.deepEqual(
    resolveSourceApis(source, {
      zoteroVersion: "11.0-beta.1",
    }),
    [source.api],
  );
  globalThis.Zotero = {
    version: "11.0.3",
    Prefs: { get: () => false },
  };
  globalThis.Services.prefs.getStringPref = (_key, fallback) => fallback;
  globalThis.Services.prefs.getBoolPref = (_key, fallback) => fallback;
  globalThis.getPref = () => false;
});

test("preview all-addons mode remains a single full index", () => {
  assert.deepEqual(
    resolveSourceApis(source, {
      showAllAddons: true,
      zoteroVersion: "11.0-beta.1",
      usePreviousMajorFallback: true,
    }),
    [source.api],
  );
});

test("stable all-addons mode remains a single full index", () => {
  assert.deepEqual(
    resolveSourceApis(source, {
      showAllAddons: true,
      zoteroVersion: "11.0.3",
      usePreviousMajorFallback: true,
    }),
    [source.api],
  );
});
