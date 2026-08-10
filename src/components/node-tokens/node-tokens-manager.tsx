'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GenerateTokenModal from '@/components/node-tokens/generate-token-modal';
import NodeTokens from '@/components/node-tokens/node-tokens';
import { useNodeTokensContext } from '@/context/node-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { revokeAuthToken } from '@/services/nodeService';
import { NodeToken } from '@/types/node-tokens';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './node-tokens-manager.module.css';

const NodeTokensManager: React.FC = () => {
  const { account, signMessage } = useOceanAccount();

  const { nodeTokens, removeNodeToken } = useNodeTokensContext();
  const nodeIds = useMemo(() => Object.keys(nodeTokens).filter((id) => nodeTokens[id]?.length > 0), [nodeTokens]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  function toggleExpanded(nodeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  const handleRemoveToken = async (nodeToken: NodeToken) => {
    if (account.address) {
      try {
        const { success } = await revokeAuthToken({
          consumerAddress: account.address,
          nodeUri: nodeToken.nodeUri,
          signMessage,
          token: nodeToken.token,
        });
        if (!success) {
          throw new Error('Failed to invalidate token');
        }
        removeNodeToken(nodeToken);
        toast.success('Token revoked successfully');
      } catch (e) {
        const errorMessage = e instanceof Error && e.message ? e.message : 'Failed to invalidate token';
        toast.error(errorMessage);
      }
    }
  };

  return (
    <>
      <GenerateTokenModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <Card direction="column" padding="md" radius="md" shadow="black" spacing="sm" variant="glass-shaded">
        <div className={styles.cardHeader}>
          <h3>Auth tokens</h3>
          <Button color="accent1" contentBefore={<AddIcon />} onClick={() => setModalOpen(true)} size="md">
            Add
          </Button>
        </div>
        {nodeIds.length === 0 ? (
          <span className="textSecondary">No auth tokens yet.</span>
        ) : (
          <div className={styles.listItems}>
            {nodeIds.map((nodeId) => {
              const isOpen = expanded.has(nodeId);
              const tokens = nodeTokens[nodeId];
              const tokenCount = tokens?.length ?? 0;
              const nodeFriendlyName = tokens?.[0].friendlyNodeName;
              return (
                <div className={styles.nodeSection} key={nodeId}>
                  <button
                    aria-expanded={isOpen}
                    className={styles.sectionHeader}
                    onClick={() => toggleExpanded(nodeId)}
                    type="button"
                  >
                    <ExpandMoreIcon
                      className={styles.expandIcon}
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                    <div className={styles.nodeIdentity}>
                      {nodeFriendlyName && <span className={styles.nodeName}>{nodeFriendlyName}</span>}
                      <span className={styles.peerId} title={nodeId}>
                        {nodeId}
                      </span>
                    </div>
                    <span className={classNames('chip chipPrimaryOutlined', styles.tokenCount)}>
                      {tokenCount} token{tokenCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <Collapse in={isOpen} mountOnEnter>
                    <div className={styles.sectionBody}>
                      <NodeTokens nodeId={nodeId} tokens={tokens} onRemove={handleRemoveToken} />
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
};

export default NodeTokensManager;
