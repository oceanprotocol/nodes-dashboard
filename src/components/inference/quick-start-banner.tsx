import Button from '@/components/button/button';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import { QuickStart } from '@/components/hooks/use-quick-start';
import DurationInput from '@/components/input/duration-input';
import { QuickStartEntry } from '@/services/quick-start';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration, formatDurationCompact, formatGb } from '@/utils/formatters';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DnsIcon from '@mui/icons-material/Dns';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import VerifiedIcon from '@mui/icons-material/Verified';
import { CircularProgress, Tooltip } from '@mui/material';
import cx from 'classnames';
import { CSSProperties, ReactNode } from 'react';
import styles from './quick-start-banner.module.css';

/**
 * The quick start's Start button, price included. Rendered twice per modal: in the banner and next to
 * Advanced setup at the bottom, so it's there whichever end of the modal the user is at. The bottom
 * copy is far from the Session length input, so it passes `durationSeconds` to say what the price buys.
 */
export function QuickStartButton<T extends QuickStartEntry>({
  className,
  durationSeconds,
  quickStart,
}: {
  className?: string;
  durationSeconds?: number;
  quickStart: QuickStart<T>;
}) {
  const { status, priceLabel, blockedReason, starting, start, needsLogin } = quickStart;
  const blocked = status !== 'ready';
  const busy = status === 'loading' || starting;
  const tooltip = blockedReason ?? (needsLogin ? 'Log in to start' : '');
  return (
    <Tooltip title={busy ? '' : tooltip}>
      {/* A disabled button swallows pointer/focus events: the focusable, labelled wrapper keeps the
          reason reachable by hover, keyboard and screen readers (same as the env cards). */}
      <span
        aria-label={blocked && !busy ? (blockedReason ?? undefined) : undefined}
        className={cx(styles.startWrap, className)}
        tabIndex={blocked && !busy ? 0 : undefined}
      >
        <Button
          className={styles.start}
          color="accent1"
          contentBefore={busy ? undefined : <PlayArrowIcon />}
          disabled={blocked}
          loading={busy}
          onClick={start}
          // md matches the height of the sm Session length input it sits beside.
          size="md"
          type="button"
          variant="filled"
        >
          Start
          {durationSeconds !== undefined && ` for ${formatDurationCompact(durationSeconds)}`}
          {priceLabel && <span className={styles.startPrice}>{priceLabel}</span>}
        </Button>
      </span>
    </Tooltip>
  );
}

type QuickStartBannerProps<T extends QuickStartEntry> = {
  quickStart: QuickStart<T>;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onAdvanced: () => void;
  /** Sets `--accent` (a template's category colour). Without it the banner takes the brand accent. */
  style?: CSSProperties;
};

/**
 * The top of a details modal: what a launch gets right now, for how long, and a Start with the price
 * on it. The environment is picked for the user (see useQuickStart); choosing one by hand is Advanced
 * setup, which the small print points to.
 */
