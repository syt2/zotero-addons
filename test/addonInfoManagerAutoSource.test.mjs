import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers";
import { createJiti } from "jiti";

globalThis.Zotero = { version: "11.0-beta.1" };
globalThis.Services = {
  prefs: {
    getStringPref: (key, fallback) =>
      key === "app.update.channel" ? "beta" : fallback,
    getBoolPref: (key, fallback) =>
      key === "extensions.strictCompatibility" ? false : fallback,
  },
  vc: { compare: () => 0 },
};
globalThis.getPref = () => false;
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { AddonInfoManager } = await jiti.import("../src/modules/addonInfo.ts");

function source(id, host) {
  return {
    id,
    api: `https://${host}/current.json`,
    versionedApi: `https://${host}/addon_infos_{zoteroMajor}.json`,
  };
}

test("cancels both catalog requests when another mirror wins", async () => {
  const sourceA = source("source-zotero-scraper-github", "a.example");
  const sourceB = source("source-zotero-scraper-gitee", "b.example");
  const scheduled = [];
  const cancelled = [];
  let selected;
  const manager = new AddonInfoManager({
    currentSource: () => ({ id: "source-auto" }),
    sources: [sourceA, sourceB],
    setAutoSource: (value) => {
      selected = value;
    },
    fetchAddonInfos: async (url, options) => {
      if (url.startsWith("https://a.example/")) {
        return await new Promise(() => {
          options?.cancellerReceiver?.(() => cancelled.push(url));
        });
      }
      return [{ repo: url, releases: [] }];
    },
    now: () => new Date("2026-10-26T00:00:00Z"),
    staggerScheduler: {
      schedule(callback) {
        scheduled.push(callback);
        return callback;
      },
      cancel() {},
    },
    log: () => undefined,
  });

  const resultPromise = manager.fetchAddonInfos(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  const result = await resultPromise;

  assert.equal(result.length, 2);
  assert.equal(selected?.id, sourceB.id);
  assert.deepEqual(cancelled.sort(), [
    "https://a.example/addon_infos_10.json",
    "https://a.example/addon_infos_11.json",
  ]);
});
