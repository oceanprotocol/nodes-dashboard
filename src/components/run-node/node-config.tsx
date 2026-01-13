import Button from '@/components/button/button';
import Card from '@/components/card/card';
import NodePreview from '@/components/run-node/node-preview';
import { useRunNodeContext } from '@/context/run-node-context';
import { githubDarkTheme, JsonEditor } from 'json-edit-react';
import styles from './node-config.module.css';

type NodeConfigProps = {
  peerId: string;
};

const NodeConfig = ({ peerId }: NodeConfigProps) => {
  const { nodeConfig, setNodeConfig } = useRunNodeContext();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.editorWrapper}>
        <JsonEditor
          data={nodeConfig}
          minWidth="100%"
          onUpdate={({ newData }) => setNodeConfig(newData as Record<string, any>)}
          theme={githubDarkTheme}
        />
      </div>
      {nodeConfig ? <NodePreview nodeConfig={nodeConfig} /> : null}
      <div className={styles.buttons}>
        <Button className="alignSelfEnd" color="accent2" href="/run-node/setup" size="lg" variant="outlined">
          Back
        </Button>
        <Button className="alignSelfEnd" color="accent2" size="lg" variant="filled">
          Push config to node
        </Button>
      </div>
    </Card>
  );
};

export default NodeConfig;
