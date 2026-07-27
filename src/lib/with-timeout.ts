/**
 * Reject after `ms` so a hung P2P call can't freeze a poll/tail loop forever, and ABORT the
 * underlying dial when the timeout fires — `run` receives an AbortSignal it must forward to the
 * transport, so a timed-out request is cancelled rather than left running in the background.
 *
 * ocean.js P2P round-trips have no built-in timeout: if the node/relay is unreachable the promise
 * can hang indefinitely. Wrap every recurring status/log dial in this.
 */
export function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out`));
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}
