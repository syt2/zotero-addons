import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { mergeAddonCatalogs } = await jiti.import(
  "../src/utils/addonCatalog.ts",
);

function release(target, version, id) {
  return {
    targetZoteroVersion: String(target),
    tagName: `v${version}`,
    xpiVersion: version,
    id,
    xpiDownloadUrl: { github: `https://example.test/${id}.xpi` },
  };
}

test("merges add-ons by repository with current releases first", () => {
  const current = [
    {
      repo: "owner/addon",
      name: "Current name",
      releases: [release(11, "2.0.0", "addon@example.com")],
    },
  ];
  const previous = [
    {
      repo: "OWNER/addon",
      name: "Previous name",
      releases: [release(10, "1.0.0", "addon@example.com")],
    },
    {
      repo: "owner/previous-only",
      releases: [release(10, "3.0.0", "previous@example.com")],
    },
  ];

  assert.deepEqual(mergeAddonCatalogs(current, previous), [
    {
      repo: "owner/addon",
      name: "Current name",
      releases: [
        release(11, "2.0.0", "addon@example.com"),
        release(10, "1.0.0", "addon@example.com"),
      ],
    },
    {
      repo: "owner/previous-only",
      releases: [release(10, "3.0.0", "previous@example.com")],
    },
  ]);
});

test("deduplicates releases without treating cross-repository IDs as unique", () => {
  const sharedRelease = release(10, "1.0.0", "same-id@example.com");
  const current = [
    {
      repo: "owner/current",
      releases: [release(11, "2.0.0", "same-id@example.com")],
    },
  ];
  const previous = [
    { repo: "owner/current", releases: [sharedRelease, sharedRelease] },
    {
      repo: "owner/collision",
      releases: [release(10, "9.0.0", "same-id@example.com")],
    },
  ];

  assert.deepEqual(
    mergeAddonCatalogs(current, previous).map((addon) => addon.repo),
    ["owner/current", "owner/collision"],
  );
  assert.equal(mergeAddonCatalogs(current, previous)[0].releases.length, 2);
});
