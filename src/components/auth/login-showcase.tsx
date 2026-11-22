import ShowcaseTile, { ratioOf } from '@/components/showcase/showcase-tile';
import { PRODUCT_STUDIO_QWEN_IMAGE } from '@/data/showcase';
import { SHOWCASE_ITEMS, toShowcaseItem } from '@/services/showcase';
import { ShowcaseItem } from '@/types/showcase';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import classNames from 'classnames';
import { ReactNode, useEffect, useState } from 'react';
import styles from './login-showcase.module.css';

type SlideMedia = {
  input?: ShowcaseItem;
  layout?: 'reels';
  outputs: ShowcaseItem[];
};

type Slide = {
  art?: ReactNode;
  chips: string[];
  description: string;
  facts: string[];
  id: string;
  media?: SlideMedia;
  theme: 'black' | 'blush' | 'coral' | 'lime' | 'white';
  title: string;
};

const CORAL = '#d54335';
const LIME = '#b7fd79';
const BLUSH = '#eaa39c';
const BOTTLE_ID = 'login-showcase-bottle';
const showcaseItems = (ids: string[]) => ids.flatMap((id) => SHOWCASE_ITEMS.filter((item) => item.id === id));
const VIDEO_CLIPS = showcaseItems(['newspaper-gift', 'paper-ocean', 'anime-wheat-field']);
const PRODUCT_OUTPUTS = showcaseItems(['ecom-forest-background', 'ecom-sale-poster', 'ecom-turntable', 'ecom-motion']);
const UGC_REELS = showcaseItems(['ugc-kitchen-review', 'ugc-bathrobe-phone', 'ugc-noodles', 'ugc-neon-cash']);
const MUSIC_TRACKS = showcaseItems(['music-drifting-thoughts']);
const PRODUCT_INPUT = toShowcaseItem({
  id: 'ecom-source',
  type: 'image',
  file: 'ecom_background_00001_.png',
  width: 896,
  height: 1344,
  alt: 'Source photo: glass perfume bottle on a marble kitchen counter',
  source: PRODUCT_STUDIO_QWEN_IMAGE,
});
const BUILDER_LOGOS = ['qwen.svg', 'vllm.png', 'opencode.svg', 'comfyui.svg', 'jupyter.svg'];

const bars = (count: number, x0: number, y: number, width: number, gap: number, height: (i: number) => number) =>
  Array.from({ length: count }, (_, i) => {
    const h = height(i);
    return <rect height={h} key={i} rx={width / 2} width={width} x={x0 + i * (width + gap)} y={y - h / 2} />;
  });

const LogoBadge = ({ cx, cy, r, src }: { cx: number; cy: number; r: number; src: string }) => (
  <g>
    <circle cx={cx} cy={cy} fill="#fff" r={r} />
    <image height={r * 1.2} href={`/logos/templates/${src}`} width={r * 1.2} x={cx - r * 0.6} y={cy - r * 0.6} />
  </g>
);

const Bottle = ({
  fill,
  height,
  width,
  x,
  y,
}: {
  fill: string;
  height: number;
  width: number;
  x: number;
  y: number;
}) => <use fill={fill} height={height} href={`#${BOTTLE_ID}`} width={width} x={x} y={y} />;

