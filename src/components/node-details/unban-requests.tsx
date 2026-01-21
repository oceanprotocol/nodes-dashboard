import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import { UnbanRequest } from '@/types/unban-requests';
import { useAuthModal } from '@account-kit/react';
import { useEffect, useMemo, useState } from 'react';
import styles from './unban-requests.module.css';

type UnbanRequestsProps = {
  node: Node;
};

const UnbanRequests = ({ node }: UnbanRequestsProps) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();

  const { account, ocean, signMessage } = useOceanAccount();

  const { unbanRequests, fetchUnbanRequests, requestNodeUnban } = useUnbanRequestsContext();

  const [loading, setLoading] = useState(false);

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  const isAdmin = useMemo(
    () => node.allowedAdmins?.includes(account?.address as string),
    [node.allowedAdmins, account]
  );

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
      const signedMessage = await signMessage(timestamp.toString());

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
        {isAdmin && (
          <Button color="accent1" loading={loading} onClick={handleRequestUnban}>
            {loading ? 'Requesting...' : 'Request unban'}
          </Button>
        )}
      </div>
      <Table<UnbanRequest> data={unbanRequests} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
    </Card>
  );
};

export default UnbanRequests;
