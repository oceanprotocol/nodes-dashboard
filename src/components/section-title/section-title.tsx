import cx from 'classnames';
import React from 'react';
import styles from './section-title.module.css';

type SectionTitleProps = {
  title: string;
  subTitle?: string;
  className?: string;
  contentBetween?: React.ReactNode;
  moreReadable?: boolean;
  subTitleClassName?: string;
  titleClassName?: string;
};

const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subTitle,
  className,
  contentBetween,
  moreReadable,
  subTitleClassName,
  titleClassName,
}) => {
  return (
    <div className={cx(styles.root, { [styles.moreReadable]: moreReadable }, className)}>
      <h2 className={cx('textAccent1', styles.title, titleClassName)}>{title}</h2>
      {contentBetween}
      {subTitle && <p className={cx(styles.subTitle, subTitleClassName)}>{subTitle}</p>}
    </div>
  );
};

export default SectionTitle;
