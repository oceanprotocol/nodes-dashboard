import Button from '@/components/button/button';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import TemplateAvatar from '@/components/inference/template-avatar';
import { templateLogoForName, templateLogoSrc } from '@/components/inference/template-logos';
import { ShowcaseItem } from '@/types/showcase';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import classNames from 'classnames';
import Image from 'next/image';
import Link from 'next/link';
import { CSSProperties, useEffect, useRef, useState } from 'react';
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

/** The one media element with its sound on, so turning on another silences it. */
let audibleMedia: HTMLMediaElement | null = null;

const silence = (media: HTMLMediaElement) => {
  if (media instanceof HTMLVideoElement) {
    media.muted = true;
  } else {
    media.pause();
  }
};

/**
 * Tracks whether the media is audibly playing and reports it, so a carousel can hold while it is.
 * Turning sound on starts the media if it is paused, and silences whichever other one had sound.
 */
const useSound = <T extends HTMLMediaElement>(onSoundChange?: (soundOn: boolean) => void) => {
  const mediaRef = useRef<T>(null);
  const [soundOn, setSoundOn] = useState(false);
  const onSoundChangeRef = useRef(onSoundChange);
  onSoundChangeRef.current = onSoundChange;

  useEffect(() => {
    onSoundChangeRef.current?.(soundOn);
  }, [soundOn]);

  useEffect(() => {
    const media = mediaRef.current;
    return () => {
      if (audibleMedia === media) {
        audibleMedia = null;
      }
    };
  }, []);

  const sync = () => {
    const media = mediaRef.current;
    setSoundOn(!!media && !media.paused && !media.muted);
  };

  const toggle = () => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    if (soundOn) {
      silence(media);
      return;
    }
    if (audibleMedia && audibleMedia !== media) {
      silence(audibleMedia);
    }
    audibleMedia = media;
    media.muted = false;
    if (media.paused) {
      media.play().catch(() => silence(media));
    }
  };

  const mediaProps = { onPause: sync, onPlay: sync, onVolumeChange: sync };

  return { mediaProps, mediaRef, soundOn, toggle };
};

const SoundButton = ({ inert, onClick, soundOn }: { inert?: boolean; onClick: () => void; soundOn: boolean }) => (
  <Button
    aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
    aria-pressed={soundOn}
    className={styles.sound}
    color="primary-inverse"
    onClick={onClick}
    size="md-const"
    tabIndex={inert ? -1 : undefined}
    variant="glass"
  >
    {soundOn ? <VolumeUpRoundedIcon fontSize="small" /> : <VolumeOffRoundedIcon fontSize="small" />}
  </Button>
);

/**
 * Plays muted, and only while active and on (or near) screen, so a wall of looping videos doesn't decode
 * off-screen copies. Every video loads enough to show its first frame (the `#t` fragment makes Safari
 * paint it too), so a paused tile still shows its media rather than an empty card. Without motion it
 * only plays once its sound is turned on. It goes back to muted whenever it stops being active or visible.
 *
 * With `onEnded` it plays once from the start each time it becomes active instead of looping, and
 * reports the end; a video that can't play reports it right away, so whoever waits on it moves on.
 */
const ShowcaseVideo = ({
  active,
  eager,
  inert,
  onEnded,
  onSoundChange,
  poster,
  silent,
  src,
}: {
  active: boolean;
  eager?: boolean;
  inert?: boolean;
  onEnded?: () => void;
  onSoundChange?: (soundOn: boolean) => void;
  poster?: string;
  silent?: boolean;
  src: string;
}) => {
  const { mediaProps, mediaRef, soundOn, toggle } = useSound<HTMLVideoElement>(onSoundChange);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const playOnce = !!onEnded;

  useEffect(() => {
    const video = mediaRef.current;
    if (!video) {
      return;
    }
    if (!active) {
      video.pause();
      video.muted = true;
      if (playOnce) {
        video.currentTime = 0;
      }
      return;
    }
    const autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();
          video.muted = true;
        } else if (autoplay) {
          // Rejected when the browser blocks autoplay; the poster/first frame stays up instead.
          video.play().catch(() => onEndedRef.current?.());
        }
      },
      { rootMargin: '0px 200px' }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [active, mediaRef, playOnce]);

  return (
    <>
      <video
        className={styles.media}
        loop={!playOnce}
        muted
        onEnded={() => onEndedRef.current?.()}
        onError={() => onEndedRef.current?.()}
        playsInline
        poster={poster}
        preload={eager ? 'auto' : 'metadata'}
        ref={mediaRef}
        src={src.includes('#') ? src : `${src}#t=0.001`}
        {...mediaProps}
      />
      {active && !silent && <SoundButton inert={inert} onClick={toggle} soundOn={soundOn} />}
    </>
  );
};

const PLAYER_BARS = [0.35, 0.6, 0.85, 0.5, 0.95, 0.7, 0.4, 0.8, 1, 0.65, 0.45, 0.9, 0.55, 0.75, 0.4, 0.6];

/**
 * A track with no picture: an equalizer card that moves while its sound is on. The sound button plays and
 * stops it; it also stops when no longer active or when it scrolls out of view.
 */
const ShowcaseAudio = ({
  active,
  inert,
  onSoundChange,
  src,
}: {
  active: boolean;
  inert?: boolean;
  onSoundChange?: (soundOn: boolean) => void;
  src: string;
}) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const { mediaProps, mediaRef, soundOn, toggle } = useSound<HTMLAudioElement>(onSoundChange);

  useEffect(() => {
    if (!active) {
      mediaRef.current?.pause();
    }
  }, [active, mediaRef]);

  useEffect(() => {
    const audio = mediaRef.current;
    const view = viewRef.current;
    if (!audio || !view || !soundOn) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        audio.pause();
      }
    });
    observer.observe(view);
    return () => observer.disconnect();
  }, [mediaRef, soundOn]);

  return (
    <>
      <div aria-hidden className={classNames(styles.media, styles.player, { [styles.playing]: soundOn })} ref={viewRef}>
        {PLAYER_BARS.map((height, index) => (
          <span key={index} style={{ '--bar': height, '--delay': `${index * -0.13}s` } as CSSProperties} />
        ))}
      </div>
      <audio preload="none" ref={mediaRef} src={src} {...mediaProps} />
      {active && <SoundButton inert={inert} onClick={toggle} soundOn={soundOn} />}
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
  /** Reports when the tile's sound is turned on or off. */
  onSoundChange?: (soundOn: boolean) => void;
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
  onSoundChange,
  onVideoEnded,
  ratio = ratioOf(item),
  sizeVh = 45,
  style,
}: ShowcaseTileProps) => {
  return (
    <figure className={classNames(styles.tile, className)} style={{ '--ratio': ratio, ...style } as CSSProperties}>
      {item.type === 'audio' ? (
        <ShowcaseAudio active={active} inert={inert} onSoundChange={onSoundChange} src={item.src} />
      ) : item.type === 'video' ? (
        <ShowcaseVideo
          active={active}
          eager={eager}
          inert={inert}
          onEnded={onVideoEnded}
          onSoundChange={onSoundChange}
          poster={item.poster}
          silent={item.silent}
          src={item.src}
        />
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
