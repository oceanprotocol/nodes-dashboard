import AmdLogo from '@/assets/icons/gpu-manufacturers/amd.svg';
import IntelLogo from '@/assets/icons/gpu-manufacturers/intel.svg';
import NvidiaLogo from '@/assets/icons/gpu-manufacturers/nvidia.svg';
import GpuIcon from '@/assets/icons/gpu.svg';
import classNames from 'classnames';
import { useMemo } from 'react';
import styles from './gpu-label.module.css';

type GpuLabelProps = {
  className?: string;
  gpu?: string;
  iconHeight?: number;
  showBrandName?: boolean;
};

const GpuLabel = ({ className, gpu, iconHeight = 14, showBrandName }: GpuLabelProps) => {
  const formattedGpuName = useMemo(() => {
    if (!gpu) {
      return '';
    }
    if (showBrandName) {
      return gpu.trim();
    }
    const branding = ['nvidia', 'corporation', 'amd', 'advanced', 'micro', 'devices', 'inc', 'intel'];
    const filteredGpu = gpu
      .split(/[\s,\.]+/)
      .filter((word) => !branding.includes(word.toLowerCase()))
      .join(' ');
    return filteredGpu.trim();
  }, [gpu, showBrandName]);

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
    if (
      lowercaseGpu.startsWith('amd') ||
      lowercaseGpu.startsWith('advanced micro devices') ||
      lowercaseGpu.startsWith('radeon')
    ) {
      return <AmdLogo {...iconProps} />;
    }
    if (lowercaseGpu.startsWith('intel')) {
      return <IntelLogo {...iconProps} />;
    }
    return <GpuIcon {...iconProps} />;
  };

  return (
    <div className={classNames(styles.root, className)}>
      {getLogo()}
      {formattedGpuName}
    </div>
  );
};

export default GpuLabel;
