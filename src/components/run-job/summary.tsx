import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import Menu from '@/components/menu/menu';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { ComputeEnvironment, EnvNodeInfo, EnvResourcesSelection } from '@/types/environments';
import { Ide } from '@/types/ide';
import { formatDuration } from '@/utils/formatters';
import { CircularProgress, ListItemIcon, MenuItem } from '@mui/material';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './summary.module.css';
type SummaryProps = {
  estimatedTotalCost: number;
  freeCompute: boolean;
  nodeInfo: EnvNodeInfo;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  token: SelectedToken | null;
};

const Summary = ({
  estimatedTotalCost,
  freeCompute,
  nodeInfo,
  selectedEnv,
  selectedResources,
  token,
}: SummaryProps) => {
  const router = useRouter();

  const { account, ocean, signMessage } = useOceanAccount();
  const { getPeerMultiaddr } = useP2P();
  const { multiaddrsOrPeerId } = useRunJobContext();

  const { gpus } = useEnvResources({
    environment: selectedEnv,
    freeCompute,
    tokenAddress: token?.address ?? '',
  });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedIde, setSelectedIde] = useState(Ide.vscode);
  const [paymentCheckStarted, setPaymentCheckStarted] = useState(false);
  const [paymentCheckFinished, setPaymentCheckFinished] = useState(false);

  useEffect(() => {
    const selectedIdeKey = localStorage.getItem('selectedIde');
    if (!selectedIdeKey || !(selectedIdeKey in Ide)) {
      return;
    }

    setSelectedIde(Ide[selectedIdeKey as keyof typeof Ide]);
  }, []);

  /**
   * Check if payment was made.
   * If not, return to payment page
   */
  const checkPaymentStatus = useCallback(async () => {
    if (freeCompute || !token) {
      setPaymentCheckFinished(true);
      return;
    }
    if (ocean && account?.address) {
      const authorizations = await ocean.getAuthorizations(token.address, account.address, selectedEnv.consumerAddress);
      const currentLockedAmount = Number(authorizations?.currentLockedAmount ?? 0);
      const escrowBalanceStr = await ocean.getUserFunds(token.address, account.address);
      const escrowBalance = Number(escrowBalanceStr);
      const sufficientEscrow = (escrowBalance ?? 0) >= estimatedTotalCost;
      const suffficientAuthorized =
        (Number(authorizations?.maxLockedAmount) ?? 0) >= estimatedTotalCost + currentLockedAmount;
      const enoughLockSeconds =
        (Number(authorizations?.maxLockSeconds) ?? 0) >= selectedResources.maxJobDurationSeconds;
      if (sufficientEscrow && suffficientAuthorized && enoughLockSeconds) {
        setPaymentCheckFinished(true);
      } else {
        router.replace({ pathname: '/run-job/payment', query: router.query });
      }
    }
  }, [
    freeCompute,
    token,
    ocean,
    account.address,
    selectedEnv.consumerAddress,
    estimatedTotalCost,
    selectedResources.maxJobDurationSeconds,
    router,
  ]);

  /**
   * Initiate payment check
   */
  useEffect(() => {
    if (!paymentCheckStarted) {
      setPaymentCheckStarted(true);
      checkPaymentStatus();
    }
  }, [checkPaymentStatus, paymentCheckStarted]);

  const generateToken = async () => {
    if (!account.address || !ocean) {
      return;
    }
    try {
      const { token } = await createAuthToken({
        consumerAddress: account.address,
        multiaddrsOrPeerId: multiaddrsOrPeerId!,
        signMessage,
      });
      setAuthToken(token);
      posthog.capture('authToken_generated', {
        nodeId: nodeInfo.id,
        environmentId: selectedEnv.id,
        freeCompute,
      });
    } catch (error) {
      console.error('Failed to generate auth token:', error);
      toast.error('Failed to generate auth token');
    }
  };

  const openIde = async (uriScheme: string) => {
    if (!authToken || !account.address || !ocean) {
      return;
    }
    const peerMultiaddr = await getPeerMultiaddr(multiaddrsOrPeerId!);
    const resources = [
      ...gpus.map((availableGpu) => ({
        id: availableGpu.id,
        amount: selectedResources.gpus.find((selectedGpu) => selectedGpu.id === availableGpu.id) ? 1 : 0,
      })),
    ];
    if (selectedResources.cpuId && selectedResources.cpuCores) {
      resources.push({
        id: selectedResources.cpuId,
        amount: selectedResources.cpuCores,
      });
    }
    if (selectedResources.ramId && selectedResources.ram) {
      resources.push({
        id: selectedResources.ramId,
        amount: selectedResources.ram,
      });
    }
    if (selectedResources.diskId && selectedResources.diskSpace) {
      resources.push({
        id: selectedResources.diskId,
        amount: selectedResources.diskSpace,
      });
    }
    const isFreeCompute = estimatedTotalCost === 0;
    ocean.updateConfiguration(
      authToken,
      account.address,
      nodeInfo.id,
      peerMultiaddr,
      isFreeCompute,
      selectedEnv.id,
      token?.address ?? '',
      selectedResources.maxJobDurationSeconds,
      resources,
      uriScheme
    );
    posthog.capture('ide_opened', {
      ide: uriScheme,
      nodeId: nodeInfo.id,
      environmentId: selectedEnv.id,
      freeCompute: isFreeCompute,
    });
  };

  const handleOpenIdeMenu = () => {
    setAnchorEl(document.getElementById('choose-editor-button'));
  };

  const handleCloseIdeMenu = () => {
    setAnchorEl(null);
  };

  if (!paymentCheckFinished) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  const backButton = (
    <Button
      color="accent1"
      onClick={() => router.replace('/run-job/resources')}
      size="lg"
      type="button"
      variant="transparent"
    >
      Edit resources
    </Button>
  );

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Your selection</h3>
      <div className={styles.grid}>
        {nodeInfo.friendlyName ? (
          <>
            <div className={styles.label}>Node:</div>
            <div className={styles.value}>{nodeInfo.friendlyName}</div>
          </>
        ) : null}
        <div className={styles.label}>Peer ID:</div>
        <div className={styles.value}>{nodeInfo.id}</div>
        <div className={styles.label}>Environment:</div>
        <div className={styles.value}>{selectedEnv.consumerAddress}</div>
        {token ? (
          <>
            <div className={styles.label}>Fee token address:</div>
            <div className={styles.value}>{token.address}</div>
          </>
        ) : null}
        <div className={styles.label}>Job duration:</div>
        <div className={styles.value}>{formatDuration(selectedResources!.maxJobDurationSeconds)}</div>
        <div className={styles.label}>GPU:</div>
        <div className={classNames(styles.value, styles.gpus)}>
          {selectedResources.gpus.length
            ? selectedResources.gpus.map((gpu) => <GpuLabel key={gpu.id} gpu={gpu.description} />)
            : '-'}
        </div>
        <div className={styles.label}>CPU cores:</div>
        <div className={styles.value}>{selectedResources!.cpuCores}</div>
        <div className={styles.label}>RAM:</div>
        <div className={styles.value}>{selectedResources!.ram} GB</div>
        <div className={styles.label}>Disk space:</div>
        <div className={styles.value}>{selectedResources!.diskSpace} GB</div>
        <div className={styles.label}>Total cost:</div>
        <div className={styles.value}>{freeCompute ? 'Free' : `${estimatedTotalCost} ${token?.symbol}`}</div>
      </div>
      <div className={styles.footer}>
        <div>Continue your job with Ocean Orchestrator directly in VS Code, Cursor, Antigravity, or Windsurf</div>
        {authToken ? (
          <div className={styles.buttons}>
            {backButton}
            <div className={styles.buttonsGroup}>
              <Button
                color="accent1"
                id="choose-editor-button"
                onClick={() => {
                  handleOpenIdeMenu();
                }}
                size="lg"
                variant="outlined"
              >
                Choose editor
              </Button>
              <Menu
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'center',
                }}
                disableScrollLock
                onClose={handleCloseIdeMenu}
                open={!!anchorEl}
                slotProps={{
                  list: {
                    'aria-labelledby': 'profile-button',
                  },
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'center',
                }}
              >
                {Object.entries(Ide).map(([key, ide]) => (
                  <MenuItem
                    disableRipple
                    key={ide.uriScheme}
                    onClick={() => {
                      localStorage.setItem('selectedIde', key);
                      setSelectedIde(ide);
                      handleCloseIdeMenu();
                    }}
                  >
                    <ListItemIcon>{ide.icon}</ListItemIcon>
                    {ide.name}
                  </MenuItem>
                ))}
              </Menu>
              <Button
                autoLoading
                color="accent1"
                contentBefore={
                  <span style={{ height: '18px', width: 'auto', display: 'flex', alignItems: 'center' }}>
                    {selectedIde.icon}
                  </span>
                }
                onClick={async () => await openIde(selectedIde.uriScheme)}
                size="lg"
              >
                Open {selectedIde.name}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.buttons}>
            {backButton}
            <Button autoLoading color="accent1" onClick={generateToken} size="lg">
              Generate token
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default Summary;
