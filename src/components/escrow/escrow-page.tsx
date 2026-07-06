import Container from '@/components/container/container';
import EscrowHistory from '@/components/escrow/escrow-history';
import EscrowManage from '@/components/escrow/escrow-manage';
import SectionTitle from '@/components/section-title/section-title';
import TabBar from '@/components/tab-bar/tab-bar';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './escrow-page.module.css';

type EscrowTab = 'manage' | 'history';

const EscrowPage = () => {
  const [activeTab, setActiveTab] = useState<EscrowTab>('manage');

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Escrow management"
        subTitle="Manage escrow funds, authorizations, and review your escrow transaction history."
      />
      <div className={classNames('pageContentWrapper', styles.content)}>
        <TabBar
          activeKey={activeTab}
          className="alignSelfCenter"
          tabs={[
            {
              key: 'manage',
              label: 'Manage escrow',
              onClick: () => setActiveTab('manage'),
            },
            {
              key: 'history',
              label: 'Escrow history',
              onClick: () => setActiveTab('history'),
            },
          ]}
        />

        {activeTab === 'manage' ? <EscrowManage /> : <EscrowHistory />}
      </div>
    </Container>
  );
};

export default EscrowPage;
