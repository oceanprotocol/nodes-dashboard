import cx from 'classnames';
import Link from 'next/link';
import { ReactNode } from 'react';
import styles from './button.module.css';

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  color?: 'accent1' | 'accent2' | 'primary';
  href?: string;
  target?: '_blank' | '_self';
  size?: 'md' | 'lg';
  variant?: 'filled' | 'outlined';
};

const Button = ({
  className,
  color = 'primary',
  href,
  target,
  children,
  size = 'md',
  variant = 'filled',
}: ButtonProps) => {
  const classes = cx(
    styles.root,
    styles[`color-${color}`],
    styles[`size-${size}`],
    styles[`variant-${variant}`],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes} target={target}>
        {children}
      </Link>
    );
  }

  return <button className={classes}>{children}</button>;
};

export default Button;
