import classNames from 'classnames';
import Link from 'next/link';
import { MouseEventHandler, ReactNode } from 'react';
import styles from './button.module.css';

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  color?: 'accent1' | 'accent2' | 'primary';
  contentAfter?: React.ReactNode;
  contentBefore?: React.ReactNode;
  href?: string;
  id?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  target?: '_blank' | '_self';
  size?: 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  variant?: 'filled' | 'outlined';
};

const Button = ({
  children,
  className,
  color = 'primary',
  contentAfter,
  contentBefore,
  href,
  id,
  onClick,
  target,
  size = 'md',
  type = 'button',
  variant = 'filled',
}: ButtonProps) => {
  const classes = classNames(
    styles.root,
    styles[`color-${color}`],
    styles[`size-${size}`],
    styles[`variant-${variant}`],
    className
  );

  if (href) {
    return (
      <Link className={classes} href={href} id={id} target={target}>
        {contentBefore}
        {children}
        {contentAfter}
      </Link>
    );
  }

  return (
    <button className={classes} id={id} onClick={onClick} type={type}>
      {contentBefore}
      {children}
      {contentAfter}
    </button>
  );
};

export default Button;
