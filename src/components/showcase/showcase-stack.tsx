import { ShowcaseItem } from '@/types/showcase';
import classNames from 'classnames';
import { CSSProperties, KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import styles from './showcase-stack.module.css';
import ShowcaseTile, { ratioOf } from './showcase-tile';

const CYCLE_MS = 3500;
/** Tiles shown on each side of the front one; the rest wait out of view. */
const DEPTH_DESKTOP = 3;
const DEPTH_MOBILE = 2;
const MOBILE_MAX_WIDTH = 767;
/** Scale of the tile at each depth, front first. */
const SCALES = [1, 0.84, 0.7, 0.58];
/** Widest a tile may get, as a share of the deck's width (front, then the rest), so wide media fits. */
const MAX_WIDTH_SHARE = [0.7, 0.5];
/** Phones show one portrait card at a time, so it gets more of the width. */
const MOBILE_FRONT_WIDTH_SHARE = 0.76;
/**
 * Shape of the collapsed tiles behind the front one; they show their own ratio only once spread. On
 * phones the front takes it too, since a wide tile capped to a narrow screen would leave the deck
 * mostly empty.
 */
const CARD_RATIO = 0.8;
/** Matches the stylesheet's --radius, so clipped corners keep the tile's rounding. */
const RADIUS_DESKTOP = 22;
const RADIUS_MOBILE = 14;
/** Horizontal drag that counts as a swipe, in px. */
const SWIPE_THRESHOLD = 40;

type Size = { width: number; height: number };

/**
 * Where a slot goes. The slot keeps its front size (`base`) and is scaled to its depth, so moving between
 * positions animates transform alone, which the browser composites without re-laying out.
 */
type Placement = {
  base: Size;
  scale: number;
  /** Crop from each edge of the base box (px, before scaling), turning it into the collapsed card. */
  inset: { x: number; y: number };
  /** Centre, from the deck's centre line. */
  x: number;
  depth: number;
  visible: boolean;
};

/** Position of item `index` relative to the front one, wrapped into the range around it. */
const relativeIndex = (index: number, step: number, count: number) => {
  const k = (((index - step) % count) + count) % count;
  return k > count / 2 ? k - count : k;
};

/**
 * A tile's size at a depth: its own ratio (or `ratio`, for the collapsed card), scaled down with depth
 * and capped in width.
 */
const tileSize = (item: ShowcaseItem, depth: number, deck: Size, ratio = ratioOf(item)): Size => {
  const scale = SCALES[Math.min(depth, SCALES.length - 1)];
  const frontShare = deck.width <= MOBILE_MAX_WIDTH ? MOBILE_FRONT_WIDTH_SHARE : MAX_WIDTH_SHARE[0];
  const maxWidth = deck.width * (depth === 0 ? frontShare : MAX_WIDTH_SHARE[1]) * scale;
  let height = deck.height * scale;
  let width = height * ratio;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  return { width, height };
};

/**
 * Lays the deck out around its centre. Each tile behind sticks out past the one in front of it by the
 * same sliver (`peek`) whatever its width, so the stack reads evenly and ends at the deck's edges;
 * spread out, the tiles sit side by side with a gap instead. Tiles past `maxDepth` wait, hidden, at
 * the ends of the stack.
 */
const layout = ({
  deck,
  items,
  maxDepth,
  spread,
  step,
}: {
  deck: Size;
  items: ShowcaseItem[];
  maxDepth: number;
  spread: boolean;
  step: number;
}): Placement[] => {
  const count = items.length;
  const relative = items.map((_, index) => relativeIndex(index, step, count));
  // Collapsed, tiles behind the front take the card shape; spread, every tile shows its own.
  const sizes = items.map((item, index) => {
    const depth = Math.abs(relative[index]);
    const ownShape = spread || (depth === 0 && deck.width > MOBILE_MAX_WIDTH);
    return tileSize(item, depth, deck, ownShape ? ratioOf(item) : CARD_RATIO);
  });
  const placements: Placement[] = new Array(count);
  const frontIndex = relative.indexOf(0);
  const front = sizes[frontIndex];
  // Collapsed, the outermost tiles end exactly at the deck's edges, so the stack spans its container.
  const peek = Math.max(0, (deck.width / 2 - front.width / 2) / maxDepth);
  const gap = Math.max(10, deck.height * 0.04);
  // The base box keeps the media's ratio; it is scaled to cover the target size and cropped to it.
  const place = (index: number, x: number, depth: number, visible: boolean) => {
    const base = tileSize(items[index], 0, deck);
    const target = sizes[index];
    const scale = Math.max(target.width / base.width, target.height / base.height);
    const inset = {
      x: Math.max(0, (base.width - target.width / scale) / 2),
      y: Math.max(0, (base.height - target.height / scale) / 2),
    };
    placements[index] = { base, inset, scale, x, depth, visible };
  };

  place(frontIndex, 0, 0, true);
  const outerEdge = { [-1]: front.width / 2, [1]: front.width / 2 };
  for (const side of [-1, 1] as const) {
    let edge = front.width / 2;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const index = relative.indexOf(side * depth);
      if (index === -1) {
        break;
      }
      const size = sizes[index];
      edge = spread ? edge + gap + size.width : edge + peek;
      place(index, side * (edge - size.width / 2), depth, true);
    }
    outerEdge[side] = edge;
  }
  // Waiting tiles tuck in behind the outermost one on their side (just past it when spread), so they
  // fade in and out where they enter and leave instead of sliding across the deck's edges.
  relative.forEach((k, index) => {
    if (!placements[index]) {
      const side = k < 0 ? -1 : 1;
      const width = sizes[index].width;
      const x = spread ? outerEdge[side] + gap + width / 2 : outerEdge[side] - width / 2;
      place(index, side * x, maxDepth + 1, false);
    }
  });
  return placements;
};

