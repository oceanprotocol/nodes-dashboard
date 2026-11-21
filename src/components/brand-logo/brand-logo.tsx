import Logo from '@/assets/logo.svg';
import classNames from 'classnames';
import Link from 'next/link';
import styles from './brand-logo.module.css';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

const BrandLogo = ({ className, compact }: BrandLogoProps) => (
  <div className={classNames(styles.root, className)}>
    <div aria-hidden className={styles.halo} />
    <Link aria-label="Home" href="/">
      <Logo className={classNames(styles.logo, { [styles.compact]: compact })} preserveAspectRatio="xMidYMin slice" />
    </Link>
    <div className={classNames('chip', 'chipAccent2', styles.beta)}>BETA</div>
  </div>
);

export default BrandLogo;
