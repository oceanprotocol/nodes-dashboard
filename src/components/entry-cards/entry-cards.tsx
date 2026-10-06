import Card from '@/components/card/card';
import classNames from 'classnames';
import { ReactNode, useEffect, useRef, useState } from 'react';
import styles from './entry-cards.module.css';

type EntryCardsLayoutProps = {
  children: ReactNode;
  featured: ReactNode;
};

export const EntryCardsLayout: React.FC<EntryCardsLayoutProps> = ({ children, featured }) => (
  <div className={styles.layout}>
    {featured}
    <div className={styles.side}>{children}</div>
  </div>
);

const BACKDROP_CYCLE_MS = 6000;
const PAN_RATIO_TOLERANCE = 0.05;

export type BackdropMedia = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  width: number;
  height: number;
};

/**
 * Plays from the start while active. With `onEnded` it plays once and reports the end, or reports right
 * away when it can't play; without, it loops.
 */
const BackdropVideo: React.FC<{ active: boolean; className?: string; media: BackdropMedia; onEnded?: () => void }> = ({
  active,
  className,
  media,
  onEnded,
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }
    if (!active) {
      video.pause();
      video.currentTime = 0;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    video.play().catch(() => onEndedRef.current?.());
  }, [active]);

  return (
    <video
      className={className}
      loop={!onEnded}
      muted
      onEnded={() => onEndedRef.current?.()}
      onError={() => {
        if (active) {
          onEndedRef.current?.();
        }
      }}
      playsInline
      poster={media.poster}
      preload="metadata"
      ref={ref}
      src={media.src.includes('#') ? media.src : `${media.src}#t=0.001`}
    />
  );
};

const FeaturedBackdrop: React.FC<{ media: BackdropMedia[] }> = ({ media }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);

  const next = () => {
    setActive((current) => (current + 1) % media.length);
  };

  // A video holds the backdrop until it has played to the end (see BackdropVideo).
  const activeIsVideo = media[active]?.type === 'video';
  useEffect(() => {
    if (activeIsVideo || media.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % media.length);
    }, BACKDROP_CYCLE_MS);
    return () => window.clearTimeout(timer);
  }, [active, activeIsVideo, media.length]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) {
        setBoxRatio(entry.contentRect.width / entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const panClass = (image: BackdropMedia, index: number) => {
    if (!boxRatio) {
      return undefined;
    }
    const ratio = image.width / image.height;
    if (Math.abs(ratio - boxRatio) / boxRatio < PAN_RATIO_TOLERANCE) {
      return undefined;
    }
    if (ratio < boxRatio) {
      return styles.panDown;
    }
    return index % 2 === 0 ? styles.panLtr : styles.panRtl;
  };

  return (
    <div aria-hidden className={styles.featuredBackdrop} ref={ref}>
      {media.map((item, index) =>
        item.type === 'video' ? (
          <BackdropVideo
            active={index === active}
            className={classNames(styles.featuredImage, styles.featuredVideo, {
              [styles.featuredImageActive]: index === active,
            })}
            key={item.src}
            media={item}
            onEnded={media.length > 1 ? next : undefined}
          />
        ) : (
          <div
            className={classNames(styles.featuredImage, panClass(item, index), {
              [styles.featuredImageActive]: index === active,
            })}
            key={item.src}
            style={{ backgroundImage: `url(${item.src})` }}
          />
        )
      )}
    </div>
  );
};

type FeaturedEntryCardProps = {
  actions: ReactNode;
  backgroundMedia?: BackdropMedia[];
  badge?: string;
  description: string;
  icon: ReactNode;
  title: string;
};

export const FeaturedEntryCard: React.FC<FeaturedEntryCardProps> = ({
  actions,
  backgroundMedia,
  badge,
  description,
  icon,
  title,
}) => (
  <Card className={styles.featured} direction="column" padding="md" radius="lg" shadow="accent1">
    {backgroundMedia?.length ? (
      <FeaturedBackdrop media={backgroundMedia} />
    ) : (
      <div aria-hidden className={styles.featuredPattern} />
    )}
    <div className={styles.featuredIcon}>{icon}</div>
    <div className={styles.featuredBody}>
      <h3 className={styles.featuredTitle}>{title}</h3>
      <p className={styles.featuredDescription}>{description}</p>
    </div>
    <div className={styles.featuredFooter}>
      {badge ? <span className={styles.badge}>{badge}</span> : <span />}
      <div className={styles.featuredActions}>{actions}</div>
    </div>
  </Card>
);

type EntryCardProps = {
  actions: ReactNode;
  children?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
};

export const EntryCard: React.FC<EntryCardProps> = ({ actions, children, description, icon, title }) => (
  <Card className={styles.card} direction="column" padding="sm" radius="lg" shadow="black" variant="glass-shaded">
    <div className={styles.cardHead}>
      <div className={styles.iconBox}>{icon}</div>
      <h3 className={styles.cardTitle}>{title}</h3>
    </div>
    <p className={styles.cardDescription}>{description}</p>
    {children}
    <div className={styles.cardActions}>{actions}</div>
  </Card>
);
