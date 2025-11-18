import { useNodesContext } from '@/context/nodes-context';
import { Node } from '@/types/nodes';
import { useRouter } from 'next/router';
import Button from './button';

type InfoButtonProps = {
  node: Node;
};

const InfoButton = ({ node }: InfoButtonProps) => {
  const { setSelectedNode } = useNodesContext();
  const router = useRouter();

  const handleClick = () => {
    setSelectedNode(node);
    router.push(`/nodes/${node.id || node.node_id}`);
  };

  return (
    <Button color="accent1" variant="outlined" onClick={handleClick}>
      Info
    </Button>
  );
};

export default InfoButton;
