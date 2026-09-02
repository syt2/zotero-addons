import { assert } from "chai";
import { downloadFailoverReason } from "../src/services/AddonInstallService";

describe("XPI download source failover", function () {
  it("keeps a slow final source as the last resort", function () {
    assert.isUndefined(
      downloadFailoverReason({
        hasFallback: false,
        idleForMs: 60000,
        sampleDurationMs: 60000,
        sampleBytes: 0,
      }),
    );
  });

  it("fails over when a download stops making progress", function () {
    assert.equal(
      downloadFailoverReason({
        hasFallback: true,
        idleForMs: 8000,
        sampleDurationMs: 8000,
        sampleBytes: 0,
      }),
      "stalled",
    );
  });

  it("fails over when sustained throughput is too low", function () {
    assert.equal(
      downloadFailoverReason({
        hasFallback: true,
        idleForMs: 100,
        sampleDurationMs: 12000,
        sampleBytes: 100 * 1024,
      }),
      "too-slow",
    );
  });

  it("keeps a source that is making acceptable progress", function () {
    assert.isUndefined(
      downloadFailoverReason({
        hasFallback: true,
        idleForMs: 100,
        sampleDurationMs: 12000,
        sampleBytes: 256 * 1024,
      }),
    );
  });
});
