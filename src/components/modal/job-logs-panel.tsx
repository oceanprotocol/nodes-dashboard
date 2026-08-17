import type { NodeUri } from '@/contexts/P2PContext';
import { LogViewStatus, useJobLogs } from '@/hooks/use-job-logs';
import { ComputeJob } from '@/types/jobs';
import StopIcon from '@mui/icons-material/Stop';
import { useEffect, useRef, useState } from 'react';

interface JobLogsPanelProps {
  job: ComputeJob;
  open: boolean;
  nodeUri: NodeUri;
}

const STATUS_LABEL: Record<LogViewStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  'loading-result': 'Loading logs…',
  ended: 'Ended',
  error: 'Error',
};

const STATUS_COLOR: Record<LogViewStatus, string> = {
  idle: 'var(--text-secondary)',
  connecting: 'var(--text-secondary)',
  live: 'var(--success)',
  reconnecting: 'var(--warning)',
  'loading-result': 'var(--text-secondary)',
  ended: 'var(--text-secondary)',
  error: 'var(--error)',
};

export const JobLogsPanel = ({ job, open, nodeUri }: JobLogsPanelProps) => {
  const { lines, status, error, stop } = useJobLogs(job, open, nodeUri);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  // Autoscroll to bottom on new lines unless the user scrolled up.
  useEffect(() => {
    if (!stickToBottom) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, stickToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStickToBottom(atBottom);
  };

  const isLive = status === 'live' || status === 'reconnecting' || status === 'connecting';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <strong>Logs</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: STATUS_COLOR[status],
                boxShadow: status === 'live' ? `0 0 6px ${STATUS_COLOR.live}` : 'none',
              }}
            />
            {STATUS_LABEL[status]}
          </span>
          {isLive && (
            <button
              onClick={stop}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '2px 8px',
              }}
              type="button"
            >
              <StopIcon style={{ fontSize: '0.9rem' }} /> Stop
            </button>
          )}
        </div>
      </div>

      <div
        onScroll={onScroll}
        ref={scrollRef}
        style={{
          background: 'var(--terminal-bg)',
          border: '1px solid var(--terminal-border)',
          borderRadius: '8px',
          color: 'var(--terminal-text)',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontSize: '0.78rem',
          height: '320px',
          lineHeight: 1.5,
          overflow: 'auto',
          padding: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {lines.length === 0 && status !== 'error' ? (
          <span style={{ color: 'var(--terminal-text-muted)' }}>
            {status === 'connecting' ? 'Connecting to log stream…' : 'Waiting for logs…'}
          </span>
        ) : (
          lines.map((line, i) => <div key={i}>{line || ' '}</div>)
        )}
      </div>

      {error && <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '6px' }}>{error}</div>}
      {!stickToBottom && isLive && (
        <button
          onClick={() => setStickToBottom(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent1)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            marginTop: '6px',
            padding: 0,
          }}
          type="button"
        >
          ↓ Jump to latest
        </button>
      )}
    </div>
  );
};
