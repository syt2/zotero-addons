import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCompatibilityPolicy } from "../src/utils/releaseChannel.ts";

test("preview builds with relaxed max-version enforcement use fallback", () => {
  assert.deepEqual(
    buildCompatibilityPolicy({
      version: "11.0-beta.1",
      updateChannel: "beta",
      strictCompatibility: false,
    }),
    {
      isPreviewBuild: true,
      enforceMaxVersion: false,
      usePreviousMajorFallback: true,
    },
  );
});

test("stable builds remain strict even when strictCompatibility is false", () => {
  assert.deepEqual(
    buildCompatibilityPolicy({
      version: "11.0.1",
      updateChannel: "release",
      strictCompatibility: false,
    }),
    {
      isPreviewBuild: false,
      enforceMaxVersion: false,
      usePreviousMajorFallback: false,
    },
  );
});

test("dev/source suffixes are preview builds", () => {
  for (const suffix of ["dev", "source"]) {
    const policy = buildCompatibilityPolicy({
      version: `11.0.0-${suffix}`,
      updateChannel: "release",
      strictCompatibility: false,
    });
    assert.equal(policy.isPreviewBuild, true);
    assert.equal(policy.usePreviousMajorFallback, true);
  }
});
