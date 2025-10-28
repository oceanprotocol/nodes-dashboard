import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Balance } from '@/components/node-details/balance';
import Eligibility from '@/components/node-details/eligibility';
import { NodeEligibility } from '@/types/nodes';
import DnsIcon from '@mui/icons-material/Dns';
import LocationPinIcon from '@mui/icons-material/LocationPin';
import PublicIcon from '@mui/icons-material/Public';
import styles from './node-info.module.css';

type NodeInfoProps = {
  eligibility: NodeEligibility;
};

const NodeInfo = ({ eligibility }: NodeInfoProps) => {
  // TODO replace mock data
  return (
    <Card className={styles.root} padding="md" radius="lg" variant="glass-shaded">
      <div className={styles.infoWrapper}>
        <div className={styles.infoContent}>
          <div>
            <h2 className={styles.title}>Friendly node name</h2>
            <div className={styles.hash}>0x7097B048A37146aE52A27908Bebd351214C8d8f3</div>
          </div>
          <div className={styles.grid}>
            <PublicIcon className={styles.icon} />
            <div>49.151.255.255 / node.oceanprotocol.com</div>
            <DnsIcon className={styles.icon} />
            <div>Linux (Ubuntu 22.04 LTS)</div>
            <LocationPinIcon className={styles.icon} />
            <div>Warsaw, Poland</div>
          </div>
          <div className={styles.buttons}>
            <Button>Get node config</Button>
            <Button>Set node config</Button>
          </div>
        </div>
        <div className={styles.infoFooter}>
          <div>
            <strong>Admins:</strong>
            <div className={styles.hash}>0x7097B048A37146aE52A27908Bebd351214C8d8f3</div>
            <div className={styles.hash}>0x7097B048A37146aE52A27908Bebd351214C8d8f3</div>
          </div>
          <div>Ocean Node v4.5.1</div>
        </div>
      </div>
      <div className={styles.statusWrapper}>
        <Eligibility eligibility={eligibility} />
        <Balance />
      </div>
    </Card>
  );
};

export default NodeInfo;
