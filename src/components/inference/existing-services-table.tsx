import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getApiRoute } from '@/config';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { encodeModelIds } from '@/services/huggingface-service';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import { ServiceJob } from '@oceanprotocol/lib';
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

// Rows are ServiceJob-shaped so the shared existingServicesColumns can render them, but the
// backend's session records are looser than the node's own ServiceJob (no clusterHash/image/etc,
// and peerId is ours). Keep the session alongside for routing.
type ServiceRow = Partial<ServiceJob> & { serviceId: string; session: ServiceSession };

function modelIdFromSession(session: ServiceSession): string | null {
  if (session.model) {
    return session.model;
  }
  const cmd = session.dockerCmd ?? [];
  const idx = cmd.indexOf('--model');
  return idx >= 0 && idx + 1 < cmd.length ? cmd[idx + 1] : null;
}

// The shared columns expect the node's own field shapes: an ISO `dateCreated` (they do
// `new Date(value)`) and a model recoverable from `dockerCmd` via `--model`. The backend instead
// sends a numeric epoch — in seconds or ms depending on the record — and may name the model
// directly, so normalize both here rather than teaching the columns a second shape.
function toRow(session: ServiceSession): ServiceRow {
  const createdMs = session.dateCreated > 1e12 ? session.dateCreated : session.dateCreated * 1000;
  const modelId = modelIdFromSession(session);
  return {
    ...session,
    dateCreated: new Date(createdMs).toISOString(),
    dockerCmd: modelId ? ['--model', modelId] : session.dockerCmd,
    session,
  };
}

const ExistingServicesTable: React.FC = () => {
  const router = useRouter();
  const { account } = useOceanAccount();

  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Services aren't fetched on mount — the collapsible only opens (and loads) once "Load" is pressed.
  const [open, setOpen] = useState(false);

  const requestRef = useRef<AbortController>();

  useEffect(() => {
    requestRef.current?.abort();
    setRows([]);
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
      setRows(((data.services ?? []) as ServiceSession[]).map(toRow));
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

  // Open the collapsible and (re)fetch. Toggles closed again if already open.
  const handleLoad = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    load();
  }, [open, load]);

  // Route to the manage page. It hydrates its model/env display from the query params (peerId/env/
  // models) — the record alone can't rebuild the rich model card, so seed what we recovered from it.
  // Carry the payment token too: the manage page needs it in context for a Prolong re-entry, and
  // hydrating it from the URL avoids waiting on the async job-token seed effect (see manage page).
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
        {error && (
          <p className="textErrorDarker flexRow alignItemsCenter gapXs">
            <span className="textBold">Failed to load services</span>
            <Tooltip title={error}>
              <InfoOutlinedIcon fontSize="small" />
            </Tooltip>
          </p>
        )}

        {loading && rows.length === 0 ? (
          <div className={styles.centered}>
            <CircularProgress size={18} />
          </div>
        ) : rows.length === 0 ? (
          <div className={cx('textSecondary', styles.centered)}>No services yet.</div>
        ) : (
          <>
            <Table<ServiceRow>
              autoHeight
              actionsColumn={({ row }) => (
                <Button
                  color="accent1"
                  contentAfter={<ArrowForwardIcon />}
                  onClick={() => openService(row.session)}
                  size="sm"
                  variant="outlined"
                >
                  Manage
                </Button>
              )}
              data={rows}
              getRowId={(row) => row.serviceId}
              paginationType="none"
              tableType={TableTypeEnum.EXISTING_SERVICES}
            />
            {total > rows.length && (
              <span className="textSecondary">
                Showing newest {rows.length} of {total}
              </span>
            )}
          </>
        )}
      </Collapse>
    </Card>
  );
};

export default ExistingServicesTable;