export default function QuickStartBanner<T extends QuickStartEntry>({
  quickStart,
  durationSeconds,
  onDurationChange,
  onAdvanced,
  style,
}: QuickStartBannerProps<T>) {
  const { status, option, recommendedGpus, belowRecommendedResources, loadError, retry, suggestedDurationSeconds } =
    quickStart;

  const renderProblem = ({
    Icon,
    title,
    children,
  }: {
    Icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: ReactNode;
  }) => (
    <div className={styles.problem}>
      <Icon className={styles.problemIcon} />
      <div className={styles.problemBody}>
        <div className={styles.problemTitle}>{title}</div>
        <div className={styles.problemText}>{children}</div>
      </div>
    </div>
  );

  const renderPick = () => {
    if (!option) {
      return null;
    }
    const { allocation, candidate, gpuCount, gpuLabel } = option;
    const node = candidate.entry.env.nodeInfo;
    // Same glyphs as the environment cards, so a spec reads the same wherever it shows up.
    const specs = [
      allocation.cpu > 0 && { Icon: MemoryIcon, value: `${allocation.cpu}`, unit: 'CPU' },
      allocation.ram > 0 && { Icon: SdStorageIcon, value: formatGb(allocation.ram), unit: 'RAM' },
      allocation.disk > 0 && { Icon: DnsIcon, value: formatGb(allocation.disk), unit: 'disk' },
    ].filter((spec): spec is Exclude<typeof spec, false> => !!spec);
    return (
      // Keyed on the pick, so a changed pick (after Start found the first one booked) plays the
      // entrance again and reads as new rather than as the same line with other numbers.
      <div className={styles.pick} key={`${candidate.key}:${gpuCount}`}>
        {/* The GPUs lead: they decide the price and whether the model fits; the rest follows from them. */}
        <div className={styles.headline}>
          {gpuCount > 0 ? (
            <>
              <span className={styles.gpuCount}>{gpuCount}×</span>
              <HardwareLabel className={styles.gpuName} iconHeight={17} type="gpu" value={gpuLabel ?? 'GPU'} />
            </>
          ) : (
            'CPU only'
          )}
        </div>
        {specs.length > 0 && (
          <ul className={styles.specs}>
            {specs.map(({ Icon, value, unit }) => (
              <li className={styles.spec} key={unit}>
                <Icon aria-hidden className={styles.specIcon} />
                <span className={styles.specValue}>{value}</span>
                <span className={styles.specUnit}>{unit}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.node}>
          <span>node</span>
          {/* Long node names ellipsize, so the full one is on hover. */}
          <Tooltip title={node.friendlyName || node.id}>
            <span className={styles.nodeName}>
              <Button
                className={styles.nodeLink}
                color="accent1"
                href={`/nodes/${node.id}`}
                size="link"
                target="_blank"
                variant="transparent"
              >
                {node.friendlyName || node.id}
              </Button>
            </span>
          </Tooltip>
          {node.verified && (
            <Tooltip title="Verified node">
              <VerifiedIcon aria-label="Verified node" className={styles.verified} />
            </Tooltip>
          )}
        </div>
        {recommendedGpus !== null && (
          <div className={styles.note}>
            The recommended {recommendedGpus}× GPU isn&apos;t free right now, so this starts on {gpuCount}×.
          </div>
        )}
        {belowRecommendedResources && (
          <div className={styles.note}>
            No environment has the recommended CPU, RAM and disk free right now, so this starts with less (still above
            the minimum).
          </div>
        )}
      </div>
    );
  };

  const renderReadout = () => {
    switch (status) {
      case 'loading':
        return (
          <div aria-busy="true" className={styles.pick}>
            <div className="shimmer" style={{ height: 22, width: 190, borderRadius: 8 }} />
            <div className="shimmer shimmerSoft" style={{ height: 13, width: 250 }} />
            <div className={styles.searching}>
              <CircularProgress color="inherit" size={12} />
              Finding a free environment…
            </div>
          </div>
        );
      case 'error':
        return renderProblem({
          Icon: ErrorOutlineIcon,
          title: "Couldn't load environments",
          children: (
            <>
              <span className={styles.problemReason}>{loadError}</span>
              <Button color="accent1" onClick={retry} size="link" type="button" variant="transparent">
                Retry
              </Button>
            </>
          ),
        });
      case 'none':
        return renderProblem({
          Icon: CloudOffIcon,
          title: 'No environment can run this right now',
          children: (
            <>
              Everything that fits is booked or below the requirements.{' '}
              <Button color="accent1" onClick={retry} size="link" type="button" variant="transparent">
                Check again
              </Button>
            </>
          ),
        });
      case 'duration':
        return renderProblem({
          Icon: ScheduleIcon,
          title: `No environment that fits takes ${formatDuration(durationSeconds)}`,
          children:
            suggestedDurationSeconds !== null
              ? `Try ${formatDuration(suggestedDurationSeconds)}: each environment sets its own session limits.`
              : 'Each environment sets its own session limits.',
        });
      case 'denied':
        return renderProblem({
          Icon: LockOutlinedIcon,
          title: "Your wallet can't use the environments that fit",
          children:
            'They only accept wallets on their access list. Try another wallet, or pick an environment yourself.',
        });
      default:
        return renderPick();
    }
  };

  return (
    <section aria-label="Quick start" className={styles.banner} style={style}>
      <div className={styles.body}>
        <div aria-live="polite" className={styles.readout}>
          <span className={styles.eyebrow}>Quick start</span>
          {renderReadout()}
        </div>
        <div className={styles.controls}>
          <DurationInput
            availableUnits={DURATION_UNIT_OPTIONS}
            className={styles.duration}
            defaultUnit="hours"
            label="Session length"
            min={1}
            onChange={onDurationChange}
            size="sm"
            value={durationSeconds}
          />
          <QuickStartButton quickStart={quickStart} />
        </div>
      </div>
      <p className={styles.smallPrint}>
        Want to pick the environment or resources yourself?{' '}
        <Button color="accent1" onClick={onAdvanced} size="link" type="button" variant="transparent">
          Use Advanced setup
        </Button>
      </p>
    </section>
  );
}
