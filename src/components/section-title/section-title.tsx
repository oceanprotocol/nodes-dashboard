import cx from 'classnames';
import styles from './section-title.module.css';

type SectionTitleProps = {
  title: string;
  subTitle?: string;
  className?: string;
  contentBetween?: React.ReactNode;
};

const SectionTitle = ({ title, subTitle, className, contentBetween }: SectionTitleProps) => {
  return (
    <div className={cx(styles.root, className)}>
      <h2 className={styles.title}>{title}</h2>
      {contentBetween}
      {subTitle && <p className={styles.subTitle}>{subTitle}</p>}
    </div>
  );
};

export default SectionTitle;
