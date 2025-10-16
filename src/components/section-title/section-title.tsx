import cx from 'classnames';
import styles from './section-title.module.css';

const SectionTitle = ({ title, subTitle, className }: { title: string; subTitle?: string; className?: string }) => {
  return (
    <div className={cx(styles.root, className)}>
      <h2 className={styles.title}>{title}</h2>
      {subTitle && <p className={styles.subTitle}>{subTitle}</p>}
    </div>
  );
};

export default SectionTitle;
