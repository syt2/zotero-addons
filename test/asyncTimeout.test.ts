import { assert } from "chai";
import { TimeoutError, withTimeout } from "../src/utils/async";

describe("async timeout", function () {
  it("resolves with the source value", async function () {
    assert.equal(await withTimeout(Promise.resolve("ok"), 100), "ok");
  });

  it("preserves a source rejection before the timeout", async function () {
    let error: unknown;
    try {
      await withTimeout(Promise.reject(new Error("source failed")), 100);
    } catch (caught) {
      error = caught;
    }

    assert.instanceOf(error, Error);
    assert.equal((error as Error).message, "source failed");
    assert.notInstanceOf(error, TimeoutError);
  });

  it("times out, runs cleanup, and handles a late rejection", async function () {
    let cleanedUp = false;
    let rejectLate!: (reason: Error) => void;
    const late = new Promise<never>((_, reject) => {
      rejectLate = reject;
    });

    let error: unknown;
    try {
      await withTimeout(late, 10, () => {
        cleanedUp = true;
      });
    } catch (caught) {
      error = caught;
    }

    assert.instanceOf(error, TimeoutError);
    assert.isTrue(cleanedUp);
    rejectLate(new Error("late failure"));
    await Promise.resolve();
  });
});
