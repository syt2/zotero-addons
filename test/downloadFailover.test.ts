import { assert } from "chai";
import { shouldFailOverStalledDownload } from "../src/services/AddonInstallService";

describe("XPI download source failover", function () {
  it("keeps waiting while the current source is making progress", function () {
    assert.isFalse(
      shouldFailOverStalledDownload({
        hasFallback: true,
        idleForMs: 9999,
      }),
    );
  });

  it("fails over after ten seconds without progress", function () {
    assert.isTrue(
      shouldFailOverStalledDownload({
        hasFallback: true,
        idleForMs: 10000,
      }),
    );
  });

  it("keeps a stalled final source as the last resort", function () {
    assert.isFalse(
      shouldFailOverStalledDownload({
        hasFallback: false,
        idleForMs: 60000,
      }),
    );
  });
});
