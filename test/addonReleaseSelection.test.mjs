import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

globalThis.Services = {
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
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { selectAddonRelease } = await jiti.import(
  "../src/utils/addonReleaseSelection.ts",
);

function release(target, version, releaseDate = "2026-01-01") {
  return {
    targetZoteroVersion: String(target),
    tagName: `v${version}`,
    xpiVersion: version,
    minZoteroVersion: `${target}.0`,
    maxZoteroVersion: `${target}.*`,
    releaseDate,
    xpiDownloadUrl: { github: `https://example.test/${version}.xpi` },
  };
}

test("prefers the current major over the previous major", () => {
  const selected = selectAddonRelease(
    {
      repo: "owner/addon",
      releases: [release(10, "1.0.0"), release(11, "2.0.0")],
    },
    {
      currentVersion: "11.0-beta.1",
      allowPreviousMajor: true,
      allowUnsupported: false,
    },
  );
  assert.equal(selected?.release.xpiVersion, "2.0.0");
  assert.equal(selected?.eligibility, "native");
  assert.equal(selected?.compatible, true);
});

test("uses the previous major only when explicitly allowed", () => {
  const addon = {
    repo: "owner/addon",
    releases: [release(10, "1.0.0")],
  };
  const previous = selectAddonRelease(addon, {
    currentVersion: "11.0-beta.1",
    allowPreviousMajor: true,
    allowUnsupported: false,
  });
  assert.equal(previous?.release.xpiVersion, "1.0.0");
  assert.equal(previous?.eligibility, "previous-major");
  assert.equal(previous?.compatible, false);

  assert.equal(
    selectAddonRelease(addon, {
      currentVersion: "11.0.1",
      allowPreviousMajor: false,
      allowUnsupported: false,
    }),
    undefined,
  );
});

test("never selects a future major", () => {
  const addon = {
    repo: "owner/addon",
    releases: [release(12, "9.0.0"), release(9, "1.0.0")],
  };
  assert.equal(
    selectAddonRelease(addon, {
      currentVersion: "11.0-beta.1",
      allowPreviousMajor: true,
      allowUnsupported: false,
    }),
    undefined,
  );
  const displayed = selectAddonRelease(addon, {
    currentVersion: "11.0-beta.1",
    allowPreviousMajor: true,
    allowUnsupported: true,
  });
  assert.equal(displayed?.release.xpiVersion, "1.0.0");
  assert.equal(displayed?.eligibility, "unsupported");
});

test("does not require the previous release max range to admit 11", () => {
  const previousRelease = release(10, "1.0.0");
  previousRelease.maxZoteroVersion = "10.99.99";
  const selected = selectAddonRelease(
    {
      repo: "owner/addon",
      releases: [previousRelease],
    },
    {
      currentVersion: "11.0-beta.1",
      allowPreviousMajor: true,
      allowUnsupported: false,
    },
  );
  assert.equal(selected?.release.xpiVersion, "1.0.0");
  assert.equal(selected?.eligibility, "previous-major");
});
