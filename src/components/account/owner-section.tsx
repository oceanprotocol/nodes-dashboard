import OwnerNodes from '@/components/profile/owner-nodes';
import OwnerServiceStats from '@/components/profile/owner-service-stats';
import OwnerStats from '@/components/profile/owner-stats';
import styles from './owner-section.module.css';

const OwnerSection = () => {
  return (
    <>
      <OwnerServiceStats className={styles.statsCard} tileClassName={styles.sideSlot} />
      <OwnerStats className={styles.statsCard} gaugeClassName={styles.sideSlot} />
      <OwnerNodes />
    </>
  );
};

export default OwnerSection;
