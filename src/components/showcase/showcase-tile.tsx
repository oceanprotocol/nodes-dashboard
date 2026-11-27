import Button from '@/components/button/button';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import TemplateAvatar from '@/components/inference/template-avatar';
import { templateLogoForName, templateLogoSrc } from '@/components/inference/template-logos';
import { ShowcaseItem } from '@/types/showcase';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import classNames from 'classnames';
import Image from 'next/image';
import Link from 'next/link';
import { CSSProperties, RefObject, useEffect, useRef, useState } from 'react';
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
      {item.type === 'video' ? (
        <PlayArrowRoundedIcon />
      ) : item.type === 'audio' ? (
        <MusicNoteRoundedIcon />
      ) : (
        <ImageOutlinedIcon />
      )}
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

/** The one media element playing with sound, so starting another stops it. */
let audibleMedia: HTMLMediaElement | null = null;

/**
 * Click-to-play with sound. Never autoplays; stops when no longer active or when `viewRef` (the media
 * itself by default) scrolls out of view, and reports whether it is playing so a carousel can hold.
 */
const useListenPlayback = <T extends HTMLMediaElement>(
  active: boolean,
  onListeningChange?: (listening: boolean) => void,
  viewRef?: RefObject<HTMLElement | null>
) => {
  const mediaRef = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

  useEffect(() => {
    onListeningChangeRef.current?.(playing);
  }, [playing]);

  useEffect(() => {
    if (!active) {
      mediaRef.current?.pause();
    }
  }, [active]);

  useEffect(() => {
    const media = mediaRef.current;
    const view = viewRef?.current ?? media;
    if (!media || !view || !playing) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        media.pause();
      }
    });
    observer.observe(view);
    return () => observer.disconnect();
  }, [playing, viewRef]);

  const toggle = () => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    if (!media.paused) {
      media.pause();
      return;
    }
    if (audibleMedia && audibleMedia !== media) {
      audibleMedia.pause();
    }
    audibleMedia = media;
    media.muted = false;
    media.play().catch(() => setPlaying(false));
  };

  const mediaProps = { onPause: () => setPlaying(false), onPlay: () => setPlaying(true) };

  return { mediaProps, mediaRef, playing, toggle };
};

const ListenButton = ({ onClick, playing }: { onClick: () => void; playing: boolean }) => (
  <Button
    aria-label={playing ? 'Pause' : 'Listen with sound'}
    className={styles.listen}
    color="accent1"
    contentBefore={playing ? <PauseRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
    onClick={onClick}
    size="sm"
    variant="glass"
  >
    {playing ? 'Pause' : 'Listen'}
  </Button>
);

type ListenMediaProps = {
  active: boolean;
  onListeningChange?: (listening: boolean) => void;
  src: string;
};

/** A video with sound: waits on its first frame until the Listen button starts it, unmuted. */
const ShowcaseListenVideo = ({ active, onListeningChange, poster, src }: ListenMediaProps & { poster?: string }) => {
  const { mediaProps, mediaRef, playing, toggle } = useListenPlayback<HTMLVideoElement>(active, onListeningChange);

  return (
    <>
      <video
        className={styles.media}
        playsInline
        poster={poster}
        preload="metadata"
        ref={mediaRef}
        src={src.includes('#') ? src : `${src}#t=0.001`}
        {...mediaProps}
      />
      {active && <ListenButton onClick={toggle} playing={playing} />}
    </>
  );
};

const PLAYER_BARS = [0.35, 0.6, 0.85, 0.5, 0.95, 0.7, 0.4, 0.8, 1, 0.65, 0.45, 0.9, 0.55, 0.75, 0.4, 0.6];

/** A track with no picture: an equalizer card that moves while the Listen button plays it. */
const ShowcaseAudio = ({ active, onListeningChange, src }: ListenMediaProps) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const { mediaProps, mediaRef, playing, toggle } = useListenPlayback<HTMLAudioElement>(
    active,
    onListeningChange,
    viewRef
  );

  return (
    <>
      <div aria-hidden className={classNames(styles.media, styles.player, { [styles.playing]: playing })} ref={viewRef}>
        {PLAYER_BARS.map((height, index) => (
          <span key={index} style={{ '--bar': height, '--delay': `${index * -0.13}s` } as CSSProperties} />
        ))}
      </div>
      <audio preload="none" ref={mediaRef} src={src} {...mediaProps} />
      {active && <ListenButton onClick={toggle} playing={playing} />}
    </>
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
  href?: string;
  item: ShowcaseItem;
  inert?: boolean;
  /** Plays a video once instead of looping and reports when it ends (or can't play). */
  onVideoEnded?: () => void;
  /** Reports when a video or track with sound starts or stops playing. */
  onListeningChange?: (listening: boolean) => void;
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
  href,
  inert,
  item,
  onListeningChange,
  onVideoEnded,
  ratio = ratioOf(item),
  sizeVh = 45,
  style,
}: ShowcaseTileProps) => {
  return (
    <figure className={classNames(styles.tile, className)} style={{ '--ratio': ratio, ...style } as CSSProperties}>
      {item.type === 'audio' ? (
        <ShowcaseAudio active={active} onListeningChange={onListeningChange} src={item.src} />
      ) : item.type === 'video' && item.audio ? (
        <ShowcaseListenVideo
          active={active}
          onListeningChange={onListeningChange}
          poster={item.poster}
          src={item.src}
        />
      ) : item.type === 'video' ? (
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
          <ShowcaseChipMark item={item} />
          <span className={styles.chipLabel}>{item.source.label}</span>
        </figcaption>
      )}
      {href && (
        <Link
          aria-label={item.source.label}
          className={styles.link}
          draggable={false}
          href={href}
          tabIndex={inert ? -1 : undefined}
        />
      )}
    </figure>
  );
};

export default ShowcaseTile;
