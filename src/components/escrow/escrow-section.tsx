import EscrowHistory from '@/components/escrow/escrow-history';
import EscrowManager from '@/components/escrow/escrow-manager';
import TabBar from '@/components/tab-bar/tab-bar';
import { useRouter } from 'next/router';
import styles from './escrow-section.module.css';

type EscrowTab = 'manage' | 'history';

const EscrowSection = () => {
  const router = useRouter();
  const segments = router.query.section;
  const activeTab: EscrowTab = Array.isArray(segments) && segments[1] === 'history' ? 'history' : 'manage';

  return (
    <>
      <TabBar
        activeKey={activeTab}
        className={styles.tabBar}
        tabs={[
          { href: '/account/escrow', key: 'manage', label: 'Manage' },
          { href: '/account/escrow/history', key: 'history', label: 'History' },
        ]}
      />
      {activeTab === 'history' ? <EscrowHistory /> : <EscrowManager />}
    </>
  );
};

export default EscrowSection;
