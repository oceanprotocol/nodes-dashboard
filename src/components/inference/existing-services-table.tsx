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
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './existing-services-table.module.css';

type ServiceSession = {
  serviceId: string;
  peerId?: string;
  status?: number;
  statusText?: string;
  environment?: string;
  dockerCmd?: string[];
  model?: string;
  duration?: number;
  expiresAt?: number;
  dateCreated: number;
  payment?: { token?: string };
};

function modelIdFromSession(session: ServiceSession): string | null {
  if (session.model) {
    return session.model;
  }
  const cmd = session.dockerCmd ?? [];
  const idx = cmd.indexOf('--model');
  return idx >= 0 && idx + 1 < cmd.length ? cmd[idx + 1] : null;
}

const ExistingServicesTable: React.FC = () => {
  const router = useRouter();
  const { account } = useOceanAccount();

  const [sessions, setSessions] = useState<ServiceSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const requestRef = useRef<AbortController>();

  useEffect(() => {
    requestRef.current?.abort();
    setSessions([]);
    setTotal(0);
    setOpen(false);
    setLoading(false);
  }, [account.address]);

  const load = useCallback(async () => {
    if (!account.address) {
      return;
    }
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;

    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${getApiRoute('owners')}/${account.address.toLowerCase()}/services`, {
        params: { page: 1, size: 100, sort: JSON.stringify({ dateCreated: 'desc' }) },
        signal: request.signal,
      });
      setSessions(data.services ?? []);
      setTotal(data.pagination?.totalItems ?? 0);
    } catch (err) {
      if (axios.isCancel(err)) {
        return;
      }
      console.error('Failed to load existing services:', err);
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          (err instanceof Error ? err.message : 'Failed to load your services.')
      );
    } finally {
      if (!request.signal.aborted) {
        setLoading(false);
      }
    }
  }, [account.address]);

  const handleLoad = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    load();
  }, [open, load]);

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
          <>
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
                    const createdMs =
                      session.dateCreated > 1e12 ? session.dateCreated : session.dateCreated * 1000;
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
                        <td className="textSecondary">{formatDateTime(Math.floor(createdMs / 1000))}</td>
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
            {total > sessions.length && (
              <span className="textSecondary">
                Showing newest {sessions.length} of {total}
              </span>
            )}
          </>
        )}
      </Collapse>
    </Card>
  );
};

export default ExistingServicesTable;
