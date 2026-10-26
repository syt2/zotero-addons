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

test("selects native release before previous-major", () => {
  const selected = selectAddonRelease(
    {
      repo: "owner/addon",
      releases: [release(10, "2.0.0"), release(11, "3.0.0")],
    },
    {
      currentVersion: "11.0-beta.1",
      allowPreviousMajor: true,
      allowUnsupported: false,
    },
  );
  assert.equal(selected?.release.xpiVersion, "3.0.0");
  assert.equal(selected?.eligibility, "native");
});

test("selects previous-major when no native release exists", () => {
  const selected = selectAddonRelease(
    {
      repo: "owner/addon",
      releases: [release(9, "1.0.0"), release(10, "2.0.0")],
    },
    {
      currentVersion: "11.0-beta.1",
      allowPreviousMajor: true,
      allowUnsupported: false,
    },
  );
  assert.equal(selected?.release.xpiVersion, "2.0.0");
  assert.equal(selected?.eligibility, "previous-major");
});
