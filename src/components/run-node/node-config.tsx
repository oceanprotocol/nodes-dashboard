import Button from '@/components/button/button';
import Card from '@/components/card/card';
import NodePreview from '@/components/run-node/node-preview';
import { useRunNodeContext } from '@/context/run-node-context';
import { githubDarkTheme, JsonEditor } from 'json-edit-react';
import { useEffect, useState } from 'react';
import styles from './node-config.module.css';

const NodeConfig = () => {
  const { configErrors, loadingPushConfig, loadingFetchConfig, nodeConfig, peerId, pushConfig } = useRunNodeContext();

  const [editedConfig, setEditedConfig] = useState(nodeConfig ?? {});

  useEffect(() => {
    setEditedConfig(nodeConfig ?? {});
  }, [nodeConfig]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      {loadingFetchConfig ? (
        'Loading config...'
      ) : (
        <>
          <div className={styles.editorWrapper}>
            <JsonEditor
              data={editedConfig}
              minWidth="100%"
              onUpdate={({ newData }) => setEditedConfig(newData as Record<string, any>)}
              theme={githubDarkTheme}
            />
          </div>
          {editedConfig ? <NodePreview nodeConfig={editedConfig} /> : null}
          {configErrors.length > 0 ? (
            <Card
              className={styles.root}
              direction="column"
              padding="sm"
              radius="md"
              spacing="sm"
              variant="error-outline"
            >
              <h3 className="textError">Format errors</h3>
              <ul className={styles.errorsList}>
                {configErrors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
      <div className={styles.footer}>
        <Button
          color="accent1"
          disabled={loadingPushConfig}
          href={`/nodes/${peerId}`}
          size="lg"
          target="_blank"
          variant="transparent"
        >
          View node details
        </Button>
        <div className={styles.buttons}>
          <Button color="accent1" disabled={loadingPushConfig} href="/run-node/setup" size="lg" variant="outlined">
            Back
          </Button>
          <Button
            color="accent1"
            loading={loadingPushConfig}
            onClick={() => pushConfig(editedConfig)}
            size="lg"
            variant="filled"
          >
            Push config to node
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default NodeConfig;
