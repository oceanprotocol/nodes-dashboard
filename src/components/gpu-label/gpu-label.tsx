import AmdLogo from '@/assets/icons/gpu-manufacturers/amd.svg';
import IntelLogo from '@/assets/icons/gpu-manufacturers/intel.svg';
import NvidiaLogo from '@/assets/icons/gpu-manufacturers/nvidia.svg';
import classNames from 'classnames';
import styles from './gpu-label.module.css';

type GpuLabelProps = {
  className?: string;
  gpu?: string;
  iconHeight?: number;
};

const GpuLabel = ({ className, gpu, iconHeight = 14 }: GpuLabelProps) => {
  if (!gpu) {
    return null;
  }

  const getLogo = () => {
    const lowercaseGpu = gpu.toLowerCase();

    const iconProps = {
      className: styles.icon,
      style: { height: `${iconHeight}px` },
    };

    if (lowercaseGpu.startsWith('nvidia')) {
      return <NvidiaLogo {...iconProps} />;
    }
    if (lowercaseGpu.startsWith('amd')) {
      return <AmdLogo {...iconProps} />;
    }
    if (lowercaseGpu.startsWith('intel')) {
      return <IntelLogo {...iconProps} />;
    }
    return null;
  };

  return (
    <div className={classNames(styles.root, className)}>
      {getLogo()}
      {gpu}
    </div>
  );
};

export default GpuLabel;
