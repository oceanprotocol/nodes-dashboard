import { isInferenceNode } from '@/constants/nodes';
import { useIsNodeSubsidized } from '@/lib/use-subsidy';
import { Tooltip } from '@mui/material';
import classNames from 'classnames';
import styles from './subsidy.module.css';

type SubsidizedNodeChipProps = {
  nodeAddress: string | undefined;
  peerId: string | undefined;
};

const SubsidizedNodeChip = ({ nodeAddress, peerId }: SubsidizedNodeChipProps) => {
  const { data: isSubsidized } = useIsNodeSubsidized(isInferenceNode(peerId) ? nodeAddress : undefined);

  if (!isSubsidized) {
    return null;
  }

  return (
    <Tooltip title="The OPF subsidy applies to jobs and models on this node">
      <span className={classNames('chip', 'chipAccent2', styles.subsidizedChip)} tabIndex={0}>
        Subsidized
      </span>
    </Tooltip>
  );
};

export default SubsidizedNodeChip;
