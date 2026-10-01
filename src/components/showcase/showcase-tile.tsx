import { templateLogoForName, templateLogoSrc } from '@/components/inference/template-logos';
import { ShowcaseItem } from '@/types/showcase';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import classNames from 'classnames';
import Image from 'next/image';
import Link from 'next/link';
import { CSSProperties, useEffect, useRef } from 'react';
import styles from './showcase-tile.module.css';

export const ratioOf = (item: ShowcaseItem) => item.width / item.height;

function chipMarkSrc(item: ShowcaseItem): string | null {
  if (item.templateId) {
    return templateLogoSrc(item.templateId);
  }
  return templateLogoForName(item.model);
}

/**
 * Plays only while active and on (or near) screen, so a wall of looping videos doesn't decode off-screen
 * copies. Every video loads enough to show its first frame (the `#t` fragment makes Safari paint it too),
 * so a paused tile still shows its media rather than an empty card. Without motion it never plays.
 */
const ShowcaseVideo = ({
  active,
  eager,
  poster,
  src,
}: {
  active: boolean;
  eager?: boolean;
  poster?: string;
  src: string;
}) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (!active) {
      video.pause();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Rejected when the browser blocks autoplay; the poster/first frame stays up instead.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: '0px 200px' }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [active]);

  return (
    <video
      className={styles.media}
      loop
      muted
      playsInline
      poster={poster}
      preload={eager ? 'auto' : 'metadata'}
      ref={ref}
      src={src.includes('#') ? src : `${src}#t=0.001`}
    />
  );
};

type ShowcaseTileProps = {
  /** Plays its video; inactive tiles keep theirs paused. */
  active?: boolean;
  className?: string;
  /** Loads the media up front instead of when it nears the viewport, for tiles that move into view. */
  eager?: boolean;
  item: ShowcaseItem;
  /** Takes the chip link out of the tab order, for copies hidden from assistive tech. */
  inert?: boolean;
  /** Overrides the media's own ratio, e.g. to give a slot a fixed shape. The media is cropped to fit. */
  ratio?: number;
  /** Rough rendered height as a share of the viewport height, for the image's `sizes`. */
  sizeVh?: number;
  style?: CSSProperties;
};

/**
 * One generated image or video with a chip naming the template or model that made it. Its width follows
 * from its height and ratio, so the parent only sizes the height.
 */
const ShowcaseTile = ({
  active = true,
  className,
  eager,
  inert,
  item,
  ratio = ratioOf(item),
  sizeVh = 45,
  style,
}: ShowcaseTileProps) => {
  const markSrc = chipMarkSrc(item);

  const chipContent = (
    <>
      {markSrc ? (
        <span className={styles.chipMark}>
          <Image alt="" height={12} src={markSrc} width={12} />
        </span>
      ) : (
        <span className={classNames(styles.chipMark, styles.chipMarkIcon)}>
          {item.type === 'video' ? <PlayArrowRoundedIcon /> : <ImageOutlinedIcon />}
        </span>
      )}
      <span className={styles.chipLabel}>{item.model}</span>
    </>
  );

  return (
    <figure className={classNames(styles.tile, className)} style={{ '--ratio': ratio, ...style } as CSSProperties}>
      {item.type === 'video' ? (
        <ShowcaseVideo active={active} eager={eager} poster={item.poster} src={item.src} />
      ) : (
        <Image
          alt={item.alt}
          className={styles.media}
          fill
          loading={eager ? 'eager' : 'lazy'}
          sizes={`${Math.ceil(ratio * sizeVh)}vh`}
          src={item.src}
          unoptimized={/^https?:\/\//.test(item.src)}
        />
      )}
      <figcaption className={classNames('chip chipPrimaryOutlined', styles.chip)}>
        {item.href ? (
          <Link className={styles.chipLink} href={item.href} tabIndex={inert ? -1 : undefined}>
            {chipContent}
          </Link>
        ) : (
          chipContent
        )}
      </figcaption>
    </figure>
  );
};

export default ShowcaseTile;
