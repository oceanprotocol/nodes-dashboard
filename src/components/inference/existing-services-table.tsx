import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { encodeModelIds } from '@/services/huggingface-service';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import { ServiceJob } from '@oceanprotocol/lib';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import styles from './existing-services-table.module.css';

// TODO: aggregate services across all reachable nodes, not just the default one.

// Services live per-node (getServiceStatus lists all of a node's services for the authenticated
// owner). We query a single default node by peer id and full multiaddr so the P2P layer can reach
// it without a separate peer lookup.
const DEFAULT_NODE_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';
const DEFAULT_NODE_URI = [
  '/ip4/35.202.16.215/tcp/9001/tls/sni/35-202-16-215.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
];

/** The node returns the launch command, not HF metadata — recover the model id from `--model`. */
function modelIdFromJob(job: ServiceJob): string | null {
  const cmd = job.dockerCmd ?? [];
  const idx = cmd.indexOf('--model');
  if (idx >= 0 && idx + 1 < cmd.length) {
    return cmd[idx + 1];
  }
  return null;
}

const ExistingServicesTable: React.FC = () => {
  const router = useRouter();
  const { account } = useOceanAccount();
  const { getServiceStatus, isReady } = useP2P();
  const { withNodeAuth, hasValidNodeToken } = useNodeAuth();

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Services aren't fetched on mount — the collapsible only opens (and loads) once "Load" is pressed.
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isReady || !account.address) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await withNodeAuth(DEFAULT_NODE_ID, DEFAULT_NODE_URI, (token) =>
        getServiceStatus(DEFAULT_NODE_URI, token)
      );
      // Newest first — dateCreated is an ISO timestamp.
      const sorted = [...result].sort((a, b) => (a.dateCreated < b.dateCreated ? 1 : -1));
      setJobs(sorted);
    } catch (err) {
      console.error('Failed to load existing services:', err);
      setError(err instanceof Error ? err.message : 'Failed to load your services.');
    } finally {
      setLoading(false);
    }
  }, [isReady, account.address, withNodeAuth, getServiceStatus]);

  // Open the collapsible and (re)fetch. Toggles closed again if already open.
  const handleLoad = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    load();
  }, [open, load]);

  // Auto-open and load when a valid node token is already cached (no signature prompt). Without one,
  // the user must press "Load services" — which mints a token via the signature flow.
  useEffect(() => {
    if (!open && isReady && account.address && hasValidNodeToken(DEFAULT_NODE_ID)) {
      setOpen(true);
      load();
    }
  }, [open, isReady, account.address, hasValidNodeToken, load]);

  // Route to the manage page. It hydrates its model/env display from the query params (peerId/env/
  // models) — the job alone can't rebuild the rich model card, so seed what we recovered from it.
  // Carry the payment token too: the manage page needs it in context for a Prolong re-entry, and
  // hydrating it from the URL avoids waiting on the async job-token seed effect (see manage page).
  const openService = (job: ServiceJob) => {
    const modelId = modelIdFromJob(job);
    const token = job.payment?.token;
    router.push({
      pathname: `/inference/services/${encodeURIComponent(job.serviceId)}`,
      query: {
        peerId: DEFAULT_NODE_ID,
        env: job.environment,
        ...(modelId ? { models: encodeModelIds([modelId]) } : {}),
        ...(token ? { token } : {}),
        duration: String(job.duration),
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
        <Button color="accent2" disabled={!isReady} onClick={handleLoad} size="md" variant="filled">
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

        {loading && jobs.length === 0 ? (
          <div className={styles.centered}>
            <CircularProgress size={18} />
          </div>
        ) : jobs.length === 0 ? (
          <div className={cx('textSecondary', styles.centered)}>No services yet.</div>
        ) : (
          <Table<ServiceJob>
            autoHeight
            actionsColumn={({ row }) => (
              <Button
                color="accent1"
                contentAfter={<ArrowForwardIcon />}
                onClick={() => openService(row)}
                size="sm"
                variant="outlined"
              >
                Manage
              </Button>
            )}
            data={jobs}
            getRowId={(row) => row.serviceId}
            paginationType="none"
            tableType={TableTypeEnum.EXISTING_SERVICES}
          />
        )}
      </Collapse>
    </Card>
  );
};

export default ExistingServicesTable;
