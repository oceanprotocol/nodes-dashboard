import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';
import { githubDarkTheme, JsonEditor } from 'json-edit-react';
import { Dispatch, SetStateAction } from 'react';
import styles from './config-modal.module.css';

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit node config" width="md">
      <div className={styles.modalContent}>
        {fetchingConfig && (!config || Object.keys(config).length === 0) ? (
          <div className={styles.fetching}>Fetching config...</div>
        ) : (
          <div className="flex flex-col" style={{ gap: '24px' }}>
            <div className={styles.editorWrapper}>
              <JsonEditor
                collapse={({ value }) => typeof value === 'object' && value !== null && Object.keys(value).length === 0}
                data={editedConfig}
                onUpdate={({ newData }) => setEditedConfig(newData as Record<string, any>)}
                theme={githubDarkTheme}
                minWidth="100%"
              />
            </div>
            <div className={styles.buttons}>
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
      </div>
    </Modal>
  );
};

export default ConfigModal;
