import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import TabBar from '@/components/tab-bar/tab-bar';
import { CircularProgress } from '@mui/material';
import React from 'react';

type TabKey = 'info' | 'storage';

type NodePageLayoutProps = {
  activeTab: TabKey;
  children?: React.ReactNode;
  isWalletConnected?: boolean;
  loading?: boolean;
  nodeId?: string;
  notFound?: boolean;
  subtitle: string;
};

const NodeDetailsPageLayout: React.FC<NodePageLayoutProps> = ({
  activeTab,
  children,
  isWalletConnected,
  loading,
  nodeId,
  notFound,
  subtitle,
}) => {
  if (loading) {
    return (
      <Container className="pageRoot">
        <SectionTitle
          moreReadable
          title="Node details"
          subTitle={
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Retrieving node details...</span>
            </div>
          }
        />
      </Container>
    );
  }

  if (notFound) {
    return (
      <Container className="pageRoot">
        <SectionTitle moreReadable title="Node details" subTitle="Node not found" />
      </Container>
    );
  }

  const tabs: { key: TabKey; label: string; href: string }[] = [
    { key: 'info', label: 'Node info', href: `/nodes/${nodeId}` },
    { key: 'storage' as TabKey, label: 'Remote storage', href: `/nodes/${nodeId}/storage` },
  ];

  return (
    <Container className="pageRoot">
      <SectionTitle
        contentBetween={isWalletConnected ? <TabBar activeKey={activeTab} tabs={tabs} /> : null}
        moreReadable
        subTitle={subtitle}
        title="Node details"
      />
      <div className="pageContentWrapper">{children}</div>
    </Container>
  );
};

export default NodeDetailsPageLayout;
