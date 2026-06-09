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
import { toast } from 'react-toastify';
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
    () => account.address && node.allowedAdmins?.includes(account.address),
    [node.allowedAdmins, account]
  );

  const { buttonDisabled, disabledReason } = useMemo(() => {
    const isPermanentBan = node.banned && node.permanent;
    const inFlight = unbanRequests.some(
      (r) => r.status === 'pending' || r.status === 'running'
    );
    return {
      buttonDisabled: loading || inFlight || isPermanentBan,
      disabledReason: isPermanentBan
        ? 'This node is permanently banned and cannot be unbanned.'
        : inFlight
          ? 'An unban request is already in progress for this node. Please wait for it to finish.'
          : null,
    };
  }, [unbanRequests, loading, node.banned, node.permanent]);

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
      const result = await requestNodeUnban(node.id, signedMessage as string, timestamp, account.address as string);
      if (result.success) {
        toast.success(result.message ?? 'Unban request submitted');
        await fetchUnbanRequests(node.id);
      } else {
        toast.error(result.message ?? 'Failed to request unban');
      }
    } catch (error) {
      console.error('Error requesting unban:', error);
      const message = error instanceof Error ? error.message : 'Failed to request unban';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Unban requests</h3>
        {isAdmin && (
          <Button
            color="accent1"
            disabled={buttonDisabled}
            loading={loading}
            onClick={handleRequestUnban}
          >
            {loading ? 'Requesting...' : 'Request unban'}
          </Button>
        )}
      </div>
      {isAdmin && disabledReason && (
        <p className={styles.disabledReason}>{disabledReason}</p>
      )}
      {unbanRequests.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No unban history</p>
      ) : (
        <Table<UnbanRequest> data={unbanRequests} getRowId={(row) => row.requestId} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
      )}
    </Card>
  );
};

export default UnbanRequests;
