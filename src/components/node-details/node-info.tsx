import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Balance } from '@/components/node-details/balance';
import Eligibility from '@/components/node-details/eligibility';
import { Node, NodeEligibility } from '@/types/nodes';
import DnsIcon from '@mui/icons-material/Dns';
import DownloadIcon from '@mui/icons-material/Download';
import LocationPinIcon from '@mui/icons-material/LocationPin';
import PublicIcon from '@mui/icons-material/Public';
import UploadIcon from '@mui/icons-material/Upload';
import styles from './node-info.module.css';

type NodeInfoProps = {
  node: Node;
};

const NodeInfo = ({ node }: NodeInfoProps) => {
  return (
    <Card className={styles.root} padding="md" radius="lg" variant="glass-shaded">
      <div className={styles.infoWrapper}>
        <div className={styles.infoContent}>
          <div>
            <h2 className={styles.title}>{node.friendlyName}</h2>
            <div className={styles.hash}>{node.id}</div>
          </div>
          <div className={styles.grid}>
            <PublicIcon className={styles.icon} />
            <div>{`${node.location?.ip} / ${node.ipAndDns?.dns}`}</div>
            {
              <>
                <DnsIcon className={styles.icon} />
                {node.platform?.osType ? <div>{node.platform?.osType}</div> : <div>Unknown</div>}
              </>
            }

            <LocationPinIcon className={styles.icon} />
            <div>
              {node.location?.city}, {node.location?.country}
            </div>
          </div>
          <div className={styles.buttons}>
            <Button contentBefore={<DownloadIcon />} variant="outlined">
              Get node config
            </Button>
            <Button contentBefore={<UploadIcon />}>Set node config</Button>
          </div>
        </div>
        <div className={styles.infoFooter}>
          <div>
            <strong>Admins:</strong>
            {node.allowedAdmins?.map((admin) => (
              <div key={admin} className={styles.hash}>
                {admin}
              </div>
            ))}
          </div>
          <div>{node.version && <span>Ocean Node v{node.version}</span>}</div>
        </div>
      </div>
      <div className={styles.statusWrapper}>
        <Eligibility
          eligibility={
            node.eligible
              ? NodeEligibility.ELIGIBLE
              : node.eligibilityCauseStr === 'Banned'
                ? NodeEligibility.BANNED
                : NodeEligibility.NON_ELIGIBLE
          }
          eligibilityCauseStr={node.eligibilityCauseStr}
          banInfo={node.banInfo}
        />
        <Balance nodeUrl={`https://${node.ipAndDns?.dns}`} />
      </div>
    </Card>
  );
};

export default NodeInfo;
