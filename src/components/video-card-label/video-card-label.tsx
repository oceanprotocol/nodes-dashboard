import AmdLogo from '@/assets/icons/gpu-manufacturers/amd.svg';
import IntelLogo from '@/assets/icons/gpu-manufacturers/intel.svg';
import NvidiaLogo from '@/assets/icons/gpu-manufacturers/nvidia.svg';
import classNames from 'classnames';
import styles from './video-card-label.module.css';

type VideoCardLabelProps = {
  card: string;
  className?: string;
  iconHeight?: number;
};

const VideoCardLabel = ({ card, className, iconHeight = 14 }: VideoCardLabelProps) => {
  const getLogo = () => {
    const lowercaseCard = card.toLowerCase();
    if (lowercaseCard.startsWith('nvidia')) {
      return <NvidiaLogo height={iconHeight} width="auto" />;
    }
    if (lowercaseCard.startsWith('amd')) {
      return <AmdLogo height={iconHeight} width="auto" />;
    }
    if (lowercaseCard.startsWith('intel')) {
      return <IntelLogo height={iconHeight} width="auto" />;
    }
    return null;
  };

  return (
    <div className={classNames(styles.root, className)}>
      {getLogo()}
      {card}
    </div>
  );
};

export default VideoCardLabel;
