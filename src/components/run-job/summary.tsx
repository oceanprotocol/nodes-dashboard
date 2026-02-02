import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import { SelectedToken } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvNodeInfo, EnvResourcesSelection } from '@/types/environments';
import { Ide } from '@/types/ide';
import { ListItemIcon, Menu, MenuItem } from '@mui/material';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './summary.module.css';

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
  const { generateAuthToken } = useP2P();
  const { account, ocean } = useOceanAccount();

  const { gpus } = useEnvResources({
    environment: selectedEnv,
    freeCompute,
    tokenAddress: token.address,
  });

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedIde, setSelectedIde] = useState(Ide.vscode);

  const createAuthToken = async () => {
    if (!account.address || !nodeInfo.id) {
      return null;
    }
    const authToken = await generateAuthToken(nodeInfo.id, account.address);
    console.log('authToken', authToken);
    setAuthToken(authToken);
  };

  const openIde = async (uriScheme: string) => {
    if (!authToken || !account.address || !ocean) {
      return;
    }
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
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
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
              color="accent2"
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
              {Object.values(Ide).map((ide) => (
                <MenuItem
                  key={ide.uriScheme}
                  onClick={() => {
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
              color="accent2"
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
            <Button autoLoading color="accent2" onClick={createAuthToken} size="lg">
              Generate token
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default Summary;