type ShowcaseStackProps = {
  'aria-label'?: string;
  className?: string;
  items: ShowcaseItem[];
};

/**
 * A carousel of generated media shaped as a deck: one tile in front with the next ones stacked half
 * hidden behind it on either side, every tile at its own aspect ratio. It steps left on a timer, in a
 * loop (the last item is followed by the first), and moves with a swipe, the arrow keys or a click on a
 * side tile. Hovering with a mouse pauses it and spreads the deck so the tiles behind come into view.
 *
 * Positions depend on the deck's measured size, so tiles stay hidden until the first measurement.
 */
const ShowcaseStack = ({ 'aria-label': ariaLabel, className, items }: ShowcaseStackProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef<number | null>(null);
  const [deck, setDeck] = useState<Size | null>(null);
  const [step, setStep] = useState(0);
  // Moves the user makes animate faster than the automatic cycle, so the deck answers right away.
  const [manual, setManual] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoEndedStep, setVideoEndedStep] = useState<number | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setDeck({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const paused = hovered || focused || reducedMotion;

  const frontIsVideo =
    items.length > 0 && items[((step % items.length) + items.length) % items.length].type === 'video';
  const waitingOnVideo = frontIsVideo && videoEndedStep !== step;

  // Restarts on every step, so a manual move gets a full interval before the next automatic one. A video
  // in front holds the deck until it has played to the end.
  useEffect(() => {
    if (paused || items.length < 2 || waitingOnVideo) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        setManual(false);
        setStep((current) => current + 1);
      },
      frontIsVideo ? 0 : CYCLE_MS
    );
    return () => window.clearTimeout(timer);
  }, [paused, items.length, step, waitingOnVideo, frontIsVideo]);

  const placements = useMemo(() => {
    if (!deck || items.length === 0) {
      return null;
    }
    const maxDepth = Math.min(
      deck.width <= MOBILE_MAX_WIDTH ? DEPTH_MOBILE : DEPTH_DESKTOP,
      Math.floor((items.length - 1) / 2)
    );
    return layout({ deck, items, maxDepth, spread: hovered, step });
  }, [deck, items, hovered, step]);

  if (items.length === 0) {
    return null;
  }

  const move = (by: number) => {
    setManual(true);
    setStep((current) => current + by);
  };

  const onPointerDown = (event: PointerEvent) => {
    swipeStartX.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (swipeStartX.current === null) {
      return;
    }
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      move(delta < 0 ? 1 : -1);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={classNames(
        styles.root,
        !placements && styles.measuring,
        hovered && styles.spread,
        manual && styles.manual,
        className
      )}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onKeyDown={onKeyDown}
      onPointerCancel={() => {
        swipeStartX.current = null;
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={(event) => setHovered(event.pointerType === 'mouse')}
      onPointerLeave={() => setHovered(false)}
      onPointerUp={onPointerUp}
      ref={rootRef}
      role="region"
      tabIndex={0}
    >
      {items.map((item, index) => {
        const placement = placements?.[index];
        const relative = relativeIndex(index, step, items.length);
        const visible = placement?.visible ?? false;
        // Corner radius in the base box's own pixels, so it reads the same at any scale.
        const radius =
          placement && deck ? (deck.width <= MOBILE_MAX_WIDTH ? RADIUS_MOBILE : RADIUS_DESKTOP) / placement.scale : 0;
        return (
          <div
            aria-hidden={!visible || undefined}
            className={classNames(styles.slot, {
              [styles.slotBack]: relative !== 0,
              [styles.slotHidden]: !visible,
            })}
            key={item.id}
            onClick={relative !== 0 && visible ? () => move(relative) : undefined}
            style={
              placement && deck
                ? ({
                    '--depth': placement.depth,
                    // Read by the chip, which sits inside the visible card at its normal size.
                    '--inset-x': `${placement.inset.x}px`,
                    '--inset-y': `${placement.inset.y}px`,
                    '--scale': placement.scale,
                    height: placement.base.height,
                    transform: `translate(${placement.x - placement.base.width / 2}px, ${
                      (deck.height - placement.base.height) / 2
                    }px) scale(${placement.scale})`,
                    width: placement.base.width,
                    zIndex: 10 - placement.depth,
                  } as CSSProperties)
                : undefined
            }
          >
            {/* The clip would cut a shadow off the tile, so it sits on its own layer (see the stylesheet). */}
            <span aria-hidden className={styles.shadow} />
            <div
              className={styles.clip}
              style={
                placement
                  ? { clipPath: `inset(${placement.inset.y}px ${placement.inset.x}px round ${radius}px)` }
                  : undefined
              }
            >
              {/* Only the front tile plays its video; the rest hold a frame. */}
              <ShowcaseTile
                active={relative === 0}
                className={styles.tile}
                eager
                inert={!visible}
                item={item}
                onVideoEnded={
                  items.length > 1
                    ? () => {
                        if (relative === 0) {
                          setVideoEndedStep(step);
                        }
                      }
                    : undefined
                }
                sizeVh={60}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ShowcaseStack;
