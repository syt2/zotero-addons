import { assert } from "chai";
import {
  findRelatedAddon,
  releaseMatchesInstalledAddon,
  type AddonInfo,
} from "../src/modules/addonInfo";
import type { LocalAddon } from "../src/types";

const currentMajor = Number.parseInt(Zotero.version, 10);

function remoteAddon(options: {
  id?: string;
  name: string;
  repo?: string;
  version?: string;
}): AddonInfo {
  return {
    repo: options.repo ?? "example/remote-addon",
    name: options.name,
    releases: [
      {
        targetZoteroVersion: String(currentMajor),
        tagName: "v2.0.0",
        id: options.id,
        name: options.name,
        xpiVersion: options.version ?? "2.0.0",
        minZoteroVersion: "6.999",
        maxZoteroVersion: "*",
        xpiDownloadUrl: {
          github: "https://example.test/addon.xpi",
        },
      },
    ],
  };
}

function localAddon(
  options: Partial<LocalAddon> & Pick<LocalAddon, "id" | "name">,
): LocalAddon {
  return {
    version: "1.0.0",
    homepageURL: `https://github.com/${options.id}`,
    updateURL: `https://github.com/${options.id}/update.json`,
    userDisabled: false,
    appDisabled: false,
    isCompatible: true,
    isPlatformCompatible: true,
    enable: async () => undefined,
    disable: async () => undefined,
    uninstall: async () => undefined,
    cancelUninstall: () => undefined,
    ...options,
  };
}

describe("add-on identity matching", function () {
  it("does not match unrelated add-ons that share a display name", function () {
    const local = localAddon({
      id: "chat@zotero-mcp",
      name: "Zotero Agent",
      version: "0.15.1",
    });
    const remote = remoteAddon({
      id: "zotero-agent@autoagent.my",
      name: "Zotero Agent",
      repo: "psiQAQ/zotero-agent",
      version: "2.2.2",
    });

    assert.isUndefined(findRelatedAddon(remote, [local]));
    assert.isFalse(releaseMatchesInstalledAddon(remote, local));
  });

  it("matches by release ID even when the display name changed", function () {
    const local = localAddon({
      id: "same@id",
      name: "Old Display Name",
    });
    const remote = remoteAddon({
      id: "same@id",
      name: "New Display Name",
    });

    assert.strictEqual(findRelatedAddon(remote, [local]), local);
    assert.isTrue(releaseMatchesInstalledAddon(remote, local));
  });

  it("disambiguates duplicate release IDs using the installed add-on name", function () {
    const local = localAddon({
      id: "shared@id",
      name: "Fr AI",
      homepageURL: "https://github.com/example/fr-ai",
    });
    const owner = remoteAddon({
      id: "shared@id",
      name: "Add-on Butler",
      repo: "example/addon-butler",
    });
    const collision = remoteAddon({
      id: "shared@id",
      name: "Fr AI",
      repo: "example/fr-ai",
    });
    const catalog = [owner, collision];

    assert.isUndefined(findRelatedAddon(owner, [local], catalog));
    assert.isFalse(releaseMatchesInstalledAddon(owner, local, catalog));
    assert.strictEqual(findRelatedAddon(collision, [local], catalog), local);
    assert.isTrue(releaseMatchesInstalledAddon(collision, local, catalog));
  });

  it("uses repository metadata to disambiguate renamed duplicate IDs", function () {
    const local = localAddon({
      id: "shared@id",
      name: "Old Display Name",
      homepageURL: "https://github.com/example/fr-ai",
    });
    const owner = remoteAddon({
      id: "shared@id",
      name: "Other Add-on",
      repo: "example/other-addon",
    });
    const collision = remoteAddon({
      id: "shared@id",
      name: "New Display Name",
      repo: "example/fr-ai",
    });
    const catalog = [owner, collision];

    assert.isUndefined(findRelatedAddon(owner, [local], catalog));
    assert.strictEqual(findRelatedAddon(collision, [local], catalog), local);
  });

  it("rejects duplicate IDs that cannot be disambiguated safely", function () {
    const local = localAddon({
      id: "shared@id",
      name: "Shared Name",
      homepageURL: "",
      updateURL: "",
    });
    const first = remoteAddon({
      id: "shared@id",
      name: "Shared Name",
      repo: "example/first",
    });
    const second = remoteAddon({
      id: "shared@id",
      name: "Shared Name",
      repo: "example/second",
    });
    const catalog = [first, second];

    assert.isUndefined(findRelatedAddon(first, [local], catalog));
    assert.isUndefined(findRelatedAddon(second, [local], catalog));
  });

  it("does not fall back to URL matching when the release ID is missing", function () {
    const local = localAddon({
      id: "installed@id",
      name: "Shared Name",
      homepageURL: "https://github.com/example/remote-addon",
      updateURL: "https://github.com/example/remote-addon/update.json",
    });
    const remote = remoteAddon({
      name: "Shared Name",
    });

    assert.isUndefined(findRelatedAddon(remote, [local]));
    assert.isFalse(releaseMatchesInstalledAddon(remote, local));
  });
});
