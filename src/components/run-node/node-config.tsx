import Button from '@/components/button/button';
import Card from '@/components/card/card';
import NodePreview from '@/components/run-node/node-preview';
import { useRunNodeContext } from '@/context/run-node-context';

const NodeConfig = () => {
  const { nodeConfig, setNodeConfig } = useRunNodeContext();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <textarea
        value={JSON.stringify(nodeConfig)}
        onChange={(e) => setNodeConfig(JSON.parse(e.target.value))}
        style={{ background: 'black' }}
      />
      {nodeConfig ? <NodePreview nodeConfig={nodeConfig} /> : null}
      <Button className="alignSelfEnd" color="accent2" size="lg" variant="filled">
        Push config to node
      </Button>
    </Card>
  );
};

export default NodeConfig;
