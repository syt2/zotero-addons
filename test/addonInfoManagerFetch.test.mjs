import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

globalThis.Services = {
  vc: { compare: () => 0 },
};
globalThis.getPref = () => false;
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { AddonInfoManager } = await jiti.import("../src/modules/addonInfo.ts");

const source = {
  id: "source-zotero-scraper-github",
  api: "https://example.test/current.json",
  apis: [
    "https://example.test/current.json",
    "https://example.test/previous.json",
  ],
};

function release(target, version) {
  return {
    targetZoteroVersion: String(target),
    tagName: `v${version}`,
    xpiVersion: version,
    xpiDownloadUrl: { github: `https://example.test/${version}.xpi` },
  };
}

function createManager(responses) {
  const calls = [];
  let selected;
  const manager = new AddonInfoManager({
    currentSource: () => ({
      ...source,
      ...(selected ? { apis: selected } : {}),
    }),
    sources: [source],
    setAutoSource: (value) => {
      selected = value.apis;
    },
    fetchAddonInfos: async (url) => {
      calls.push(url);
      const response = responses[url];
      if (response instanceof Error) throw response;
      return response ?? [];
    },
    now: () => new Date("2026-10-26T00:00:00Z"),
    log: () => undefined,
  });
  return { manager, calls };
}

test("fetches current and previous indexes and merges their releases", async () => {
  const { manager, calls } = createManager({
    "https://example.test/current.json": [
      { repo: "owner/addon", releases: [release(11, "2.0.0")] },
    ],
    "https://example.test/previous.json": [
      { repo: "owner/addon", releases: [release(10, "1.0.0")] },
      { repo: "owner/legacy", releases: [release(10, "3.0.0")] },
    ],
  });

  const result = await manager.fetchAddonInfos(true);
  assert.deepEqual(calls, [
    "https://example.test/current.json",
    "https://example.test/previous.json",
  ]);
  assert.deepEqual(
    result.map((addon) => [addon.repo, addon.releases.length]),
    [
      ["owner/addon", 2],
      ["owner/legacy", 1],
    ],
  );
});

test("keeps the current catalog when the previous index fails", async () => {
  const { manager } = createManager({
    "https://example.test/current.json": [
      { repo: "owner/addon", releases: [release(11, "2.0.0")] },
    ],
    "https://example.test/previous.json": new Error("network"),
  });

  const result = await manager.fetchAddonInfos(true);
  assert.deepEqual(result, [
    { repo: "owner/addon", releases: [release(11, "2.0.0")] },
  ]);
});

test("treats a missing current index as a failed source", async () => {
  const { manager } = createManager({
    "https://example.test/current.json": [],
    "https://example.test/previous.json": [
      { repo: "owner/legacy", releases: [release(10, "3.0.0")] },
    ],
  });

  assert.deepEqual(await manager.fetchAddonInfos(true), []);
});
