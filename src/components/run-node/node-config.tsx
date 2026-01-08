import Button from '@/components/button/button';
import Card from '@/components/card/card';
import NodePreview from '@/components/run-node/node-preview';
import { useRunNodeContext } from '@/context/run-node-context';
import { JsonEditor } from 'json-edit-react';

const NodeConfig = () => {
  const { nodeConfig, setNodeConfig } = useRunNodeContext();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <JsonEditor data={nodeConfig} onUpdate={({ newData }) => setNodeConfig(newData as Record<string, any>)} />
      {nodeConfig ? <NodePreview nodeConfig={nodeConfig} /> : null}
      <Button className="alignSelfEnd" color="accent2" size="lg" variant="filled">
        Push config to node
      </Button>
    </Card>
  );
};

export default NodeConfig;
