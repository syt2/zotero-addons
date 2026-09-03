import { assert } from "chai";
import {
  firstSuccessfulStaggered,
  type StaggerScheduler,
} from "../src/utils/staggeredRequests";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function manualScheduler() {
  const scheduled: Array<{
    callback: VoidFunction;
    delayMs: number;
    cancelled: boolean;
  }> = [];
  const scheduler: StaggerScheduler = {
    schedule(callback, delayMs) {
      const task = { callback, delayMs, cancelled: false };
      scheduled.push(task);
      return task;
    },
    cancel(handle) {
      (handle as (typeof scheduled)[number]).cancelled = true;
    },
  };
  return {
    scheduler,
    runNext() {
      const task = scheduled.find((candidate) => !candidate.cancelled);
      assert.exists(task, "expected a scheduled source start");
      task!.cancelled = true;
      task!.callback();
    },
    pendingCount() {
      return scheduled.filter((task) => !task.cancelled).length;
    },
    pendingDelays() {
      return scheduled
        .filter((task) => !task.cancelled)
        .map((task) => task.delayMs);
    },
  };
}

describe("staggered source requests", function () {
  it("returns undefined without scheduling when there are no sources", async function () {
    const timer = manualScheduler();

    assert.isUndefined(
      await firstSuccessfulStaggered([], 3000, timer.scheduler),
    );
    assert.equal(timer.pendingCount(), 0);
  });

  it("handles a single source without scheduling", async function () {
    const successTimer = manualScheduler();
    const failureTimer = manualScheduler();

    assert.equal(
      await firstSuccessfulStaggered(
        [async () => "result"],
        3000,
        successTimer.scheduler,
      ),
      "result",
    );
    assert.isUndefined(
      await firstSuccessfulStaggered(
        [async () => Promise.reject(new Error("source failed"))],
        3000,
        failureTimer.scheduler,
      ),
    );
    assert.equal(successTimer.pendingCount(), 0);
    assert.equal(failureTimer.pendingCount(), 0);
  });

  it("does not start another source when the first one succeeds", async function () {
    const timer = manualScheduler();
    const started: string[] = [];

    const result = await firstSuccessfulStaggered(
      [
        async () => {
          started.push("A");
          return "A result";
        },
        async () => {
          started.push("B");
          return "B result";
        },
      ],
      3000,
      timer.scheduler,
    );

    assert.equal(result, "A result");
    assert.deepEqual(started, ["A"]);
    assert.equal(timer.pendingCount(), 0);
  });

  it("starts sources in order and keeps earlier requests active", async function () {
    const first = deferred<string | undefined>();
    const second = deferred<string | undefined>();
    const third = deferred<string | undefined>();
    const timer = manualScheduler();
    const started: string[] = [];
    const cancelled: string[] = [];

    const resultPromise = firstSuccessfulStaggered(
      [
        (registerCanceller) => {
          started.push("A");
          registerCanceller(() => cancelled.push("A"));
          return first.promise;
        },
        (registerCanceller) => {
          started.push("B");
          registerCanceller(() => cancelled.push("B"));
          return second.promise;
        },
        (registerCanceller) => {
          started.push("C");
          registerCanceller(() => cancelled.push("C"));
          return third.promise;
        },
      ],
      3000,
      timer.scheduler,
    );

    assert.deepEqual(started, ["A"]);
    assert.deepEqual(timer.pendingDelays(), [3000]);
    timer.runNext();
    await Promise.resolve();
    assert.deepEqual(started, ["A", "B"]);

    first.resolve("A result");
    assert.equal(await resultPromise, "A result");
    assert.deepEqual(cancelled, ["B"]);
    assert.equal(timer.pendingCount(), 0);
    assert.deepEqual(started, ["A", "B"], "C must not be started");
  });

  it("uses a later valid result and cancels remaining requests", async function () {
    const first = deferred<string | undefined>();
    const second = deferred<string | undefined>();
    const third = deferred<string | undefined>();
    const timer = manualScheduler();
    const cancelled: string[] = [];

    const resultPromise = firstSuccessfulStaggered(
      [
        (registerCanceller) => {
          registerCanceller(() => cancelled.push("A"));
          return first.promise;
        },
        (registerCanceller) => {
          registerCanceller(() => cancelled.push("B"));
          return second.promise;
        },
        (registerCanceller) => {
          registerCanceller(() => cancelled.push("C"));
          return third.promise;
        },
      ],
      3000,
      timer.scheduler,
    );

    timer.runNext();
    await Promise.resolve();
    timer.runNext();
    await Promise.resolve();
    second.resolve("B result");

    assert.equal(await resultPromise, "B result");
    assert.deepEqual(cancelled, ["A", "C"]);
  });

  it("continues when a source rejects", async function () {
    const timer = manualScheduler();
    const started: string[] = [];

    const resultPromise = firstSuccessfulStaggered(
      [
        async () => {
          started.push("A");
          throw new Error("source failed");
        },
        async () => {
          started.push("B");
          return "B result";
        },
      ],
      3000,
      timer.scheduler,
    );

    await Promise.resolve();
    timer.runNext();

    assert.equal(await resultPromise, "B result");
    assert.deepEqual(started, ["A", "B"]);
  });

  it("continues when starting a source throws synchronously", async function () {
    const timer = manualScheduler();

    const resultPromise = firstSuccessfulStaggered(
      [
        () => {
          throw new Error("source failed");
        },
        async () => "B result",
      ],
      3000,
      timer.scheduler,
    );

    timer.runNext();
    assert.equal(await resultPromise, "B result");
  });

  it("cancels an active loser that registers its canceller late", async function () {
    const first = deferred<string | undefined>();
    const timer = manualScheduler();
    let registerFirstCanceller: ((canceller: VoidFunction) => void) | undefined;
    let cancelled = false;

    const resultPromise = firstSuccessfulStaggered(
      [
        (registerCanceller) => {
          registerFirstCanceller = registerCanceller;
          return first.promise;
        },
        async () => "B result",
      ],
      3000,
      timer.scheduler,
    );

    timer.runNext();
    assert.equal(await resultPromise, "B result");

    registerFirstCanceller?.(() => {
      cancelled = true;
    });
    assert.isTrue(cancelled);
    first.resolve(undefined);
  });

  it("still resolves when cancelling a loser throws", async function () {
    const first = deferred<string | undefined>();
    const timer = manualScheduler();

    const resultPromise = firstSuccessfulStaggered(
      [
        (registerCanceller) => {
          registerCanceller(() => {
            throw new Error("already finished");
          });
          return first.promise;
        },
        async () => "B result",
      ],
      3000,
      timer.scheduler,
    );

    timer.runNext();
    assert.equal(await resultPromise, "B result");
    first.resolve(undefined);
  });

  it("returns undefined after every source finishes without a result", async function () {
    const timer = manualScheduler();
    const first = deferred<string | undefined>();
    const second = deferred<string | undefined>();

    const resultPromise = firstSuccessfulStaggered(
      [() => first.promise, () => second.promise],
      3000,
      timer.scheduler,
    );

    first.resolve(undefined);
    await Promise.resolve();
    timer.runNext();
    await Promise.resolve();
    second.resolve(undefined);

    assert.isUndefined(await resultPromise);
  });
});
