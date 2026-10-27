import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

globalThis.Zotero = {
  version: "11.0-beta.1",
  Prefs: { get: () => false },
};
globalThis.Services = {
  prefs: {
    getStringPref: (key, fallback) =>
      key === "app.update.channel" ? "beta" : fallback,
    getBoolPref: (key, fallback) =>
      key === "extensions.strictCompatibility" ? false : fallback,
  },
  vc: {
    compare(left, right) {
      const parse = (value) =>
        value.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
      const a = parse(left);
      const b = parse(right);
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        if ((a[index] ?? 0) !== (b[index] ?? 0)) {
          return (a[index] ?? 0) - (b[index] ?? 0);
        }
      }
      return 0;
    },
  },
};
globalThis.getPref = () => false;
globalThis.ztoolkit = {
  log: () => undefined,
  getGlobal: () => undefined,
};
globalThis.addon = { data: { locale: undefined } };

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { TableDataTransformer } = await jiti.import(
  "../src/ui/table/TableDataTransformer.ts",
);

function release(target, version) {
  return {
    targetZoteroVersion: String(target),
    tagName: `v${version}`,
    xpiVersion: version,
    minZoteroVersion: `${target}.0`,
    maxZoteroVersion: `${target}.*`,
    xpiDownloadUrl: { github: `https://example.test/${version}.xpi` },
  };
}

function row(repo, stars, target) {
  return [
    { repo, stars, releases: [release(target, "1.0.0")] },
    { "menu-install-state": "not-installed" },
  ];
}

test("selected column remains primary across compatibility groups", () => {
  const nativeLowStars = row("owner/native", 1, 11);
  const previousHighStars = row("owner/previous", 10, 10);
  const sorted = TableDataTransformer.sortAddonInfos(
    [nativeLowStars, previousHighStars],
    { dataKey: "menu-star", sortDirection: -1 },
  );

  assert.deepEqual(
    sorted.map(([addon]) => addon.repo),
    ["owner/previous", "owner/native"],
  );
});

test("compatibility is only a tie-breaker for equal column values", () => {
  const previous = row("owner/previous", 10, 10);
  const native = row("owner/native", 10, 11);
  const sorted = TableDataTransformer.sortAddonInfos([previous, native], {
    dataKey: "menu-star",
    sortDirection: -1,
  });

  assert.deepEqual(
    sorted.map(([addon]) => addon.repo),
    ["owner/native", "owner/previous"],
  );
});
