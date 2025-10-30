import cx from 'classnames';
import Link from 'next/link';
import { ReactNode } from 'react';
import styles from './button.module.css';

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  color?: 'accent1' | 'accent2' | 'primary';
  href?: string;
  onClick?: (e: any) => any;
  target?: '_blank' | '_self';
  size?: 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  variant?: 'filled' | 'outlined';
};

const Button = ({
  children,
  className,
  color = 'primary',
  href,
  onClick,
  target,
  size = 'md',
  type = 'button',
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

  return (
    <button className={classes} onClick={onClick} type={type}>
      {children}
    </button>
  );
};

export default Button;
