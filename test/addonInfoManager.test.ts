import { assert } from "chai";
import {
  AddonInfoManager,
  type AddonInfo,
  type AddonInfoManagerDependencies,
} from "../src/modules/addonInfo";
import type { Source } from "../src/utils/configuration";
import type { StaggerScheduler } from "../src/utils/staggeredRequests";

const sourceA = {
  id: "source-zotero-scraper-github",
  api: "https://a.example/addon_infos.json",
} as const satisfies Source;

const sourceB = {
  id: "source-zotero-scraper-gitee",
  api: "https://b.example/addon_infos.json",
} as const satisfies Source;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createManualScheduler() {
  const scheduled: Array<{
    callback: VoidFunction;
    delayMs: number;
    cancelled: boolean;
  }> = [];
  const scheduleWaiters: Array<{ count: number; resolve: VoidFunction }> = [];
  const scheduler: StaggerScheduler = {
    schedule(callback, delayMs) {
      const task = { callback, delayMs, cancelled: false };
      scheduled.push(task);
      for (const waiter of scheduleWaiters) {
        if (scheduled.length >= waiter.count) {
          waiter.resolve();
        }
      }
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
    pendingDelays() {
      return scheduled
        .filter((task) => !task.cancelled)
        .map((task) => task.delayMs);
    },
    waitForScheduleCount(count: number) {
      if (scheduled.length >= count) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        scheduleWaiters.push({ count, resolve });
      });
    },
  };
}

type FetchAddonInfos = AddonInfoManagerDependencies["fetchAddonInfos"];

function createManagerHarness(initialSource: Readonly<Source>) {
  const timer = createManualScheduler();
  const calls: Array<{
    url: string;
    options: Parameters<FetchAddonInfos>[1];
  }> = [];
  const callWaiters: Array<{ count: number; resolve: VoidFunction }> = [];
  const responses: Array<ReturnType<FetchAddonInfos>> = [];
  let selectedSource: Readonly<Source> | undefined;
  let currentSource = initialSource;

  const dependencies: AddonInfoManagerDependencies = {
    currentSource: () => currentSource,
    sources: [sourceA, sourceB],
    setAutoSource: (source) => {
      selectedSource = source;
      currentSource = { id: "source-auto", api: source.api };
    },
    fetchAddonInfos: (url, options) => {
      calls.push({ url, options });
      for (const waiter of callWaiters) {
        if (calls.length >= waiter.count) {
          waiter.resolve();
        }
      }
      const response = responses.shift();
      assert.exists(response, `missing response for ${url}`);
      return response!;
    },
    now: () => new Date("2026-09-03T00:00:00Z"),
    staggerScheduler: timer.scheduler,
    log: () => undefined,
  };

  return {
    manager: new AddonInfoManager(dependencies),
    calls,
    enqueueResponse(response: ReturnType<FetchAddonInfos>) {
      responses.push(response);
    },
    waitForCallCount(count: number) {
      if (calls.length >= count) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        callWaiters.push({ count, resolve });
      });
    },
    getSelectedSource: () => selectedSource,
    timer,
  };
}

describe("automatic add-on source manager", function () {
  const cachedInfos = [{ repo: "test/cached" }] as AddonInfo[];
  const currentInfos = [{ repo: "test/current" }] as AddonInfo[];
  const fallbackInfos = [{ repo: "test/fallback" }] as AddonInfo[];

  it("coalesces the complete forced-refresh operation", async function () {
    const harness = createManagerHarness({
      id: "source-auto",
      api: sourceA.api,
    });
    const response = deferred<AddonInfo[]>();
    harness.enqueueResponse(response.promise);

    const first = harness.manager.fetchAddonInfos(true);
    const second = harness.manager.fetchAddonInfos(true);

    assert.lengthOf(harness.calls, 1);
    assert.equal(harness.calls[0].url, sourceA.api);
    assert.equal(harness.calls[0].options?.timeout, 5000);

    response.resolve(currentInfos);
    assert.strictEqual(await first, currentInfos);
    assert.strictEqual(await second, currentInfos);

    harness.enqueueResponse(Promise.resolve(currentInfos));
    await harness.manager.fetchAddonInfos(true);
    assert.lengthOf(
      harness.calls,
      2,
      "the single-flight state must clear after completion",
    );
  });

  it("retries the full ordered source list after the current source fails", async function () {
    const harness = createManagerHarness({
      id: "source-auto",
      api: sourceA.api,
    });
    harness.enqueueResponse(Promise.resolve([]));
    harness.enqueueResponse(Promise.resolve([]));
    harness.enqueueResponse(Promise.resolve(fallbackInfos));

    const resultPromise = harness.manager.fetchAddonInfos(true);
    await harness.waitForCallCount(2);
    await harness.timer.waitForScheduleCount(1);

    assert.deepEqual(
      harness.calls.map((call) => call.url),
      [sourceA.api, sourceA.api],
      "current source must be retried as the first fallback source",
    );
    assert.deepEqual(
      harness.timer.pendingDelays(),
      [3000],
      "the second fallback source must be staggered",
    );

    harness.timer.runNext();
    assert.strictEqual(
      await resultPromise,
      fallbackInfos,
      "the later valid source must win",
    );
    assert.deepEqual(
      harness.calls.map((call) => call.url),
      [sourceA.api, sourceA.api, sourceB.api],
      "the configured source order must be preserved",
    );
    assert.equal(
      harness.calls[1].options?.timeout,
      10000,
      "fallback requests must use the auto-source timeout",
    );
    assert.isFunction(
      harness.calls[1].options?.cancellerReceiver,
      "fallback requests must register a canceller",
    );
    assert.strictEqual(
      harness.getSelectedSource(),
      sourceB,
      "the winning source must become the selected auto source",
    );
    assert.strictEqual(
      harness.manager.addonInfos,
      fallbackInfos,
      "the winning index must be cached",
    );
  });

  it("keeps the cached index when every refresh request fails", async function () {
    const harness = createManagerHarness({
      id: "source-auto",
      api: sourceA.api,
    });
    harness.enqueueResponse(Promise.resolve(cachedInfos));
    assert.strictEqual(
      await harness.manager.fetchAddonInfos(true),
      cachedInfos,
    );

    harness.enqueueResponse(Promise.resolve([]));
    harness.enqueueResponse(Promise.resolve([]));
    harness.enqueueResponse(Promise.resolve([]));
    const resultPromise = harness.manager.fetchAddonInfos(true);
    await harness.waitForCallCount(3);
    await harness.timer.waitForScheduleCount(1);
    harness.timer.runNext();

    assert.strictEqual(
      await resultPromise,
      cachedInfos,
      "all-source failure must return the cached index",
    );
    assert.isUndefined(
      harness.getSelectedSource(),
      "an all-source failure must not select a source",
    );
    assert.strictEqual(
      harness.manager.addonInfos,
      cachedInfos,
      "an all-source failure must preserve the cache",
    );
  });
});
