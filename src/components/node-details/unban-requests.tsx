import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import { UnbanRequest } from '@/types/unban-requests';
import { useAuthModal, useSignMessage, useSmartAccountClient } from '@account-kit/react';
import { useEffect, useState } from 'react';
import styles from './unban-requests.module.css';

type UnbanRequestsProps = {
  node: Node;
};

const UnbanRequests = ({ node }: UnbanRequestsProps) => {
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });

  const { openAuthModal } = useAuthModal();

  const { account, ocean } = useOceanAccount();

  const { unbanRequests, fetchUnbanRequests, requestNodeUnban } = useUnbanRequestsContext();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node?.id) {
      fetchUnbanRequests(node.id);
    }
  }, [node?.id, fetchUnbanRequests]);

  const handleRequestUnban = async () => {
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    setLoading(true);
    try {
      const timestamp = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
      const signedMessage = await signMessageAsync({
        message: timestamp.toString(),
      });

      await requestNodeUnban(node.id, signedMessage as string, timestamp, account.address as string);
      await fetchUnbanRequests(node.id);
    } catch (error) {
      console.error('Error requesting unban:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Unban requests</h3>
        <Button color="accent1" loading={loading} onClick={handleRequestUnban}>
          {loading ? 'Requesting...' : 'Request unban'}
        </Button>
      </div>
      <Table<UnbanRequest> data={unbanRequests} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
    </Card>
  );
};

export default UnbanRequests;
