'use client';

import Button from '@/components/button/button';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration } from '@/utils/formatters';
import { useEffect, useRef, useState } from 'react';

const DEFAULT_PROLONG_SECONDS = 3600;

type ProlongSessionModalProps = {
  isOpen: boolean;
  /**
   * The environment's `minJobDuration`, enforced here as the smallest extension.
   *
   * The node does NOT require it: serviceExtend only rejects `additionalDuration <= 0` and a new
   * total past `maxJobDuration`, and it grants exactly the seconds asked for. But it floors the
   * extension's PRICE at this window — calculateResourcesCost re-applies the session minimum to the
   * increment, so +1min on a 10min-minimum env is billed as 10min while granting 60s. Until that is
   * fixed node-side, block it rather than sell a tenth of what the node charges for.
   */
  minSeconds?: number;
  /**
   * Headroom for THIS extension — the env's `maxJobDuration` minus the runtime already ahead of the
   * service, since the node caps `remaining + additionalDuration` (not elapsed + additional).
   */
  maxSeconds?: number;
  onClose: () => void;
  /** Fired with the extra runtime (seconds) to add — the caller navigates to payment. */
  onConfirm: (seconds: number) => void;
};

const ProlongSessionModal: React.FC<ProlongSessionModalProps> = ({
  isOpen,
  minSeconds = 0,
  maxSeconds,
  onClose,
  onConfirm,
}) => {
  // Default that actually sits inside the window: at least the billing minimum, no more than the
  // headroom left. Both bounds may be absent, and they can contradict each other (see noHeadroom) —
  // clamping the max last keeps the seed at the headroom in that case, which reads correctly next to
  // the error rather than showing a value larger than what is left.
  const seedSeconds = (min: number, max?: number) => {
    const seed = Math.max(DEFAULT_PROLONG_SECONDS, min);
    return max !== undefined ? Math.min(seed, Math.max(0, max)) : seed;
  };

  const [seconds, setSeconds] = useState(() => seedSeconds(minSeconds, maxSeconds));
  /**
   * Whether the user has edited the field since this open, which freezes the re-seed below.
   *
   * `maxSeconds` is derived from the service's REMAINING runtime, so it changes on every one-second
   * tick of the countdown — meaning the re-seed effect fires continuously, not just on open. Without
   * this guard it overwrote whatever had just been typed, the field snapped back to the seed within a
   * second, and Prolong could only ever buy DEFAULT_PROLONG_SECONDS (billed as a full hour).
   */
  const edited = useRef(false);

  // Re-seed on every open: the modal outlives a close, and the bounds only land once the env and the
  // node's job record have loaded — a default seeded before that could sit outside the window. Never
  // re-seed past an edit, though: bounds arriving late can leave an edited value outside the window,
  // but that is caught by the validation below (which blocks Continue and says why), whereas silently
  // rewriting the user's number is both invisible and unrecoverable.
  useEffect(() => {
    if (!isOpen) {
      edited.current = false;
      return;
    }
    if (edited.current) {
      return;
    }
    setSeconds(seedSeconds(minSeconds, maxSeconds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, minSeconds, maxSeconds]);

  const onDurationChange = (next: number) => {
    edited.current = true;
    setSeconds(next);
  };

  // Nothing can be bought when the window has no room for the smallest purchase. Two ways in:
  //   - no headroom at all (already at the env's max) — independent of any billing minimum, so this
  //     must NOT be gated on minSeconds > 0, or an env without a minJobDuration would offer an input
  //     whose every value is rejected;
  //   - headroom smaller than the billing minimum: the minimum is a floor on what can be BOUGHT, the
  //     headroom a ceiling on what can be ADDED, and they cross on a service near the env's max.
  // Either way, show why rather than a range with no valid value in it.
  const exhausted = maxSeconds !== undefined && maxSeconds <= 0;
  const belowMinimumHeadroom = maxSeconds !== undefined && minSeconds > 0 && maxSeconds < minSeconds;
  const noHeadroom = exhausted || belowMinimumHeadroom;

  let error: string | null = null;
  if (noHeadroom) {
    error = exhausted
      ? "This service is already at the environment's maximum runtime, so it can't be extended further."
      : `Only ${formatDuration(maxSeconds)} of runtime is left before this environment's maximum, but it charges a ${formatDuration(minSeconds)} minimum per top-up — this service can't be extended further.`;
  } else if (seconds <= 0) {
    error = 'Pick a duration greater than zero.';
  } else if (minSeconds > 0 && seconds < minSeconds) {
    // Not a node rejection — a node overcharge (see minSeconds). A shorter extension costs exactly
    // the same as the minimum, so there is never a reason to buy one.
    error = `This environment charges a ${formatDuration(minSeconds)} minimum per top-up — a shorter extension costs the same, so add at least ${formatDuration(minSeconds)}.`;
  } else if (maxSeconds !== undefined && seconds > maxSeconds) {
    error = `At most ${formatDuration(maxSeconds)} can be added before this environment's maximum runtime — pick a shorter extension.`;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prolong session" width="sm" fullWidth>
      <div className="flexColumn gapMd">
        <div className="textSecondary">Choose how much extra runtime to add</div>
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="hours"
          disabled={noHeadroom}
          errorText={error ?? undefined}
          hint={
            noHeadroom
              ? undefined
              : minSeconds > 0 && maxSeconds !== undefined
                ? `${formatDuration(minSeconds)} – ${formatDuration(maxSeconds)}`
                : minSeconds > 0
                  ? `Minimum ${formatDuration(minSeconds)}`
                  : maxSeconds !== undefined
                    ? `Up to ${formatDuration(maxSeconds)}`
                    : undefined
          }
          label="Additional time"
          max={maxSeconds}
          min={minSeconds || 1}
          onChange={onDurationChange}
          size="md"
          value={seconds}
        />
        <div className="actionsGroupMdEnd">
          <Button color="accent1" variant="outlined" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            color="accent1"
            variant="filled"
            size="md"
            disabled={!!error}
            onClick={() => onConfirm(seconds)}
            type="button"
          >
            Continue to payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProlongSessionModal;
