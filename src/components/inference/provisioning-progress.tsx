import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri } from '@/contexts/P2PContext';
import { useServiceLogs } from '@/hooks/use-service-logs';
import { parseProvisioning } from '@/services/provisioning-log';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { CircularProgress } from '@mui/material';
import cx from 'classnames';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './provisioning-progress.module.css';

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
  // Same shared per-node token cache the status poll and the log panel use — one token per node, so
  // this panel doesn't mint a second one and clash on the node's per-address nonce.
  const { getNodeToken, clearNodeToken } = useNodeTokensContext();

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

  // Provisioning is a one-shot phase, but useServiceLogs tails for as long as it's open: every
  // reconnect re-downloads the container's whole log history, and it reconnects every ~1.5s for the
  // rest of the service's life. So close the stream for good once the completion marker lands, rather
  // than only hiding the panel below and leaving the tail running behind it.
  const [completed, setCompleted] = useState(false);

  const { lines } = useServiceLogs({
    serviceId,
    nodeUri,
    consumerAddress,
    getToken,
    clearToken,
    open: active && !completed,
  });

  const state = useMemo(() => parseProvisioning(lines), [lines]);

  // A new provisioning run: the container went away and came back (an Edit relaunch re-downloads every
  // bundled model), or this panel is watching a different service now. Re-open so its markers are read.
  // Declared before the marker effect so that when both fire in one commit, "complete" is what sticks.
  useEffect(() => {
    setCompleted(false);
  }, [serviceId, active]);

  // Guards inference_provisioning_completed against firing twice for the same run: reset whenever
  // serviceId changes (a new run) so it can fire again, keyed off the ref rather than `completed`
  // state so the reset above (same commit as a stale completion) can't race it.
  const completedReportedRef = useRef<string | null>(null);
  useEffect(() => {
    completedReportedRef.current = null;
  }, [serviceId]);

  useEffect(() => {
    if (state.complete) {
      setCompleted(true);
    }
  }, [state.complete]);
  const expected = template.includes?.length ?? 0;
  const finished = state.done.length + state.failed.length;
  // Trust whichever count is larger: a template whose `includes` is out of date with its script
  // shouldn't produce "5/3 models".
  const total = Math.max(expected, finished);

  useEffect(() => {
    if (state.complete && completedReportedRef.current !== serviceId) {
      completedReportedRef.current = serviceId;
      posthog.capture('inference_provisioning_completed', {
        // Only bundles provision, so this is always 'template' — resolved rather than hardcoded so
        // it stays correct if a bare service ever gains a provisioning step.
        branch: resolveInferenceBranch(InferenceFlowType.Template, template),
        serviceId,
        templateId: template.id,
        doneCount: state.done.length,
        failedCount: state.failed.length,
        total,
      });
    }
  }, [state.complete, serviceId, template, state.done.length, state.failed.length, total]);

  // `completed` keeps the panel hidden once the stream is closed, without depending on the last
  // buffered lines still being around to re-derive state.complete from.
  if (!active || completed || state.complete || !state.seen || total === 0) {
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
        The app is already reachable — refresh its tab once the models land and they&apos;ll appear in its pickers.
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
