import cx from 'classnames';
import Link from 'next/link';
import { MouseEventHandler, ReactNode } from 'react';
import { ButtonStyle } from './butoon-style.enum';
import styles from './button.module.css';

interface ButtonProps {
  children?: ReactNode;
  className?: string;
  href?: string;
  target?: '_blank' | '_self';
  style?: ButtonStyle;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const Button = ({ className, href, target, children, style, onClick }: ButtonProps) => {
  const classes = cx(styles.root, className, style === ButtonStyle.PRIMARY && styles.primary);

  if (href) {
    return (
      <Link href={href} className={classes} target={target}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
