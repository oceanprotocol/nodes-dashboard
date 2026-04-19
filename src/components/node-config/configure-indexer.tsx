import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import Switch from '@/components/switch/switch';
import { NodeConfig } from '@/types/node-config';
import LinkIcon from '@mui/icons-material/Link';
import { useState } from 'react';
import styles from './configure-indexer.module.css';
import commonStyles from './node-config.module.css';

type ConfigureIndexerProps = {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
};

type SupportedNetwork = NonNullable<NodeConfig['supportedNetworks']>[string];

const findUnusedChainKey = (existing: Record<string, unknown>): string => {
  let candidate = 1;
  while (existing[String(candidate)]) {
    candidate++;
  }
  return String(candidate);
};

const ConfigureIndexer: React.FC<ConfigureIndexerProps> = ({ config, setConfig }) => {
  const networks = config.supportedNetworks ?? {};
  const networkKeys = Object.keys(networks);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pendingChainId, setPendingChainId] = useState('');

  const handleHasIndexerChange = (_: unknown, checked: boolean) => {
    setConfig({ ...config, hasIndexer: checked });
  };

  const updateNetworks = (next: Record<string, SupportedNetwork>) => {
    setConfig({ ...config, supportedNetworks: next });
  };

  const handleOpenAddModal = () => {
    setPendingChainId('');
    setAddModalOpen(true);
  };

  const handleConfirmAddNetwork = () => {
    const key = pendingChainId.trim() || findUnusedChainKey(networks);
    updateNetworks({
      ...networks,
      [key]: {
        chainId: Number(key) || 0,
        chunkSize: 100,
        network: '',
        rpc: '',
      },
    });
    setAddModalOpen(false);
  };

  const handleRemove = (key: string) => {
    const next = { ...networks };
    delete next[key];
    updateNetworks(next);
  };

  const handleFieldChange = <K extends keyof SupportedNetwork>(key: string, field: K, value: SupportedNetwork[K]) => {
    updateNetworks({
      ...networks,
      [key]: { ...networks[key], [field]: value },
    });
  };

  return (
    <div className={commonStyles.sectionContent}>
      <Switch
        className="alignSelfStart"
        checked={!!config.hasIndexer}
        label="Enable indexer"
        name="hasIndexer"
        onChange={handleHasIndexerChange}
      />
      {!config.hasIndexer ? (
        <span className="textSecondary">Enable the indexer to configure supported networks.</span>
      ) : (
        <>
          <div className={styles.indexerHeader}>
            <h4 className={commonStyles.subsectionTitle}>Supported networks</h4>
            <Button color="accent1" onClick={handleOpenAddModal} size="md" variant="filled">
              Add network
            </Button>
          </div>

          <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add network" width="xs">
            <Input
              label="Chain ID"
              min={1}
              name="pendingChainId"
              onChange={(e) => setPendingChainId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAddNetwork();
              }}
              type="number"
              value={pendingChainId}
            />
            <div className="actionsGroupMdEnd">
              <Button color="accent1" onClick={() => setAddModalOpen(false)} size="md" variant="outlined">
                Cancel
              </Button>
              <Button
                color="accent1"
                disabled={!pendingChainId.trim()}
                onClick={handleConfirmAddNetwork}
                size="md"
                variant="filled"
              >
                Add
              </Button>
            </div>
          </Modal>
          {networkKeys.length === 0 ? (
            <span className="textSecondary">No networks configured.</span>
          ) : (
            <div className={styles.networksGrid}>
              {networkKeys.map((key) => {
                const net = networks[key];
                return (
                  <Card
                    direction="column"
                    innerShadow="black"
                    key={key}
                    padding="sm"
                    radius="sm"
                    spacing="sm"
                    variant="glass"
                  >
                    <div className={styles.networkHeader}>
                      <Input
                        name={`network-${key}`}
                        onChange={(e) => handleFieldChange(key, 'network', e.target.value)}
                        placeholder="Network name"
                        size="sm"
                        type="text"
                        value={net.network ?? ''}
                      />
                      <Button color="accent1" onClick={() => handleRemove(key)} size="md" variant="outlined">
                        Remove
                      </Button>
                    </div>
                    <Input
                      name={`rpc-${key}`}
                      onChange={(e) => handleFieldChange(key, 'rpc', e.target.value)}
                      placeholder="RPC URL"
                      size="sm"
                      startAdornment={<LinkIcon className="textAccent1" fontSize="small" />}
                      type="text"
                      value={net.rpc ?? ''}
                    />
                    <div className={styles.networkFieldsRow}>
                      <Input
                        disabled
                        label="Chain ID"
                        min={0}
                        name={`chainId-${key}`}
                        size="sm"
                        type="number"
                        value={net.chainId ?? ''}
                      />
                      <Input
                        label="Chunk size"
                        min={1}
                        name={`chunkSize-${key}`}
                        onChange={(e) =>
                          handleFieldChange(key, 'chunkSize', e.target.value === '' ? 0 : Number(e.target.value))
                        }
                        size="sm"
                        type="number"
                        value={net.chunkSize ?? ''}
                      />
                      <Input
                        label="Start block"
                        min={0}
                        name={`startBlock-${key}`}
                        onChange={(e) =>
                          handleFieldChange(
                            key,
                            'startBlock',
                            e.target.value === '' ? undefined : Number(e.target.value)
                          )
                        }
                        size="sm"
                        type="number"
                        value={net.startBlock ?? ''}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConfigureIndexer;
