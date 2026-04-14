import Card from '@/components/card/card';
import useMobile from '@/hooks/use-mobile';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import cx from 'classnames';
import React from 'react';
import styles from './section-title.module.css';

const DEFAULT_MOBILE_WARNING = 'This flow requires a desktop environment.\nSome steps may not work on mobile devices.';

type SectionTitleProps = {
  title: string;
  subTitle?: React.ReactNode;
  className?: string;
  contentBetween?: React.ReactNode;
  mobileWarning?: boolean;
  mobileWarningMessage?: string;
  moreReadable?: boolean;
  subTitleClassName?: string;
  titleClassName?: string;
};

const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subTitle,
  className,
  contentBetween,
  mobileWarning,
  mobileWarningMessage,
  moreReadable,
  subTitleClassName,
  titleClassName,
}) => {
  const isMobile = useMobile();

  return (
    <div className={cx(styles.root, { [styles.moreReadable]: moreReadable }, className)}>
      <h2 className={cx('textAccent1', styles.title, titleClassName)}>{title}</h2>
      {contentBetween}
      {subTitle && <p className={cx(styles.subTitle, subTitleClassName)}>{subTitle}</p>}
      {isMobile && mobileWarning ? (
        <Card padding="sm" radius="sm" className={styles.mobileBanner} variant="warning">
          <ErrorOutlinedIcon className={styles.mobileBannerIcon} />
          <span>{mobileWarningMessage ?? DEFAULT_MOBILE_WARNING}</span>
        </Card>
      ) : null}
    </div>
  );
};

export default SectionTitle;
