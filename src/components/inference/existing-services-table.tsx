import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getApiRoute } from '@/config';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { encodeModelIds } from '@/services/huggingface-service';
import { fetchTemplates, findTemplateByImage } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import { ServiceJob } from '@oceanprotocol/lib';
import axios from 'axios';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './existing-services-table.module.css';

type ServiceSession = {
  serviceId: string;
  peerId?: string;
  status?: number;
  statusText?: string;
  environment?: string;
  dockerCmd?: string[];
  /** Container image the service was launched from — matched back to a template (see findTemplateByImage). */
  image?: string;
  model?: string;
  duration?: number;
  expiresAt?: number;
  dateCreated: number;
  payment?: { token?: string };
};

// Rows are ServiceJob-shaped so the shared existingServicesColumns can render them, but the
// backend's session records are looser than the node's own ServiceJob (no clusterHash/etc, and
// peerId is ours). Keep the session alongside for routing, and the matched template's name so the
// Model column can name the app instead of a model that doesn't exist for a template launch.
type ServiceRow = Partial<ServiceJob> & {
  serviceId: string;
  session: ServiceSession;
  templateName?: string;
  templatePending?: boolean;
};

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
//
// A template-launched service has no HF model at all — the whole app rides in the template's own
// image/command — so when one matched, the row names the template and carries no model id.
function toRow(session: ServiceSession, template: AppTemplate | undefined, templatesLoading: boolean): ServiceRow {
  const createdMs = session.dateCreated > 1e12 ? session.dateCreated : session.dateCreated * 1000;
  const modelId = template ? null : modelIdFromSession(session);
  return {
    ...session,
    dateCreated: new Date(createdMs).toISOString(),
    dockerCmd: modelId ? ['--model', modelId] : template ? [] : session.dockerCmd,
    session,
    templateName: template ? (template.name ?? template.id) : undefined,
    templatePending: !template && !modelId && templatesLoading,
  };
}

const ExistingServicesTable: React.FC = () => {
  const router = useRouter();
  const { account } = useOceanAccount();
  const { isReady: p2pReady, getServiceTemplates } = useP2P();

  const [sessions, setSessions] = useState<ServiceSession[]>([]);
  const [total, setTotal] = useState(0);
  const [templateByService, setTemplateByService] = useState<Record<string, AppTemplate>>({});
  // Template matching is a second, node-side fetch that resolves after the services land. Tracked
  // separately so modelless rows can shimmer instead of flashing "Unknown model" in the meantime.
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Services aren't fetched on mount — the collapsible only opens (and loads) once "Load" is pressed.
  const [open, setOpen] = useState(false);

  const requestRef = useRef<AbortController>();

  // Template matching resolves after the services themselves (a second, node-side fetch), so rows are
  // derived rather than stored — they re-render with the app name once the match lands.
  const rows = useMemo(
    () => sessions.map((session) => toRow(session, templateByService[session.serviceId], templatesLoading)),
    [sessions, templateByService, templatesLoading]
  );

  useEffect(() => {
    requestRef.current?.abort();
    setSessions([]);
    setTotal(0);
    setTemplateByService({});
    setTemplatesLoading(false);
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
    setTemplatesLoading(p2pReady);
    setError(null);
    try {
      const { data } = await axios.get(`${getApiRoute('owners')}/${account.address.toLowerCase()}/services`, {
        params: { page: 1, size: 100, sort: JSON.stringify({ dateCreated: 'desc' }) },
        signal: request.signal,
      });
      const services: ServiceSession[] = data.services ?? [];
      setSessions(services);
      setTotal(data.pagination?.totalItems ?? 0);
      // The rows are renderable now — drop the whole-table spinner and let the slower template match
      // resolve underneath it, shimmering only the cells whose name depends on it.
      setLoading(false);
      if (p2pReady) {
        try {
          const templates = await fetchTemplates(getServiceTemplates, request.signal);
          const matched: Record<string, AppTemplate> = {};
          for (const service of services) {
            // A plain model launch shares its image with the vLLM template, so image alone would
            // relabel real model rows as the app. Only services with no model id are template runs.
            if (modelIdFromSession(service)) {
              continue;
            }
            const tpl = findTemplateByImage(templates, service.image);
            if (tpl) {
              matched[service.serviceId] = tpl;
            }
          }
          if (!request.signal.aborted) {
            setTemplateByService(matched);
          }
        } catch (templateErr) {
          console.error('Failed to match services to templates:', templateErr);
        } finally {
          if (!request.signal.aborted) {
            setTemplatesLoading(false);
          }
        }
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        return;
      }
      console.error('Failed to load existing services:', err);
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
          (err instanceof Error ? err.message : 'Failed to load services.')
      );
    } finally {
      if (!request.signal.aborted) {
        setLoading(false);
        setTemplatesLoading(false);
      }
    }
  }, [account.address, p2pReady, getServiceTemplates]);

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
    const template = templateByService[session.serviceId];
    const modelId = template ? null : modelIdFromSession(session);
    const token = session.payment?.token;
    router.push({
      pathname: `/inference/services/${encodeURIComponent(session.serviceId)}`,
      query: {
        peerId: session.peerId,
        env: session.environment,
        ...(template ? { template: template.id } : modelId ? { models: encodeModelIds([modelId]) } : {}),
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
          <h3>My services</h3>
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
