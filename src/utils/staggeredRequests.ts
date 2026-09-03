export type RegisterCanceller = (canceller: VoidFunction) => void;

export type StaggeredRequest<T> = (
  registerCanceller: RegisterCanceller,
) => Promise<T | undefined>;

export interface StaggerScheduler {
  schedule(callback: VoidFunction, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

const defaultScheduler: StaggerScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Start requests in order, keeping earlier requests alive while starting the
 * next one after each stagger delay. The first successful result wins and all
 * other active requests are cancelled on a best-effort basis.
 */
export async function firstSuccessfulStaggered<T>(
  requests: StaggeredRequest<T>[],
  staggerDelayMs: number,
  scheduler: StaggerScheduler = defaultScheduler,
): Promise<T | undefined> {
  if (requests.length === 0) {
    return undefined;
  }

  const cancellers = new Map<number, VoidFunction>();
  const activeRequests = new Set<number>();
  let startedCount = 0;
  let completedCount = 0;
  let winnerIndex: number | undefined;
  let resolved = false;
  let resolveOutcome!: (value: T | undefined) => void;
  const outcome = new Promise<T | undefined>((resolve) => {
    resolveOutcome = resolve;
  });

  const cancelRequest = (index: number, canceller: VoidFunction) => {
    if (!activeRequests.has(index) || index === winnerIndex) {
      return;
    }
    try {
      canceller();
    } catch {
      // A request may finish between winner selection and cancellation.
    }
  };

  const finish = (value: T | undefined, index?: number) => {
    if (resolved) {
      return;
    }
    resolved = true;
    winnerIndex = index;
    if (index !== undefined) {
      for (const [requestIndex, canceller] of cancellers) {
        cancelRequest(requestIndex, canceller);
      }
    }
    resolveOutcome(value);
  };

  const startRequest = (index: number) => {
    if (resolved) {
      return;
    }
    startedCount += 1;
    activeRequests.add(index);
    const registerCanceller: RegisterCanceller = (canceller) => {
      cancellers.set(index, canceller);
      if (resolved) {
        cancelRequest(index, canceller);
      }
    };

    let request: Promise<T | undefined>;
    try {
      request = requests[index](registerCanceller);
    } catch (error) {
      request = Promise.reject(error);
    }

    void request
      .then((value) => {
        if (!resolved && value !== undefined) {
          finish(value, index);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        activeRequests.delete(index);
        cancellers.delete(index);
        completedCount += 1;
        if (
          !resolved &&
          startedCount === requests.length &&
          completedCount === requests.length
        ) {
          finish(undefined);
        }
      });
  };

  const waitForNextStart = () =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const handle = scheduler.schedule(() => {
        settled = true;
        resolve(true);
      }, staggerDelayMs);
      void outcome.then(() => {
        if (settled) {
          return;
        }
        settled = true;
        scheduler.cancel(handle);
        resolve(false);
      });
    });

  startRequest(0);
  for (let index = 1; index < requests.length; index += 1) {
    if (!(await waitForNextStart())) {
      return await outcome;
    }
    startRequest(index);
  }

  return await outcome;
}
