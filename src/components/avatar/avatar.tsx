import { toDataUrl } from 'myetherwallet-blockies';

import Image from 'next/image';
import styles from './avatar.module.css';

export interface AvatarProps {
  accountId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | number;
  src?: string;
}

const Avatar = ({ accountId, className, size = 'md', src }: AvatarProps) => {
  const getSize = () => {
    switch (size) {
      case 'sm':
        return 18;
      case 'md':
        return 32;
      case 'lg':
        return 64;
      default:
        return size;
    }
  };

  return (
    <Image
      className={`${className || ''} ${styles.avatar} `}
      src={src || (accountId ? toDataUrl(accountId) : '')}
      alt="Avatar"
      aria-hidden="true"
      width={getSize()}
      height={getSize()}
    />
  );
};

export default Avatar;
