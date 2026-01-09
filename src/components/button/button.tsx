import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import Link from 'next/link';
import { MouseEventHandler, ReactNode, useState } from 'react';
import styles from './button.module.css';

export type ButtonProps = {
  autoLoading?: boolean;
  children?: ReactNode;
  className?: string;
  color?: 'accent1' | 'accent2' | 'error' | 'primary';
  contentAfter?: React.ReactNode;
  contentBefore?: React.ReactNode;
  disabled?: boolean;
  href?: string;
  id?: string;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  target?: '_blank' | '_self';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  variant?: 'filled' | 'outlined';
};

const Button = ({
  autoLoading,
  children,
  className,
  color = 'primary',
  contentAfter,
  contentBefore,
  disabled,
  href,
  id,
  loading,
  onClick,
  target,
  size = 'md',
  type = 'button',
  variant = 'filled',
}: ButtonProps) => {
  const [innerLoading, setInnerLoading] = useState(false);

  const classes = classNames(
    styles.root,
    styles[`color-${color}`],
    styles[`size-${size}`],
    styles[`variant-${variant}`],
    className
  );

  const isLoading = loading || innerLoading;
  const isDisabled = disabled || isLoading;

  const spinner = isLoading ? <CircularProgress color="inherit" size={{ sm: 14, md: 16, lg: 20 }[size]} /> : null;

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      if (autoLoading) {
        setInnerLoading(true);
        await onClick(event);
        setInnerLoading(false);
      } else {
        onClick(event);
      }
    }
  };

  if (href) {
    return (
      <Link className={classes} href={isDisabled ? '' : href} id={id} target={target}>
        {spinner}
        {contentBefore}
        {children}
        {contentAfter}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={isDisabled} id={id} onClick={handleClick} type={type}>
      {spinner}
      {contentBefore}
      {children}
      {contentAfter}
    </button>
  );
};

export default Button;
