import Container from '@/components/container/container';
import BucketFiles from '@/components/node-storage/bucket-files';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';
import { peerIdToStorageNode, toStorageNode } from '@/utils/node-storage';
import { CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const BucketFilesPage: React.FC = () => {
  const params = useParams<{ nodeId: string; bucketId: string }>();
  const nodeId = params?.nodeId;
  const bucketId = params?.bucketId;

  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();

  const [lookedUp, setLookedUp] = useState(false);

  const node = useMemo(() => {
    if (nodeId === selectedNode?.id || nodeId === selectedNode?.nodeId) {
      return selectedNode;
    }
    return null;
  }, [nodeId, selectedNode]);

  useEffect(() => {
    if (!nodeId) {
      return;
    }
    if (node) {
      setLookedUp(true);
      return;
    }
    fetchNode(nodeId).finally(() => setLookedUp(true));
  }, [nodeId, fetchNode, node]);

  // A bucket can live on a node the index doesn't know about — the user reached it by peer ID — so
  // once the lookup is done, fall back to talking to the peer ID directly.
  const storageNode = useMemo(() => {
    if (node) {
      return toStorageNode(node);
    }
    if (nodeId && lookedUp) {
      return peerIdToStorageNode(nodeId);
    }
    return null;
  }, [lookedUp, node, nodeId]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        subTitle={
          loadingFetchNode ? (
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Retrieving node details...</span>
            </div>
          ) : null
        }
        title="Bucket files"
      />
      <div className="pageContentWrapper">
        {storageNode && bucketId ? <BucketFiles bucketId={bucketId} node={storageNode} /> : null}
      </div>
    </Container>
  );
};

export default BucketFilesPage;
