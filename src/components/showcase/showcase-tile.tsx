import useServiceTemplates from '@/components/hooks/use-service-templates';
import TemplateAvatar from '@/components/inference/template-avatar';
import { templateLogoForName, templateLogoSrc } from '@/components/inference/template-logos';
import { showcaseSourceHref } from '@/services/showcase';
import { ShowcaseItem } from '@/types/showcase';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import classNames from 'classnames';
import Image from 'next/image';
import Link from 'next/link';
import { CSSProperties, useEffect, useRef } from 'react';
import styles from './showcase-tile.module.css';

export const ratioOf = (item: ShowcaseItem) => item.width / item.height;

const CHIP_AVATAR_SIZE = 20;

/**
 * The source's avatar as the catalogue shows it, once the node's catalogue has it; until then, or for a
 * package, the mark matched from the source's id or label.
 */
const ShowcaseChipMark = ({ item }: { item: ShowcaseItem }) => {
  const { templates } = useServiceTemplates();
  const { source } = item;
  const template = source.kind === 'package' ? undefined : templates.find((candidate) => candidate.id === source.id);

  if (template) {
    return <TemplateAvatar className={styles.chipAvatar} size={CHIP_AVATAR_SIZE} template={template} />;
  }

  const markSrc = templateLogoSrc(source.id) ?? templateLogoForName(source.label);
  if (markSrc) {
    return (
      <span className={styles.chipMark}>
        <Image alt="" height={12} src={markSrc} width={12} />
      </span>
    );
  }

  return (
    <span className={classNames(styles.chipMark, styles.chipMarkIcon)}>
      {item.type === 'video' ? <PlayArrowRoundedIcon /> : <ImageOutlinedIcon />}
    </span>
  );
};

/**
 * Plays only while active and on (or near) screen, so a wall of looping videos doesn't decode off-screen
 * copies. Every video loads enough to show its first frame (the `#t` fragment makes Safari paint it too),
 * so a paused tile still shows its media rather than an empty card. Without motion it never plays.
 *
 * With `onEnded` it plays once from the start each time it becomes active instead of looping, and
 * reports the end; a video that can't play reports it right away, so whoever waits on it moves on.
 */
const ShowcaseVideo = ({
  active,
  eager,
  onEnded,
  poster,
  src,
}: {
  active: boolean;
  eager?: boolean;
  onEnded?: () => void;
  poster?: string;
  src: string;
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const playOnce = !!onEnded;

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
      if (playOnce) {
        video.currentTime = 0;
      }
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Rejected when the browser blocks autoplay; the poster/first frame stays up instead.
          video.play().catch(() => onEndedRef.current?.());
        } else {
          video.pause();
        }
      },
      { rootMargin: '0px 200px' }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [active, playOnce]);

  return (
    <video
      className={styles.media}
      loop={!playOnce}
      muted
      onEnded={() => onEndedRef.current?.()}
      onError={() => onEndedRef.current?.()}
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
  /** Shows the chip naming the template or model. Off where every tile comes from the same one. */
  chip?: boolean;
  className?: string;
  /** Loads the media up front instead of when it nears the viewport, for tiles that move into view. */
  eager?: boolean;
  item: ShowcaseItem;
  /** Takes the chip link out of the tab order, for copies hidden from assistive tech. */
  inert?: boolean;
  /** Plays a video once instead of looping and reports when it ends (or can't play). */
  onVideoEnded?: () => void;
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
  chip = true,
  className,
  eager,
  inert,
  item,
  onVideoEnded,
  ratio = ratioOf(item),
  sizeVh = 45,
  style,
}: ShowcaseTileProps) => {
  const chipContent = (
    <>
      <ShowcaseChipMark item={item} />
      <span className={styles.chipLabel}>{item.source.label}</span>
    </>
  );

  return (
    <figure className={classNames(styles.tile, className)} style={{ '--ratio': ratio, ...style } as CSSProperties}>
      {item.type === 'video' ? (
        <ShowcaseVideo active={active} eager={eager} onEnded={onVideoEnded} poster={item.poster} src={item.src} />
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
      {chip && (
        <figcaption className={classNames('chip chipPrimaryOutlined', styles.chip)}>
          <Link className={styles.chipLink} href={showcaseSourceHref(item.source)} tabIndex={inert ? -1 : undefined}>
            {chipContent}
          </Link>
        </figcaption>
      )}
    </figure>
  );
};

export default ShowcaseTile;
