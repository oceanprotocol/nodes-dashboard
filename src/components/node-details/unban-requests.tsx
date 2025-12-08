import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { CHAIN_ID } from '@/constants/chains';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { Node } from '@/types';
import { UnbanRequest } from '@/types/unban-requests';
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider, Eip1193Provider, type Provider } from 'ethers';
import { useEffect, useState } from 'react';
import styles from './unban-requests.module.css';

type UnbanRequestsProps = {
  node: Node;
};

const UnbanRequests = ({ node }: UnbanRequestsProps) => {
  const { unbanRequests, fetchUnbanRequests, requestNodeUnban } = useUnbanRequestsContext();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('eip155');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node?.id) {
      fetchUnbanRequests(node.id);
    }
  }, [node?.id, fetchUnbanRequests]);

  const handleRequestUnban = async () => {
    if (!isConnected) {
      open();
      return;
    }

    if (!walletProvider) {
      console.error('No wallet provider found');
      return;
    }

    if (!node?.id) {
      console.error('No node ID found');
      return;
    }

    setLoading(true);
    try {
      const provider = new BrowserProvider(walletProvider as unknown as Eip1193Provider, CHAIN_ID);
      const signer = await provider.getSigner();
      const timestamp = Date.now();
      const signature = await signer.signMessage(timestamp.toString());

      await requestNodeUnban(node.id, signature, timestamp);
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
        <Button color="accent1" disabled={loading} onClick={handleRequestUnban}>
          {loading ? 'Requesting...' : 'Request unban'}
        </Button>
      </div>
      <Table<UnbanRequest> data={unbanRequests} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
    </Card>
  );
};

export default UnbanRequests;
