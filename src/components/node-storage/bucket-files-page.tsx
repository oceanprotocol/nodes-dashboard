import Container from '@/components/container/container';
import BucketFiles from '@/components/node-storage/bucket-files';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';
import { CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

const BucketFilesPage: React.FC = () => {
  const params = useParams<{ nodeId: string; bucketId: string }>();
  const nodeId = params?.nodeId;
  const bucketId = params?.bucketId;

  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();

  const node = useMemo(() => {
    if (nodeId === selectedNode?.id || nodeId === selectedNode?.nodeId) {
      return selectedNode;
    }
    return null;
  }, [nodeId, selectedNode]);

  useEffect(() => {
    if (!node && nodeId) {
      fetchNode(nodeId);
    }
  }, [nodeId, fetchNode, node]);

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
        {node && bucketId ? <BucketFiles bucketId={bucketId} node={node} /> : null}
      </div>
    </Container>
  );
};

export default BucketFilesPage;
