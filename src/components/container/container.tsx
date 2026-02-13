import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './container.module.css';

const Container = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cx(styles.root, className)}>{children}</div>;
};

export default Container;
