import Button from '@/components/button/button';
import { NodeUri } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { ServiceLogViewStatus, useServiceLogs } from '@/hooks/use-service-logs';
import StopIcon from '@mui/icons-material/Stop';
import cx from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './service-logs-panel.module.css';

const STATUS_LABEL: Record<ServiceLogViewStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  ended: 'Ended',
  error: 'Error',
};

interface ServiceLogsPanelProps {
  serviceId: string;
  nodeUri: NodeUri | null;
  nodePeerId?: string;
  consumerAddress?: string;
  /** Start streaming only once true (e.g. after the user reveals the logs). */
  open: boolean;
}

const ServiceLogsPanel: React.FC<ServiceLogsPanelProps> = ({
  serviceId,
  nodeUri,
  nodePeerId,
  consumerAddress,
  open,
}) => {
  const { getNodeToken, clearNodeToken } = useNodeAuth();

  // Share the node's cached auth token with the status poll & actions (one token per node, so the
  // log stream doesn't mint a second one and clash on the node's per-address nonce).
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

  const { lines, status, error, stop } = useServiceLogs({
    serviceId,
    nodeUri,
    consumerAddress,
    getToken,
    clearToken,
    open,
  });

  const scrollRef = useRef<HTMLPreElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  // Autoscroll to bottom on new lines unless the user scrolled up.
  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, stickToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStickToBottom(atBottom);
  };

  const isLive = status === 'live' || status === 'reconnecting' || status === 'connecting';

  return (
    <>
      <div className={styles.head}>
        <span className={cx(styles.statusPill, styles[status])}>
          <span className={styles.dot} />
          {STATUS_LABEL[status]}
        </span>
        {isLive && (
          <Button color="accent1" contentBefore={<StopIcon />} onClick={stop} size="sm" variant="outlined">
            Stop
          </Button>
        )}
      </div>

      <pre className={styles.terminal} onScroll={onScroll} ref={scrollRef}>
        {lines.length === 0 && status !== 'error' ? (
          <span className={styles.placeholder}>
            {status === 'connecting' ? 'Connecting to log stream…' : 'Waiting for logs…'}
          </span>
        ) : (
          lines.map((line, i) => (
            <div className={styles.line} key={i}>
              {line || ' '}
            </div>
          ))
        )}
      </pre>

      {error && <div className="textAccent1">{error}</div>}

      {!stickToBottom && isLive && (
        <button className={styles.jumpButton} onClick={() => setStickToBottom(true)} type="button">
          ↓ Jump to latest
        </button>
      )}
    </>
  );
};

export default ServiceLogsPanel;
