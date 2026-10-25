/**
 * Reject with a TimeoutError when a promise does not settle in time.
 * The source promise always receives a rejection handler, so a late failure
 * cannot become an unhandled rejection.
 */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: VoidFunction,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        onTimeout?.();
      } catch {
        // Timeout cleanup is best-effort; the timeout error remains primary.
      }
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
