import AmdLogo from '@/assets/icons/gpu-manufacturers/amd.svg';
import IntelLogo from '@/assets/icons/gpu-manufacturers/intel.svg';
import NvidiaLogo from '@/assets/icons/gpu-manufacturers/nvidia.svg';
import GpuIcon from '@/assets/icons/gpu.svg';
import { formatHardwareName, type HardwareType } from '@/utils/formatters';
import MemoryIcon from '@mui/icons-material/Memory';
import classNames from 'classnames';
import styles from './hardware-label.module.css';

type HardwareLabelProps = {
  className?: string;
  iconHeight?: number;
  // When true, keep the full name (incl. vendor) instead of stripping it in favor of the logo.
  showBrandName?: boolean;
  type: HardwareType;
  value?: string;
};

// Renders a hardware brand as a logo (Nvidia/AMD/Intel) with the model info kept next to it
// (e.g. "H200", "Xeon Platinum 8480+"). Handles both GPUs and CPUs via `type`.
const HardwareLabel = ({ className, iconHeight = 14, showBrandName, type, value }: HardwareLabelProps) => {
  // GPU labels historically render nothing when empty (used inline in table cells); keep that.
  if (type === 'gpu' && !value) {
    return null;
  }

  const description = value?.trim() ?? '';
  const lowercase = description.toLowerCase();
  const iconProps = {
    className: styles.icon,
    style: { height: `${iconHeight}px` },
  };

  const getLogo = () => {
    if (lowercase.startsWith('nvidia')) {
      return <NvidiaLogo {...iconProps} />;
    }
    if (
      lowercase.startsWith('amd') ||
      lowercase.startsWith('advanced micro devices') ||
      lowercase.startsWith('radeon') ||
      lowercase.includes('ryzen') ||
      lowercase.includes('epyc')
    ) {
      return <AmdLogo {...iconProps} />;
    }
    if (lowercase.includes('intel')) {
      return <IntelLogo {...iconProps} />;
    }
    // No known brand: GPUs fall back to a generic GPU glyph, CPUs to a memory/chip glyph.
    return type === 'cpu' ? (
      <MemoryIcon
        className={styles.icon}
        style={{ color: 'var(--accent1)', fontSize: `${iconHeight}px`, height: `${iconHeight}px` }}
      />
    ) : (
      <GpuIcon {...iconProps} />
    );
  };

  const label = showBrandName ? description : description ? formatHardwareName(description, type) : type.toUpperCase();

  return (
    <div className={classNames(styles.root, className)}>
      {getLogo()}
      {label}
    </div>
  );
};

export default HardwareLabel;
