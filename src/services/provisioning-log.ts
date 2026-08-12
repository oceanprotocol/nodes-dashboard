/**
 * Reads a bundle's provisioning progress out of its container log.
 *
 * A bundle downloads its models in a background subshell that prints `[models]` markers (documented in
 * ocean-node's docs/serviceTemplates/README.md). A convention, not a protocol: a bundle whose script
 * prints nothing simply reports no progress, which is why the UI treats this as advisory only.
 */
const RE_DOWNLOADING = /^\[models\] downloading (.+)$/;
const RE_READY = /^\[models\] ready: (.+)$/;
const RE_PRESENT = /^\[models\] already present: (.+)$/;
const RE_FAILED = /^\[models\] WARNING: could not download (.+?)(?: —.*)?$/;
const RE_COMPLETE = /^\[models\] bundle complete/;

export type ProvisioningState = {
  /** Names that finished downloading (or were already on disk). */
  done: string[];
  failed: string[];
  /** What is downloading right now, if anything has been announced and hasn't finished. */
  current: string | null;
  /** The script printed its completion marker. */
  complete: boolean;
  /** Any marker at all was seen — until then we can't tell "not started" from "doesn't emit markers". */
  seen: boolean;
};

export function parseProvisioning(lines: string[]): ProvisioningState {
  const done = new Set<string>();
  const failed = new Set<string>();
  let current: string | null = null;
  let complete = false;
  let seen = false;

  for (const raw of lines) {
    // Lines arrive already demuxed (Docker's 8-byte frame headers) and stripped of control bytes by
    // useServiceLogs, so a trim is all that's left.
    const line = raw.trim();
    if (!line.startsWith('[models]')) {
      continue;
    }
    seen = true;
    // An item that reaches a settled state (done or failed) is no longer the one in flight.
    const settle = (name: string, into: Set<string>) => {
      into.add(name);
      if (current === name) {
        current = null;
      }
    };

    let match = RE_READY.exec(line) ?? RE_PRESENT.exec(line);
    if (match) {
      settle(match[1], done);
      continue;
    }
    match = RE_FAILED.exec(line);
    if (match) {
      settle(match[1], failed);
      continue;
    }
    match = RE_DOWNLOADING.exec(line);
    if (match) {
      current = match[1];
      continue;
    }
    if (RE_COMPLETE.test(line)) {
      complete = true;
    }
  }
  return { done: [...done], failed: [...failed], current, complete, seen };
}
