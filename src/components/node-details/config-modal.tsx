import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Modal from '@/components/modal/modal';
import ConfigureGeneral from '@/components/node-config/configure-general';
import ConfigureIndexer from '@/components/node-config/configure-indexer';
import ConfigureResources from '@/components/node-config/configure-resources';
import styles from '@/components/node-config/node-config.module.css';
import { NodeConfig } from '@/types/node-config';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CircularProgress, Collapse } from '@mui/material';
import classNames from 'classnames';
import { Dispatch, SetStateAction, useState } from 'react';

type ConfigModalProps = {
  isOpen: boolean;
  fetchingConfig: boolean;
  pushingConfig: boolean;
  config: Record<string, any>;
  editedConfig: Record<string, any>;
  setEditedConfig: Dispatch<SetStateAction<Record<string, any>>>;
  handlePushConfig: (config: Record<string, any>) => Promise<void>;
  onClose: () => void;
};

const ConfigModal = ({
  isOpen,
  fetchingConfig,
  pushingConfig,
  config,
  editedConfig,
  setEditedConfig,
  handlePushConfig,
  onClose,
}: ConfigModalProps) => {
  const [generalOpen, setGeneralOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [indexerOpen, setIndexerOpen] = useState(true);

  const isFetching = fetchingConfig && (!config || Object.keys(config).length === 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit node config" width="lg">
      {isFetching ? (
        <div className="flexRow alignItemsCenter justifyContentCenter gapMd" style={{ padding: '40px' }}>
          <CircularProgress size={24} />
          <span>Fetching config...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setGeneralOpen(!generalOpen)}
              tabIndex={0}
            >
              General
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: generalOpen })} />
            </h3>
            <Collapse in={generalOpen}>
              <ConfigureGeneral config={editedConfig as NodeConfig} setConfig={setEditedConfig as any} />
            </Collapse>
          </Card>

          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setResourcesOpen(!resourcesOpen)}
              tabIndex={0}
            >
              Resources
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: resourcesOpen })} />
            </h3>
            <Collapse in={resourcesOpen}>
              <ConfigureResources config={editedConfig as NodeConfig} setConfig={setEditedConfig as any} />
            </Collapse>
          </Card>

          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setIndexerOpen(!indexerOpen)}
              tabIndex={0}
            >
              Indexer
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: indexerOpen })} />
            </h3>
            <Collapse in={indexerOpen}>
              <ConfigureIndexer config={editedConfig as NodeConfig} setConfig={setEditedConfig as any} />
            </Collapse>
          </Card>

          <div className="actionsGroupMdEnd">
            <Button color="accent1" onClick={onClose} type="button" variant="outlined">
              Cancel
            </Button>
            <Button
              autoLoading
              color="accent1"
              loading={pushingConfig}
              onClick={() => handlePushConfig(editedConfig)}
              type="button"
              variant="filled"
            >
              Push config
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ConfigModal;
