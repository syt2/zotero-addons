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
globalThis.getPref = (key) => key === "showAllAddons";
globalThis.ztoolkit = { log: () => undefined };

const jiti = createJiti(import.meta.url, { interopDefault: true });
const {
  addonCanUpdate,
  addonCanUpdateToDisplayedRelease,
  addonReleaseCanBeInstalled,
  displayAddonReleaseInfo,
  findRelatedAddon,
  releaseMatchesInstalledAddon,
} = await jiti.import("../src/modules/addonInfo.ts");

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

const previousOnly = {
  repo: "owner/addon",
  releases: [release(10, "2.0.0")],
};
const native = {
  repo: "owner/native",
  releases: [release(11, "3.0.0"), release(10, "2.0.0")],
};
const futureOnly = {
  repo: "owner/future",
  releases: [release(12, "4.0.0")],
};

test("preview display ignores the persisted show-all preference", () => {
  const selected = displayAddonReleaseInfo(previousOnly);
  assert.equal(selected?.release.xpiVersion, "2.0.0");
  assert.equal(selected?.eligibility, "previous-major");
});

test("preview explicit actions allow previous-major releases", () => {
  assert.equal(true, addonReleaseCanBeInstalled(previousOnly));
  assert.equal(
    true,
    addonCanUpdateToDisplayedRelease(previousOnly, {
      version: "1.0.0",
    }),
  );
});

test("unsupported future releases cannot be installed", () => {
  assert.equal(false, addonReleaseCanBeInstalled(futureOnly));
  assert.equal(
    false,
    addonCanUpdateToDisplayedRelease(futureOnly, { version: "1.0.0" }),
  );
});

test("preview fallback can be matched for explicit UI actions only", () => {
  const addon = {
    repo: "owner/addon",
    releases: [
      {
        ...release(10, "2.0.0"),
        id: "fallback@example.com",
      },
    ],
  };
  const local = {
    id: "fallback@example.com",
    name: "Addon",
    version: "1.0.0",
  };
  assert.strictEqual(findRelatedAddon(addon, [local]), local);
  assert.equal(false, releaseMatchesInstalledAddon(addon, local));
});

test("automatic updates never use previous-major releases", () => {
  assert.equal(
    false,
    addonCanUpdate(previousOnly, {
      version: "1.0.0",
    }),
  );
  assert.equal(
    true,
    addonCanUpdate(native, {
      version: "2.5.0",
    }),
  );
});