const SLIDES: Slide[] = [
  {
    id: 'product',
    theme: 'coral',
    chips: ['TEMPLATE', 'SELLERS'],
    title: 'Product Photo Studio',
    description: 'One photo in. New backgrounds, a 360° spin, a poster and a short video out.',
    facts: ['Made on Ocean with Qwen Image', 'Cost shown before you run'],
    media: { input: PRODUCT_INPUT, outputs: PRODUCT_OUTPUTS },
  },
  {
    id: 'ugc',
    theme: 'black',
    chips: ['TEMPLATE', 'CREATORS & AGENCIES'],
    title: 'UGC Reel Maker',
    description: 'One character and one voice across every shot, up to 8 shots.',
    facts: ['~$0.72 for a 30s video', '~20 min to first output'],
    media: { layout: 'reels', outputs: UGC_REELS },
  },
  {
    id: 'ad',
    theme: 'lime',
    chips: ['TEMPLATE', 'BRANDS & AGENCIES'],
    title: 'Ad Campaign Generator',
    description: '5 photos in. Ad images, posters and a vertical video out, with copy.',
    facts: ['Cost shown before you run'],
    art: (
      <svg aria-label="A set of ad images, posters and a vertical video" role="img" viewBox="0 0 520 380">
        <rect fill={CORAL} height="210" rx="22" width="160" x="10" y="10" />
        <circle cx="90" cy="92" fill="#fff" r="34" />
        <rect fill="#fff" height="10" rx="5" width="100" x="30" y="150" />
        <rect fill="#ffffffa0" height="8" rx="4" width="70" x="30" y="170" />
        <rect fill="#000" height="14" rx="7" width="46" x="30" y="190" />
        <rect fill="#000" height="100" rx="22" width="170" x="184" y="10" />
        <rect fill={LIME} height="10" rx="5" width="90" x="202" y="32" />
        <rect fill="#ffffff80" height="8" rx="4" width="120" x="202" y="54" />
        <rect fill="#fff" height="14" rx="7" width="56" x="202" y="76" />
        <rect fill="#fff" height="98" rx="22" width="170" x="184" y="122" />
        <Bottle fill="#000" height={64} width={36} x={206} y={136} />
        <rect fill="#000" height="9" rx="4.5" width="70" x="262" y="146" />
        <rect fill="#00000060" height="7" rx="3.5" width="52" x="262" y="166" />
        <rect fill="#000" height="210" rx="22" width="142" x="368" y="10" />
        <circle cx="439" cy="104" fill={LIME} r="24" />
        <path d="M432 94l17 10-17 10z" fill="#000" />
        <rect fill="#ffffff40" height="4" rx="2" width="106" x="386" y="196" />
        <rect fill="#fff" height="4" rx="2" width="48" x="386" y="196" />
        <rect fill="#ffffffb0" height="124" rx="26" stroke="#00000015" width="500" x="10" y="236" />
        <text fill={CORAL} fontSize="12" fontWeight="700" letterSpacing="1.2" x="34" y="272">
          COPY
        </text>
        <rect fill="#000" height="12" rx="6" width="300" x="34" y="286" />
        <rect fill="#00000070" height="8" rx="4" width="400" x="34" y="310" />
        <rect fill="#00000070" height="8" rx="4" width="340" x="34" y="328" />
        <rect fill="#000" height="34" rx="17" width="88" x="400" y="278" />
        <text fill="#fff" fontSize="13" fontWeight="600" textAnchor="middle" x="444" y="300">
          Shop now
        </text>
      </svg>
    ),
  },
  {
    id: 'video',
    theme: 'black',
    chips: ['TEMPLATE', 'CREATORS & BRANDS'],
    title: 'Video Generator',
    description: 'Text, a photo or references in. Video with audio out.',
    facts: ['Made on Ocean with MiniMax H3', 'Cost shown before you run'],
    media: { outputs: VIDEO_CLIPS },
  },
  {
    id: 'music',
    theme: 'blush',
    chips: ['TEMPLATE', 'NEW'],
    title: 'Music Generator',
    description: 'One-line brief in. A stereo song with vocals out, powered by MiniMax Music 3.',
    facts: ['Cost shown before you run'],
    media: { outputs: MUSIC_TRACKS },
  },
  {
    id: 'builder',
    theme: 'white',
    chips: ['MODEL API', 'BUILDERS'],
    title: 'Your model, your GPU',
    description: 'Pin an open model on a dedicated card. One OpenAI-compatible endpoint, price on screen first.',
    facts: ['H200 from $2.16/hr', 'Hard stop at your price'],
    art: (
      <svg aria-label="A code snippet calling an OpenAI-compatible endpoint" role="img" viewBox="0 0 520 380">
        <rect fill="#000" height="290" rx="28" width="500" x="10" y="20" />
        <circle cx="44" cy="52" fill={CORAL} r="6" />
        <circle cx="64" cy="52" fill="#ffc26c" r="6" />
        <circle cx="84" cy="52" fill={LIME} r="6" />
        {BUILDER_LOGOS.map((logo, i) => (
          <LogoBadge cx={346 + i * 34} cy={52} key={logo} r={13} src={logo} />
        ))}
        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="13" className={styles.code}>
          <text fill="#ffffff90" x="36" y="100">
            $ curl <tspan fill={LIME}>{'https://<your-endpoint>/v1/chat/completions'}</tspan> \
          </text>
          <text fill="#fff" x="36" y="134">
            {"  -d '{"}
            <tspan fill={BLUSH}>&quot;model&quot;</tspan>: <tspan fill={LIME}>&quot;Qwen3.8-27B&quot;</tspan>,
          </text>
          <text fill="#fff" x="36" y="164">
            {'       '}
            <tspan fill={BLUSH}>&quot;messages&quot;</tspan>: [{'{'}
            <tspan fill={BLUSH}>&quot;role&quot;</tspan>: <tspan fill={LIME}>&quot;user&quot;</tspan>,
          </text>
          <text fill="#fff" x="36" y="194">
            {'                      '}
            <tspan fill={BLUSH}>&quot;content&quot;</tspan>: <tspan fill={LIME}>&quot;Hello&quot;</tspan>
            {"}]}'"}
          </text>
          <text fill="#ffffff60" x="36" y="248">
            {'// 200 OK · same model, same card, all hour'}
          </text>
        </g>
        <rect fill={LIME} height="22" rx="2" width="14" x="36" y="268" />
        <rect fill={CORAL} height="38" rx="19" width="132" x="10" y="326" />
        <text fill="#fff" fontSize="14" fontWeight="600" textAnchor="middle" x="76" y="350">
          H200 · $2.16/hr
        </text>
        <rect fill={LIME} height="38" rx="19" width="172" x="152" y="326" />
        <text fontSize="14" fontWeight="600" textAnchor="middle" x="238" y="350">
          Stops at your price
        </text>
      </svg>
    ),
  },
];

const SLIDE_IDS = SLIDES.map((slide) => slide.id);
const SLIDES_BY_ID = Object.fromEntries(SLIDES.map((slide) => [slide.id, slide]));

const orderLedBy = (id: string | null) => {
  if (!id || !SLIDES_BY_ID[id]) {
    return SLIDE_IDS;
  }
  return [id, ...SLIDE_IDS.filter((slideId) => slideId !== id)];
};

export type ShowcaseFocus = { id: string };

type LoginShowcaseProps = {
  focus?: ShowcaseFocus | null;
  lead?: string | null;
};

const LoginShowcase = ({ focus, lead = null }: LoginShowcaseProps) => {
  const [order, setOrder] = useState(SLIDE_IDS);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaused(true);
    }
  }, []);

  useEffect(() => {
    const next = orderLedBy(lead);
    setOrder((prev) => (prev[0] === next[0] ? prev : next));
    setCurrent((prev) => (lead && SLIDES_BY_ID[lead] ? 0 : prev));
  }, [lead]);

  useEffect(() => {
    if (!focus) {
      return;
    }
    const index = order.indexOf(focus.id);
    if (index >= 0) {
      setCurrent(index);
    }
  }, [focus, order]);

  const goTo = (index: number) => setCurrent((index + order.length) % order.length);

  return (
    <div
      aria-label="What you can make and run on Ocean"
      aria-roledescription="carousel"
      className={classNames(styles.show, { [styles.paused]: paused || listening })}
      role="region"
    >
      <svg aria-hidden className={styles.defs}>
        <symbol id={BOTTLE_ID} viewBox="0 0 40 70">
          <rect height="8" rx="2" width="14" x="13" y="2" />
          <rect height="14" rx="2" width="10" x="15" y="9" />
          <rect height="48" rx="8" width="28" x="6" y="20" />
          <rect fill="#fff" height="16" opacity=".92" rx="3" width="20" x="10" y="36" />
        </symbol>
      </svg>
      <div className={styles.top}>
        <span className={styles.glassChip}>
          <span className={styles.dot} />
          New on Ocean
        </span>
        <button
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          className={styles.pause}
          onClick={() => setPaused((prev) => !prev)}
          type="button"
        >
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </button>
      </div>
      {order.map((id, index) => {
        const slide = SLIDES_BY_ID[id];
        const active = index === current;
        return (
          <article
            aria-hidden={!active}
            aria-label={`${index + 1} of ${order.length}`}
            aria-roledescription="slide"
            className={classNames(styles.slide, styles[`theme-${slide.theme}`], { [styles.active]: active })}
            key={id}
            role="group"
          >
            <div className={styles.art}>
              {slide.media ? (
                <div
                  className={classNames(styles.mediaArt, {
                    [styles.withInput]: !!slide.media.input,
                    [styles.reels]: slide.media.layout === 'reels',
                  })}
                  style={
                    !slide.media.input && slide.media.outputs.length === 1
                      ? { aspectRatio: ratioOf(slide.media.outputs[0]) }
                      : undefined
                  }
                >
                  {slide.media.input && (
                    <>
                      <div className={styles.input}>
                        <ShowcaseTile active={active} chip={false} className={styles.clip} item={slide.media.input} />
                        <span className={styles.inputLabel}>Your photo</span>
                      </div>
                      <ArrowForwardIcon aria-hidden className={styles.arrow} />
                    </>
                  )}
                  <div className={styles.outputs}>
                    {slide.media.outputs.map((item) => (
                      <ShowcaseTile
                        active={active}
                        chip={false}
                        className={styles.clip}
                        item={item}
                        key={item.id}
                        onListeningChange={setListening}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                slide.art
              )}
            </div>
            <div className={styles.caption}>
              <div className={styles.chips}>
                {slide.chips.map((chip, chipIndex) => (
                  <span
                    className={classNames(styles.chip, {
                      [styles.chipNew]: chip === 'NEW',
                      [styles.chipAccent]: chip !== 'NEW' && chipIndex === 0,
                      [styles.chipOutlined]: chip !== 'NEW' && chipIndex > 0,
                    })}
                    key={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <div className={styles.facts}>
                {slide.facts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </div>
            </div>
          </article>
        );
      })}
      <div aria-label="Choose a slide" className={styles.timer} role="group">
        {order.map((id, index) => (
          <button
            aria-label={SLIDES_BY_ID[id].title}
            aria-pressed={index === current}
            className={classNames({ [styles.past]: index < current, [styles.current]: index === current })}
            key={id}
            onClick={() => goTo(index)}
            type="button"
          >
            <span className={styles.track}>
              <span
                className={styles.fill}
                key={index === current ? current : 'idle'}
                onAnimationEnd={index === current ? () => goTo(current + 1) : undefined}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LoginShowcase;
