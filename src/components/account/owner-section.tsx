import OwnerNodes from '@/components/profile/owner-nodes';
import OwnerServiceStats from '@/components/profile/owner-service-stats';
import OwnerStats from '@/components/profile/owner-stats';
import { MyNodesTableContextProvider } from '@/context/table/my-nodes-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import styles from './owner-section.module.css';

const OwnerSection = () => {
  const { account } = useOceanAccount();

  return (
    <MyNodesTableContextProvider ownerId={account.address}>
      <OwnerServiceStats className={styles.statsCard} tileClassName={styles.sideSlot} />
      <OwnerStats className={styles.statsCard} gaugeClassName={styles.sideSlot} />
      <OwnerNodes />
    </MyNodesTableContextProvider>
  );
};

export default OwnerSection;
