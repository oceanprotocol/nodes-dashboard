import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { CodeBlock } from '@/components/code-block/code-block';
import NodeConnection from '@/components/run-node/node-connection';
import { useRunNodeContext } from '@/context/run-node-context';
import styles from './node-setup.module.css';

const NodeSetup = () => {
  const { peerId } = useRunNodeContext();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Set up Ocean Node via Docker</h3>
      <div>Before starting, make sure the system requirements are met</div>
      <div>
        Docker Engine and Docker Compose are recommended for hosting a node eligible for incentives
        <br />
        You can explore other options in the Ocean Node readme
      </div>
      <div className={styles.section}>
        <h5>1. Download the setup script</h5>
        <CodeBlock code="curl" />
      </div>
      <div className={styles.section}>
        <h5>2. Run the setup script and provide the required info</h5>
        <CodeBlock code="bash scripts/ocean-node-quickstart.sh" />
      </div>
      <div className={styles.section}>
        <h5>3. Run Ocean Node</h5>
        <CodeBlock code="$ docker-compose up -d" />
      </div>
      <div className={styles.section}>
        <h5>4. Confirm that Docker containers are running</h5>
        <CodeBlock code="$ docker ps" />
      </div>
      <NodeConnection />
      {peerId ? (
        <Button className="alignSelfEnd" color="accent2" href="/run-node/configure" size="lg" variant="filled">
          Continue
        </Button>
      ) : null}
    </Card>
  );
};

export default NodeSetup;
