import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './settings-section.module.css';

type SettingsSectionProps = {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: ReactNode;
  title: ReactNode;
};

const SettingsSection = ({ children, className, description, icon, title }: SettingsSectionProps) => (
  <div className={cx(styles.root, className)}>
    <div className={styles.header}>
      <span aria-hidden className={styles.icon}>
        {icon}
      </span>
      <div className={styles.text}>
        <h4 className={styles.title}>{title}</h4>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </div>
    {children && <div className={styles.content}>{children}</div>}
  </div>
);

export default SettingsSection;
