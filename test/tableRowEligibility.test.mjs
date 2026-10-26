import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

globalThis.Zotero = { version: "11.0-beta.1" };
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
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { displayAddonReleaseInfo } = await jiti.import(
  "../src/modules/addonInfo.ts",
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

test("preview rows select native before previous-major", () => {
  const addon = {
    repo: "owner/addon",
    releases: [release(10, "2.0.0"), release(11, "3.0.0")],
  };
  assert.equal(displayAddonReleaseInfo(addon)?.release.xpiVersion, "3.0.0");
  assert.equal(displayAddonReleaseInfo(addon)?.eligibility, "native");
});

test("preview rows fall back to previous-major exactly once", () => {
  const addon = {
    repo: "owner/addon",
    releases: [release(9, "1.0.0"), release(10, "2.0.0")],
  };
  assert.equal(displayAddonReleaseInfo(addon)?.release.xpiVersion, "2.0.0");
  assert.equal(displayAddonReleaseInfo(addon)?.eligibility, "previous-major");
});
