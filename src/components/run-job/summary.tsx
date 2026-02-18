import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import { SelectedToken } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvNodeInfo, EnvResourcesSelection } from '@/types/environments';
import { Ide } from '@/types/ide';
import { generateAuthToken } from '@/utils/generateAuthToken';
import { ListItemIcon, Menu, MenuItem, styled } from '@mui/material';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './summary.module.css';

const StyledMenu = styled(Menu)({
  '& .MuiPaper-root': {
    backdropFilter: 'var(--backdrop-filter-glass)',
    background: 'var(--background-glass)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--drop-shadow-black)',
    borderRadius: 16,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 16,
  },
});

type SummaryProps = {
  estimatedTotalCost: number;
  freeCompute: boolean;
  nodeInfo: EnvNodeInfo;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  token: SelectedToken;
};

const Summary = ({
  estimatedTotalCost,
  freeCompute,
  nodeInfo,
  selectedEnv,
  selectedResources,
  token,
}: SummaryProps) => {
  const { account, ocean, signMessage } = useOceanAccount();
  const { getPeerMultiaddr } = useP2P();

  const { gpus } = useEnvResources({
    environment: selectedEnv,
    freeCompute,
    tokenAddress: token.address,
  });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedIde, setSelectedIde] = useState(Ide.vscode);

  useEffect(() => {
    const selectedIdeKey = localStorage.getItem('selectedIde');
    if (!selectedIdeKey || !(selectedIdeKey in Ide)) {
      return;
    }

    setSelectedIde(Ide[selectedIdeKey as keyof typeof Ide]);
  }, []);

  const generateToken = async () => {
    if (!account.address || !ocean) {
      return;
    }
    try {
      const authToken = await generateAuthToken(nodeInfo.id, account.address, signMessage);

      setAuthToken(authToken);
    } catch (error) {
      console.error('Failed to generate auth token:', error);
      toast.error('Failed to generate auth token');
    }
  };

  const openIde = async (uriScheme: string) => {
    if (!authToken || !account.address || !ocean) {
      return;
    }

    const peerMultiaddr = await getPeerMultiaddr(nodeInfo.id);
    const resources = [
      {
        id: selectedResources.cpuId,
        amount: selectedResources.cpuCores,
      },
      {
        id: selectedResources.ramId,
        amount: selectedResources.ram,
      },
      {
        id: selectedResources.diskId,
        amount: selectedResources.diskSpace,
      },
      ...gpus.map((availableGpu) => ({
        id: availableGpu.id,
        amount: selectedResources.gpus.find((selectedGpu) => selectedGpu.id === availableGpu.id) ? 1 : 0,
      })),
    ];
    const isFreeCompute = estimatedTotalCost === 0;
    ocean.updateConfiguration(
      authToken,
      account.address,
      nodeInfo.id,
      peerMultiaddr,
      isFreeCompute,
      selectedEnv.id,
      token.address,
      selectedResources.maxJobDurationHours * 60 * 60,
      resources,
      uriScheme
    );
  };

  const handleOpenIdeMenu = () => {
    setAnchorEl(document.getElementById('choose-editor-button'));
  };

  const handleCloseIdeMenu = () => {
    setAnchorEl(null);
  };

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
        <div className={styles.label}>Fee token address:</div>
        <div className={styles.value}>{token.address}</div>
        <div className={styles.label}>Job duration:</div>
        <div className={styles.value}>
          {selectedResources!.maxJobDurationHours} hours ({selectedResources!.maxJobDurationHours * 60 * 60} seconds)
        </div>
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
        <div className={styles.value}>{freeCompute ? 'Free' : `${estimatedTotalCost} ${token.symbol}`}</div>
      </div>
      {authToken ? (
        <div className={styles.footer}>
          <div>Continue on our VSCode extension, or select your editor of choice</div>
          <div className={styles.buttons}>
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
            <StyledMenu
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
            </StyledMenu>
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
        <div className={styles.footer}>
          <div>Continue on our VSCode extension, or select your editor of choice</div>
          <div className={styles.buttons}>
            <Button autoLoading color="accent1" onClick={generateToken} size="lg">
              Generate token
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default Summary;
