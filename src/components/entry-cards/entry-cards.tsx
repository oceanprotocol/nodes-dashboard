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

export type BackdropImage = {
  src: string;
  width: number;
  height: number;
};

const FeaturedBackdrop: React.FC<{ images: BackdropImage[] }> = ({ images }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);

  useEffect(() => {
    if (images.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, BACKDROP_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [images.length]);

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

  const panClass = (image: BackdropImage, index: number) => {
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
      {images.map((image, index) => (
        <div
          className={classNames(styles.featuredImage, panClass(image, index), {
            [styles.featuredImageActive]: index === active,
          })}
          key={image.src}
          style={{ backgroundImage: `url(${image.src})` }}
        />
      ))}
    </div>
  );
};

type FeaturedEntryCardProps = {
  actions: ReactNode;
  backgroundImages?: BackdropImage[];
  badge?: string;
  description: string;
  icon: ReactNode;
  title: string;
};

export const FeaturedEntryCard: React.FC<FeaturedEntryCardProps> = ({
  actions,
  backgroundImages,
  badge,
  description,
  icon,
  title,
}) => (
  <Card className={styles.featured} direction="column" padding="md" radius="lg" shadow="accent1">
    {backgroundImages?.length ? (
      <FeaturedBackdrop images={backgroundImages} />
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
