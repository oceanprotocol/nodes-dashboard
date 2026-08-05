import { NodeUri } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { useServiceLogs } from '@/hooks/use-service-logs';
import { AppTemplate } from '@/types/templates';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { CircularProgress } from '@mui/material';
import cx from 'classnames';
import { useCallback, useMemo } from 'react';
import styles from './provisioning-progress.module.css';

/**
 * Markers a bundle's provisioning script prints (documented in ocean-node's
 * docs/serviceTemplates/README.md). This is a convention, not a protocol — a bundle whose script
 * doesn't print them simply shows no progress, which is why the UI never blocks on it.
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
    // Docker multiplexes stdout/stderr with an 8-byte header per frame; the hook already splits on
    // newlines, so just trim whatever control bytes survive at the edges.
    const line = raw.replace(/^[\x00-\x08\x0b-\x1f]+/, '').trim();
    if (!line.startsWith('[models]')) {
      continue;
    }
    seen = true;
    let match = RE_READY.exec(line) ?? RE_PRESENT.exec(line);
    if (match) {
      done.add(match[1]);
      if (current === match[1]) {
        current = null;
      }
      continue;
    }
    match = RE_FAILED.exec(line);
    if (match) {
      failed.add(match[1]);
      if (current === match[1]) {
        current = null;
      }
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

type ProvisioningProgressProps = {
  serviceId: string;
  nodeUri: NodeUri | null;
  nodePeerId?: string;
  consumerAddress?: string;
  template: AppTemplate;
  /** Stream only while the container is actually up — there are no logs to read otherwise. */
  active: boolean;
};

/**
 * Live "the models are still landing" panel for a running bundle.
 *
 * A bundle's container reports Running seconds after start, while its weights download in the
 * background for minutes afterwards — so the URL works but the app's model dropdowns are empty, which
 * reads as broken. The node has no readiness signal for this today, so we derive one from the
 * `[models]` markers the provisioning script prints into the container log, with the bundle's
 * `includes[]` giving the denominator.
 *
 * Deliberately advisory: it never gates the Open-UI button, and it disappears entirely once the
 * completion marker lands (or if the script emits no markers at all).
 */
const ProvisioningProgress: React.FC<ProvisioningProgressProps> = ({
  serviceId,
  nodeUri,
  nodePeerId,
  consumerAddress,
  template,
  active,
}) => {
  const { getNodeToken, clearNodeToken } = useNodeAuth();

  const getToken = useCallback(() => {
    if (!nodePeerId || !nodeUri) {
      return Promise.reject(new Error('Node not resolved for log stream auth.'));
    }
    return getNodeToken(nodePeerId, nodeUri);
  }, [getNodeToken, nodePeerId, nodeUri]);
  const clearToken = useCallback(() => {
    if (nodePeerId) {
      clearNodeToken(nodePeerId);
    }
  }, [clearNodeToken, nodePeerId]);

  const { lines } = useServiceLogs({
    serviceId,
    nodeUri,
    consumerAddress,
    getToken,
    clearToken,
    open: active,
  });

  const state = useMemo(() => parseProvisioning(lines), [lines]);
  const expected = template.includes?.length ?? 0;
  const finished = state.done.length + state.failed.length;
  // Trust whichever count is larger: a template whose `includes` is out of date with its script
  // shouldn't produce "5/3 models".
  const total = Math.max(expected, finished);

  if (!active || state.complete || !state.seen || total === 0) {
    return null;
  }

  const percent = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <CircularProgress className={styles.spinner} size={14} />
        <span className={styles.title}>
          Preparing models — {finished} of {total}
        </span>
        <span className={styles.percent}>{percent}%</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.detail}>
        {state.current ? `Downloading ${state.current}…` : 'Waiting for the next download to start…'}
      </div>
      <div className={styles.note}>
        The app is already reachable — refresh its tab once the models land and they&apos;ll appear in its
        pickers.
      </div>
      {(state.done.length > 0 || state.failed.length > 0) && (
        <ul className={styles.items}>
          {state.done.map((name) => (
            <li className={styles.item} key={name}>
              <CheckCircleOutlineIcon className={cx(styles.itemIcon, styles.itemIconDone)} />
              <span className={styles.itemName}>{name}</span>
            </li>
          ))}
          {state.failed.map((name) => (
            <li className={styles.item} key={name}>
              <ErrorOutlineIcon className={cx(styles.itemIcon, styles.itemIconFailed)} />
              <span className={styles.itemName}>{name}</span>
              <span className={styles.itemHint}>failed — install it from the app instead</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProvisioningProgress;
