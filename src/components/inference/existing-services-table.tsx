import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { getApiRoute } from '@/config';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { encodeModelIds, getModelShortName } from '@/services/huggingface-service';
import { getServiceStatusView } from '@/services/service-status';
import { formatDateTime, formatDuration } from '@/utils/formatters';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { CircularProgress, Collapse } from '@mui/material';
import axios from 'axios';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import styles from './existing-services-table.module.css';

// A service session as indexed by incentive-backend (see recordServiceStarted /
// GET /owners/:owner/services in incentive-backend). Snapshotted at service-start time —
// not a live status feed (see manage-service-page.tsx for that).
type ServiceSession = {
  serviceId: string;
  peerId?: string;
  owner?: string;
  status?: number;
  statusText?: string;
  environment?: string;
  dockerCmd?: string[];
  model?: string;
  duration?: number;
  expiresAt?: number;
  dateCreated: string;
  payment?: {
    chainId?: number;
    token?: string;
    cost?: string | number;
    lockTx?: string;
    claimTx?: string;
  };
};

/** Prefer the indexed `model` field; fall back to recovering it from the launch command. */
function modelIdFromSession(session: ServiceSession): string | null {
  if (session.model) {
    return session.model;
  }
  const cmd = session.dockerCmd ?? [];
  const idx = cmd.indexOf('--model');
  if (idx >= 0 && idx + 1 < cmd.length) {
    return cmd[idx + 1];
  }
  return null;
}

const ExistingServicesTable: React.FC = () => {
  const router = useRouter();
  const { account } = useOceanAccount();

  const [sessions, setSessions] = useState<ServiceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Services aren't fetched on mount — the collapsible only opens (and loads) once "Load" is pressed.
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!account.address) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${getApiRoute('owners')}/${account.address}/services`, {
        params: { page: 1, size: 100, sort: JSON.stringify({ dateCreated: 'desc' }) },
      });
      setSessions(response.data.services ?? []);
    } catch (err) {
      console.error('Failed to load existing services:', err);
      setError(err instanceof Error ? err.message : 'Failed to load your services.');
    } finally {
      setLoading(false);
    }
  }, [account.address]);

  // Open the collapsible and (re)fetch. Toggles closed again if already open.
  const handleLoad = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    load();
  }, [open, load]);

  // Switching wallets mid-session must drop the previous address's rows — otherwise a stale
  // session (and its serviceId/peerId) stays visible and actionable under the new address.
  useEffect(() => {
    setSessions([]);
    setOpen(false);
  }, [account.address]);

  // Route to the manage page. It hydrates its model/env display from the query params (peerId/env/
  // models) — the session alone can't rebuild the rich model card, so seed what we recovered from it.
  // Carry the payment token too: the manage page needs it in context for a Prolong re-entry, and
  // hydrating it from the URL avoids waiting on the async job-token seed effect (see manage page).
  // peerId/environment are required to resolve the node on the manage page — an older/unverified
  // session doc missing either would otherwise land on a page stuck at "Loading…" with no error.
  const openService = (session: ServiceSession) => {
    if (!session.peerId || !session.environment) {
      setError('This service is missing node info and cannot be managed from here.');
      return;
    }
    const modelId = modelIdFromSession(session);
    const token = session.payment?.token;
    router.push({
      pathname: `/inference/services/${encodeURIComponent(session.serviceId)}`,
      query: {
        peerId: session.peerId,
        env: session.environment,
        ...(modelId ? { models: encodeModelIds([modelId]) } : {}),
        ...(token ? { token } : {}),
        ...(session.duration != null ? { duration: String(session.duration) } : {}),
      },
    });
  };

  if (!account.address) {
    return null;
  }

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.head}>
        <div>
          <h3>Your services</h3>
          <span className="textSecondary">Running & recent inference services</span>
        </div>
        <Button color="accent2" onClick={handleLoad} size="md" variant="filled">
          {open ? 'Hide services' : 'Load services'}
        </Button>
      </div>

      <Collapse in={open} mountOnEnter unmountOnExit>
        {error && <div className="textErrorDarker">{error}</div>}

        {loading && sessions.length === 0 ? (
          <div className={styles.centered}>
            <CircularProgress size={18} />
          </div>
        ) : sessions.length === 0 ? (
          <div className={cx('textSecondary', styles.centered)}>No services yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th>End time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const modelId = modelIdFromSession(session);
                  const name = modelId ? getModelShortName(modelId) : session.serviceId.slice(0, 10);
                  const status = getServiceStatusView(session.status, session.statusText);
                  return (
                    <tr key={session.serviceId}>
                      <td>
                        <span className={styles.model}>{name}</span>
                      </td>
                      <td>
                        <span className={cx('chip', styles.statusChip, styles[`status_${status.kind}`])}>
                          {status.kind === 'pending' ? (
                            <CircularProgress size={10} />
                          ) : (
                            <span className={styles.statusDot} />
                          )}
                          {status.label}
                        </span>
                      </td>
                      <td className="textSecondary">
                        {formatDateTime(Math.floor(new Date(session.dateCreated).getTime() / 1000))}
                      </td>
                      <td className="textSecondary">
                        {session.duration != null ? formatDuration(session.duration) : '—'}
                      </td>
                      <td className="textSecondary">
                        {session.expiresAt != null ? formatDateTime(session.expiresAt / 1000) : '—'}
                      </td>
                      <td className={styles.actionCell}>
                        <Button
                          color="accent1"
                          contentAfter={<ArrowForwardIcon />}
                          onClick={() => openService(session)}
                          size="sm"
                          variant="outlined"
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Collapse>
    </Card>
  );
};

export default ExistingServicesTable;
