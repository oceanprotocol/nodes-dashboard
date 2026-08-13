import AccessListsManager from '@/components/access-lists/access-lists-manager';
import AccountNav from '@/components/account/account-nav';
import { AccountSectionKey, getAccountSection } from '@/components/account/account-sections';
import CompySection from '@/components/account/compy-section';
import ConsumerSection from '@/components/account/consumer-section';
import OwnerSection from '@/components/account/owner-section';
import AuthRequiredPage from '@/components/auth/auth-required-page';
import Container from '@/components/container/container';
import EscrowManager from '@/components/escrow/escrow-manager';
import RemoteStorageManager from '@/components/node-storage/remote-storage-manager';
import NodeTokensManager from '@/components/node-tokens/node-tokens-manager';
import SectionTitle from '@/components/section-title/section-title';
import classNames from 'classnames';
import styles from './account-page.module.css';

type AccountPageProps = {
  section: AccountSectionKey;
};

/**
 * Only the active section mounts, so a section's data providers (jobs table, nodes table)
 * never fetch for a section the user is not looking at.
 */
const renderSection = (section: AccountSectionKey) => {
  switch (section) {
    case 'owner':
      return <OwnerSection />;
    case 'consumer':
      return <ConsumerSection />;
    case 'escrow':
      return <EscrowManager />;
    case 'compy':
      return <CompySection />;
    case 'access-lists':
      return <AccessListsManager />;
    case 'storage':
      return <RemoteStorageManager />;
    case 'tokens':
      return <NodeTokensManager />;
  }
};

const AccountPage = ({ section }: AccountPageProps) => {
  const activeSection = getAccountSection(section);

  return (
    <AuthRequiredPage>
      <Container className="pageRoot">
        <div className={styles.layout}>
          <AccountNav activeKey={section} className={styles.nav} />
          <SectionTitle
            className={styles.title}
            moreReadable
            title={activeSection.title}
            subTitle={activeSection.description}
          />
          <div className={classNames('pageContentWrapper', styles.content)}>{renderSection(section)}</div>
        </div>
      </Container>
    </AuthRequiredPage>
  );
};

export default AccountPage;
