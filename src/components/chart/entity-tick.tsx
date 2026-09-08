import { templateLogoForName, templateLogoSrc } from '@/components/inference/template-logos';
import { getAuthorAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { Tooltip } from '@mui/material';
import { useId, useState } from 'react';

/**
 * The kind of thing a chart's category axis names, which decides how a label resolves to a mark and a
 * two-line name:
 *
 * - `model`: a Hugging Face model id (`Qwen/Qwen3-8B`) — the org avatar, the repo name, the author
 *   underneath. Same resolution as ModelCell's model branch.
 * - `app`: a container image (`ghcr.io/ocean/comfyui:latest`) — the image's own repo name carries the
 *   app, so the mark comes from the template logo manifest keyed on it, and the registry path becomes
 *   the caption.
 */
export type EntityKind = 'model' | 'app';

export type EntityLabel = {
  /** Avatar/logo URL, or undefined when nothing was resolved (then the monogram stands in). */
  avatarUrl?: string;
  /** True when the mark is a brand logo rather than an org photo — letterboxed instead of cropped. */
  isLogo: boolean;
  /** Primary line. */
  name: string;
  /** Secondary line, omitted when there is nothing to say beyond the name. */
  caption?: string;
  /** Monogram fallback. */
  initial: string;
  /** Full value, for the hover title. */
  full: string;
};

/**
 * An image ref's app name: the last path segment with the tag and any `-` suffixes kept, since that
 * is what names the app (`ghcr.io/ocean-node/comfyui:v2` → `comfyui`). The registry path in front is
 * the caption — it distinguishes two builds of the same app without crowding the name.
 */
function splitImage(image: string): { name: string; caption?: string } {
  // Strip the tag/digest first so a registry port (`host:5000/app`) isn't mistaken for one.
  const withoutDigest = image.split('@')[0];
  const lastSlash = withoutDigest.lastIndexOf('/');
  const path = lastSlash >= 0 ? withoutDigest.slice(0, lastSlash) : undefined;
  const lastSegment = withoutDigest.slice(lastSlash + 1);
  const name = lastSegment.split(':')[0] || lastSegment;
  return { caption: path, name };
}

/** Resolve a raw axis value into the parts a rich label needs. */
export function toEntityLabel(value: string, kind: EntityKind): EntityLabel {
  if (kind === 'app') {
    const { name, caption } = splitImage(value);
    // The manifest keys on template ids, and an image's app segment is written the same way
    // (`open-webui`, `comfyui`), so the name usually reaches it directly. Fall back to the whole ref
    // because the app is sometimes named only by the namespace: `quay.io/jupyter/scipy-notebook` is a
    // Jupyter image whose last segment says `scipy-notebook`, and `ghcr.io/ggml-org/llama.cpp` keys on
    // a name the slugifier would otherwise flatten. The name is tried first so the more specific of
    // the two still wins (an `open-webui` image under a personal namespace keeps its own mark).
    const logo = templateLogoForName(name) ?? templateLogoForName(value);
    return {
      avatarUrl: logo ?? undefined,
      caption,
      full: value,
      initial: (name || value).charAt(0).toUpperCase(),
      isLogo: !!logo,
      name: name || value,
    };
  }

  const author = value.includes('/') ? value.split('/')[0] : undefined;
  const name = getModelShortName(value);
  // A model's own family often has a brand mark (`Qwen/...` → qwen.svg) where its HF org has no
  // avatar. The org photo is still preferred — it is the more specific of the two.
  const logo = templateLogoSrc(value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const orgAvatar = getAuthorAvatarUrl(author);
  return {
    avatarUrl: orgAvatar ?? logo ?? undefined,
    caption: author,
    full: value,
    initial: (author ?? name ?? value).charAt(0).toUpperCase(),
    isLogo: !orgAvatar && !!logo,
    name: name || value,
  };
}

const AVATAR_SIZE = 26;
const AVATAR_GAP = 8;
/* Gap between the end of the text block and the axis, so a full-width name doesn't touch its bar. */
const AXIS_GAP = 10;
const NAME_FONT_SIZE = 13;
const CAPTION_FONT_SIZE = 11;
/* SVG <text> has no text-overflow, so overflow has to be cut in JS: anything too wide is clipped by
   the axis viewport instead of ellipsized. ~0.62em per char is a safe over-estimate for this
   typeface at these weights (bold names run wider than the regular caption, hence the same factor
   for both rather than a tighter one for the caption). */
const CHAR_WIDTH_RATIO = 0.62;

/* Trailing ellipsis: the label reads left-to-right from a fixed left edge, so the cut belongs at the
   end, the way the table cell's `text-overflow: ellipsis` cuts it. */
function clampToWidth(value: string, available: number, fontSize: number): string {
  const maxChars = Math.floor(available / (fontSize * CHAR_WIDTH_RATIO));
  if (maxChars <= 1) {
    return '';
  }
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

type EntityTickProps = {
  /* Recharts injects these. */
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  /** Width reserved for the whole label (the YAxis `width`), so text can be clamped to fit. */
  width: number;
  kind: EntityKind;
};

/**
 * A category-axis tick that renders an avatar plus a two-line name, matching the model cells used in
 * the services table. Recharts ticks are SVG, so this is drawn with <image>/<text> rather than by
 * reusing the HTML ModelCell — a <foreignObject> would not size or clip predictably inside the axis
 * viewport, and the avatar has to sit in the same coordinate space as the tick itself.
 *
 * Laid out left-to-right from the gutter's own left edge (`x - width`), NOT backwards from the axis:
 * `x` is the axis line, so deriving the avatar's position by subtracting the text width from it put
 * the mark at a negative coordinate whenever the reserved gutter was wider than the text, and the
 * chart's viewport clipped it. Pinning to the left edge keeps every row's avatar on one vertical
 * line, which is what makes the column scannable.
 */
const EntityTick: React.FC<EntityTickProps> = ({ x = 0, y = 0, payload, width, kind }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  // One clip per tick: the rect is in user-space coordinates, so each row's clip differs and a shared
  // id would clip every mark to whichever row rendered last.
  // React 18's useId wraps its value in colons (`:r0:`), which `url(#…)` cannot reference — strip
  // them to anything id-safe.
  const clipId = `entity-tick-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const value = String(payload?.value ?? '');
  const label = toEntityLabel(value, kind);

  // Floored at 0, because `x` is where recharts puts the tick, which is a few px INSIDE the axis line
  // (its own tick offset), not the axis itself: `x - width` therefore lands slightly negative, and the
  // chart's <svg> is `overflow: hidden`, so the avatar had its left edge shaved off.
  const avatarX = Math.max(x - width, 0);
  const textStart = avatarX + AVATAR_SIZE + AVATAR_GAP;
  const textWidth = Math.max(x - AXIS_GAP - textStart, 0);
  const avatarY = y - AVATAR_SIZE / 2;
  const showAvatar = !!label.avatarUrl && !avatarFailed;

  // Only the truncated rows actually need the tooltip, but the clamp happens per line, so ask whether
  // either line lost characters rather than re-measuring here.
  const truncated =
    clampToWidth(label.name, textWidth, NAME_FONT_SIZE) !== label.name ||
    (!!label.caption && clampToWidth(label.caption, textWidth, CAPTION_FONT_SIZE) !== label.caption);

  return (
    <Tooltip followCursor title={truncated ? label.full : ''}>
      <g>
        {/* An invisible hit area over the whole label, so hovering the gap between avatar and text (or
            a short name's trailing space) still opens the tooltip — the glyphs alone are a thin target. */}
        <rect fill="transparent" height={AVATAR_SIZE} width={Math.max(x - avatarX, 0)} x={avatarX} y={avatarY} />
        {/* The tile is drawn under every mark, not just the monogram: it is the backplate the table cell
          gets from CSS, and a mark with its own transparent margins needs something to sit on. */}
        <rect
          fill="var(--background-glass-secondary)"
          height={AVATAR_SIZE}
          rx={7}
          width={AVATAR_SIZE}
          x={avatarX}
          y={avatarY}
        />
        {showAvatar ? (
          // Rounded through a referenced <clipPath> rather than a CSS `inset()` basic shape, which
          // Chromium does not apply to an SVG <image>. This is what the table cell gets from its tile's
          // `overflow: hidden`: without it a `slice`-cropped org photo would have square corners on a
          // rounded plate. The rect is in userSpaceOnUse coordinates, so it matches the tile exactly.
          <>
            <clipPath id={clipId}>
              <rect height={AVATAR_SIZE} rx={7} width={AVATAR_SIZE} x={avatarX} y={avatarY} />
            </clipPath>
            <image
              clipPath={`url(#${clipId})`}
              height={AVATAR_SIZE}
              href={label.avatarUrl}
              onError={() => setAvatarFailed(true)}
              // A brand mark carries its own margins, so letterbox it; an org photo fills the tile.
              preserveAspectRatio={label.isLogo ? 'xMidYMid meet' : 'xMidYMid slice'}
              width={AVATAR_SIZE}
              x={avatarX}
              y={avatarY}
            />
          </>
        ) : (
          <text
            dominantBaseline="central"
            fill="var(--text-secondary)"
            fontSize={12}
            fontWeight={600}
            textAnchor="middle"
            x={avatarX + AVATAR_SIZE / 2}
            y={y}
          >
            {label.initial}
          </text>
        )}
        {/* Two lines when there is a caption, otherwise a single centred name — the same shape rule the
          table cell follows, so a captionless row doesn't sit high in its band. */}
        <text
          fill="var(--text-primary)"
          fontSize={NAME_FONT_SIZE}
          fontWeight={600}
          textAnchor="start"
          x={textStart}
          y={label.caption ? y - 2 : y + 4}
        >
          {clampToWidth(label.name, textWidth, NAME_FONT_SIZE)}
        </text>
        {label.caption && (
          <text fill="var(--text-secondary)" fontSize={CAPTION_FONT_SIZE} textAnchor="start" x={textStart} y={y + 13}>
            {clampToWidth(label.caption, textWidth, CAPTION_FONT_SIZE)}
          </text>
        )}
      </g>
    </Tooltip>
  );
};

export default EntityTick;
