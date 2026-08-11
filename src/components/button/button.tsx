import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import Link from 'next/link';
import { forwardRef, MouseEventHandler, ReactNode, useState } from 'react';
import styles from './button.module.css';

export type ButtonProps = {
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'dialog' | 'menu';
  autoLoading?: boolean;
  children?: ReactNode;
  className?: string;
  color?: 'accent1' | 'accent2' | 'error' | 'primary' | 'primary-inverse';
  contentAfter?: React.ReactNode;
  contentBefore?: React.ReactNode;
  disabled?: boolean;
  href?: string;
  id?: string;
  /** Loading state; Shows spinner inside the button and disables it */
  loading?: boolean;
  /** Fires on both render paths: the `<button>`, and the `<Link>` when `href` is set. */
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  target?: '_blank' | '_self';
  size?: 'link' | 'xs' | 'sm' | 'sm-const' | 'md' | 'md-const' | 'lg' | 'lg-const';
  type?: 'button' | 'submit' | 'reset';
  variant?: 'filled' | 'glass' | 'outlined' | 'transparent';
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      'aria-controls': ariaControls,
      'aria-expanded': ariaExpanded,
      'aria-haspopup': ariaHasPopup,
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
    },
    ref
  ) => {
    const [innerLoading, setInnerLoading] = useState(false);

    const isLoading = loading || innerLoading;
    const isDisabled = disabled || isLoading;

    const classes = classNames(
      styles.root,
      styles[`color-${color}`],
      styles[`size-${size}`],
      styles[`variant-${variant}`],
      { [styles.disabled]: isDisabled },
      className
    );

    const spinner = isLoading ? (
      <CircularProgress
        color="inherit"
        size={{ link: 12, xs: 12, sm: 14, 'sm-const': 14, md: 16, 'md-const': 16, lg: 20, 'lg-const': 20 }[size]}
      />
    ) : null;

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
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
        <Link
          className={classes}
          href={isDisabled ? '' : href}
          id={id}
          onClick={onClick}
          target={target}
        >
          {spinner}
          {contentBefore}
          {children}
          {contentAfter}
        </Link>
      );
    }

    return (
      <button
        aria-controls={ariaControls}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHasPopup}
        className={classes}
        disabled={isDisabled}
        id={id}
        onClick={handleClick}
        ref={ref}
        type={type}
      >
        {spinner}
        {contentBefore}
        {children}
        {contentAfter}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
