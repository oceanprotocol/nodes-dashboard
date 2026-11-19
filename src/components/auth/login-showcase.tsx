import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import classNames from 'classnames';
import { ReactNode, useEffect, useState } from 'react';
import styles from './login-showcase.module.css';

type Slide = {
  art: ReactNode;
  chips: string[];
  description: string;
  facts: string[];
  id: string;
  theme: 'black' | 'blush' | 'coral' | 'lime' | 'white';
  title: string;
};

const CORAL = '#d54335';
const LIME = '#b7fd79';
const BLUSH = '#eaa39c';
const BOTTLE_ID = 'login-showcase-bottle';

const bars = (count: number, x0: number, y: number, width: number, gap: number, height: (i: number) => number) =>
  Array.from({ length: count }, (_, i) => {
    const h = height(i);
    return <rect height={h} key={i} rx={width / 2} width={width} x={x0 + i * (width + gap)} y={y - h / 2} />;
  });

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
    facts: ['Cost shown before you run'],
    art: (
      <svg aria-label="One product photo becoming four studio shots" role="img" viewBox="0 0 520 380">
        <rect fill="#fff" height="200" rx="24" width="150" x="10" y="90" />
        <rect fill="#f5f5f5" height="176" rx="16" width="126" x="22" y="102" />
        <Bottle fill="#000" height={80} width={46} x={62} y={148} />
        <text fill="#fff" fontSize="13" fontWeight="600" textAnchor="middle" x="85" y="318">
          Your photo
        </text>
        <path
          d="M176 190h54m-14-14 14 14-14 14"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <rect fill={LIME} height="150" rx="22" width="125" x="250" y="40" />
        <Bottle fill="#000" height={74} width={42} x={291} y={70} />
        <text fontSize="12" fontWeight="600" x="262" y="176">
          Studio
        </text>
        <rect fill="#fff" height="150" rx="22" width="125" x="385" y="40" />
        <Bottle fill={CORAL} height={74} width={42} x={426} y={70} />
        <text fontSize="12" fontWeight="600" x="397" y="176">
          Lifestyle
        </text>
        <rect fill="#000" height="150" rx="22" width="125" x="250" y="200" />
        <Bottle fill={LIME} height={74} width={42} x={291} y={228} />
        <text fill="#fff" fontSize="12" fontWeight="600" x="262" y="336">
          Poster
        </text>
        <rect fill={BLUSH} height="150" rx="22" width="125" x="385" y="200" />
        <Bottle fill="#000" height={74} width={42} x={426} y={228} />
        <circle cx="478" cy="318" fill="#000" r="14" />
        <path d="M473 311l12 7-12 7z" fill={LIME} />
        <text fontSize="12" fontWeight="600" x="397" y="336">
          360° spin
        </text>
      </svg>
    ),
  },
  {
    id: 'ugc',
    theme: 'black',
    chips: ['TEMPLATE', 'CREATORS & AGENCIES'],
    title: 'UGC Reel Maker',
    description: 'One character and one voice across every shot, up to 8 shots.',
    facts: ['~$0.72 for a 30s video', '~20 min to first output'],
    art: (
      <svg aria-label="Three vertical video shots with the same character" role="img" viewBox="0 0 520 380">
        {(
          [
            [10, CORAL],
            [185, LIME],
            [360, BLUSH],
          ] as const
        ).map(([x, color], i) => (
          <g key={x}>
            <rect fill="#161616" height="244" rx="26" stroke="#ffffff30" strokeWidth="2" width="150" x={x} y="10" />
            <rect fill={color} height="224" rx="18" width="130" x={x + 10} y="20" />
            <circle cx={x + 75} cy={104 + i * 6} fill="#000" r="25" />
            <path d={`M${x + 28} 244c0-44 22-78 47-78s47 34 47 78z`} fill="#000" />
            <rect fill="#fff" height="6" rx="3" width={70 + i * 14} x={x + 22} y="222" />
            <text fill="#ffffffb0" fontSize="13" fontWeight="600" textAnchor="middle" x={x + 75} y="280">
              Shot {i + 1}
            </text>
          </g>
        ))}
        <g fill={LIME}>{bars(46, 12, 322, 4, 6.8, (i) => 8 + Math.abs(Math.sin(i * 0.55) * 20) + (i % 3) * 3)}</g>
        <text fill="#ffffffa0" fontSize="13" fontWeight="500" textAnchor="middle" x="260" y="372">
          Same character. Same voice.
        </text>
      </svg>
    ),
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
    id: 'music',
    theme: 'blush',
    chips: ['TEMPLATE', 'NEW'],
    title: 'Music Generator',
    description: 'One-line brief in. A stereo song with vocals out, powered by MiniMax Music 3.',
    facts: ['Cost shown before you run'],
    art: (
      <svg aria-label="A generated track with waveform" role="img" viewBox="0 0 520 380">
        <rect fill="#ffffffd8" height="300" rx="32" stroke="#00000012" width="500" x="10" y="30" />
        <rect fill="#000" height="96" rx="22" width="96" x="40" y="60" />
        <g fill={LIME}>{bars(9, 56, 108, 5, 5.2, (i) => 14 + [4, 18, 30, 12, 38, 22, 34, 10, 20][i])}</g>
        <rect fill="#000" height="14" rx="7" width="190" x="156" y="68" />
        <rect fill="#00000060" height="9" rx="4.5" width="130" x="156" y="94" />
        <rect fill={LIME} height="26" rx="13" width="96" x="156" y="122" />
        <text fontSize="12" fontWeight="600" textAnchor="middle" x="204" y="140">
          Stereo · Vocals
        </text>
        <g fill={CORAL}>{bars(16, 40, 244, 6, 4.6, (i) => 14 + Math.abs(Math.sin(i * 0.7) * 54) + (i % 4) * 4)}</g>
        <g fill="#00000030">
          {bars(24, 40 + 16 * 10.6, 244, 6, 4.6, (i) => 14 + Math.abs(Math.cos(i * 0.6 + 1) * 58) + (i % 3) * 5)}
        </g>
        <rect fill="#00000020" height="4" rx="2" width="430" x="40" y="296" />
        <rect fill="#000" height="4" rx="2" width="168" x="40" y="296" />
        <circle cx="208" cy="298" fill="#000" r="8" />
      </svg>
    ),
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
      className={classNames(styles.show, { [styles.paused]: paused })}
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
            <div className={styles.art}>{slide.art}</div>
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
      <div aria-label="Choose a slide" className={styles.timer} role="tablist">
        {order.map((id, index) => (
          <button
            aria-label={SLIDES_BY_ID[id].title}
            aria-selected={index === current}
            className={classNames({ [styles.past]: index < current, [styles.current]: index === current })}
            key={`${id}-${index === current ? current : 'idle'}`}
            onClick={() => goTo(index)}
            role="tab"
            type="button"
          >
            <span className={styles.track}>
              <span className={styles.fill} onAnimationEnd={index === current ? () => goTo(current + 1) : undefined} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LoginShowcase;
