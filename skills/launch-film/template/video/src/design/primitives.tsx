import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C, EASE, H, W } from './tokens';
import { FONT } from './fonts';
import { FALLBACK_SRC, PATHS, VIEWBOX } from './logo';

// ============================================================================
// Small math helpers
// ============================================================================
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** eased 0→1 progress between frames [a, b] */
export const prog = (frame: number, a: number, b: number, ease = EASE.out) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type Rect = { x: number; y: number; w: number; h: number };
export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  w: mix(a.w, b.w, t),
  h: mix(a.h, b.h, t),
});
/** Full 1920×1080 viewport of a product capture */
export const FULL: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

export type FocusKey = { f: number; rect: Rect; ease?: (t: number) => number };
/** Interpolate a camera rect through keyframes (frame-local). */
export const focusAt = (frame: number, keys: FocusKey[]): Rect => {
  if (frame <= keys[0].f) return keys[0].rect;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = prog(frame, a.f, b.f, b.ease ?? EASE.inOut);
      return lerpRect(a.rect, b.rect, t);
    }
  }
  return keys[keys.length - 1].rect;
};

// ============================================================================
// Backgrounds
// ============================================================================

/** Animated film grain (deterministic: seed changes every 2 frames). */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 97;
  const id = `grain-${seed}`;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Dot-field pattern (a common tech-brand motif). Fades towards edges via radial mask. */
export const DotField: React.FC<{
  gap?: number;
  size?: number;
  color?: string;
  opacity?: number;
  drift?: number; // px per frame
  mask?: string;
}> = ({ gap = 28, size = 1.4, color = 'rgba(253,254,251,0.16)', opacity = 1, drift = 0.15, mask }) => {
  const frame = useCurrentFrame();
  const off = (frame * drift) % gap;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `radial-gradient(circle, ${color} ${size}px, transparent ${size + 0.6}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        backgroundPosition: `${off}px ${off * 0.4}px`,
        WebkitMaskImage: mask ?? 'radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 100%)',
        maskImage: mask ?? 'radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 100%)',
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.6 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** Soft radial light blob. */
export const Glow: React.FC<{ x?: number; y?: number; r?: number; color?: string; opacity?: number }> = ({
  x = W / 2,
  y = H / 2,
  r = 700,
  color = C.brand,
  opacity = 0.55,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - r,
      top: y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity,
      filter: 'blur(20px)',
    }}
  />
);

/**
 * Standard backdrop: deep ink base with a soft brand-colour glow, optional dot field, grain and vignette.
 * tone: 'base' (default near-black), 'brand' (brand-tinted), 'app' (flat product-UI black).
 */
export const Backdrop: React.FC<{
  tone?: 'base' | 'brand' | 'app';
  dots?: boolean;
  glow?: boolean;
  grain?: number;
  vignette?: number;
  children?: React.ReactNode;
}> = ({ tone = 'base', dots = true, glow = true, grain = 0.07, vignette = 0.55, children }) => {
  const base =
    tone === 'brand'
      ? `radial-gradient(ellipse 90% 80% at 50% 45%, ${C.brandDeep} 0%, ${C.ink} 75%)`
      : tone === 'app'
        ? C.appBg
        : `radial-gradient(ellipse 90% 80% at 50% 45%, ${C.bg2} 0%, ${C.ink} 75%)`;
  return (
    <AbsoluteFill style={{ background: base, overflow: 'hidden' }}>
      {glow && <Glow y={H * 0.55} r={900} color={tone === 'brand' ? C.brand : C.brandDeep} opacity={0.5} />}
      {dots && <DotField />}
      {children}
      <Vignette strength={vignette} />
      {grain > 0 && <Grain opacity={grain} />}
    </AbsoluteFill>
  );
};

// ============================================================================
// Typography
// ============================================================================

type Token = { text: string; hl: boolean; suffix?: string };
// "[word]." -> pill token "word" with suffix "." rendered tight after the pill (no word gap).
const tokenize = (text: string): Token[] => {
  const out: Token[] = [];
  const re = /\[([^\]]+)\]([^\s\[]*)|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) out.push({ text: m[1], hl: true, suffix: m[2] || undefined });
    else out.push({ text: m[3], hl: false });
  }
  return out;
};

/**
 * Kinetic line of text. Words rise + unblur in sequence. Wrap words in [brackets] to give them the
 * house "pill" highlight (cream pill sweeps in behind, text flips to ink).
 * All frames are LOCAL to the enclosing Sequence.
 */
export const Words: React.FC<{
  text: string;
  start?: number;
  stagger?: number; // frames between words
  dur?: number; // per-word animation frames
  size?: number;
  weight?: number;
  color?: string;
  font?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  lineHeight?: number;
  tracking?: string;
  exitAt?: number; // local frame to start exit
  exitDur?: number;
  hlColor?: string;
  hlText?: string;
  style?: React.CSSProperties;
}> = ({
  text,
  start = 0,
  stagger = 3,
  dur = 16,
  size = 64,
  weight = 400,
  color = C.text,
  font = FONT.sans,
  align = 'center',
  maxWidth = 1500,
  lineHeight = 1.15,
  tracking = '-0.02em',
  exitAt,
  exitDur = 12,
  hlColor = C.text,
  hlText = C.ink,
  style,
}) => {
  const frame = useCurrentFrame();
  const toks = tokenize(text);
  const exitT = exitAt === undefined ? 0 : prog(frame, exitAt, exitAt + exitDur, EASE.in);
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        textAlign: align,
        lineHeight,
        letterSpacing: tracking,
        maxWidth,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        columnGap: '0.26em',
        rowGap: '0.12em',
        opacity: 1 - exitT,
        filter: exitT > 0 ? `blur(${exitT * 10}px)` : undefined,
        transform: exitT > 0 ? `translateY(${-exitT * 18}px)` : undefined,
        ...style,
      }}
    >
      {toks.map((t, i) => {
        const s = start + i * stagger;
        const p = prog(frame, s, s + dur, EASE.out);
        const pill = t.hl ? prog(frame, s + dur * 0.35, s + dur * 0.35 + 12, EASE.snap) : 0;
        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${(1 - p) * 0.38}em)`,
              filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined,
              whiteSpace: 'pre',
            }}
          >
            {t.hl ? (
              <span style={{ position: 'relative', display: 'inline-block', padding: '0 0.22em', margin: '0 -0.05em' }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: '0.04em 0 -0.02em 0',
                    background: hlColor,
                    borderRadius: '0.16em',
                    transform: `scaleX(${pill})`,
                    transformOrigin: 'left center',
                    boxShadow: pill > 0 ? '0 8px 40px rgba(253,254,251,0.12)' : undefined,
                  }}
                />
                {/* two layers: base text in the caption colour, and an ink copy clipped to the pill's sweep edge,
                    so the colour flips exactly where the pill is (no dark-on-dark letters mid-sweep) */}
                <span style={{ position: 'relative', color }}>{t.text}</span>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    padding: '0 0.22em',
                    color: hlText,
                    clipPath: `inset(0 ${(1 - pill) * 100}% 0 0)`,
                  }}
                >
                  {t.text}
                </span>
              </span>
            ) : (
              <span style={{ position: 'relative', color }}>{t.text}</span>
            )}
            {t.suffix && <span style={{ position: 'relative', color, marginLeft: '0.06em' }}>{t.suffix}</span>}
          </span>
        );
      })}
    </div>
  );
};

/** Uppercase mono micro-label, e.g. "WHAT IT LEARNS FROM" */
export const MonoLabel: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
  tracking?: string;
  style?: React.CSSProperties;
}> = ({ children, color = C.muted, size = 18, tracking = '0.14em', style }) => (
  <div
    style={{
      fontFamily: FONT.mono,
      fontSize: size,
      letterSpacing: tracking,
      textTransform: 'uppercase',
      color,
      fontWeight: 500,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Static pill (cream on ink by default) */
export const Pill: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; style?: React.CSSProperties }> = ({
  children,
  bg = C.text,
  fg = C.ink,
  style,
}) => (
  <span style={{ background: bg, color: fg, borderRadius: '0.18em', padding: '0.02em 0.26em', ...style }}>{children}</span>
);

/** Number tween. Renders inline text. */
export const CountUp: React.FC<{
  from: number;
  to: number;
  start: number;
  dur: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  ease?: (t: number) => number;
  thousands?: boolean;
}> = ({ from, to, start, dur, decimals = 0, prefix = '', suffix = '', ease = EASE.out, thousands = true }) => {
  const frame = useCurrentFrame();
  const v = mix(from, to, prog(frame, start, start + dur, ease));
  const s = thousands
    ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : v.toFixed(decimals);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {s}
      {suffix}
    </span>
  );
};

/** Typewriter text with blinking caret (caret blinks on the beat: 15f). */
export const Typewriter: React.FC<{
  text: string;
  start: number;
  cps?: number; // characters per second
  caret?: boolean;
  caretColor?: string;
  style?: React.CSSProperties;
}> = ({ text, start, cps = 28, caret = true, caretColor = C.text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((frame - start) / fps) * cps));
  const shown = text.slice(0, Math.min(n, text.length));
  const typing = n < text.length && frame >= start;
  const on = typing || Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={style}>
      {shown}
      {caret && (
        <span
          style={{
            display: 'inline-block',
            width: '0.06em',
            height: '1.05em',
            marginLeft: '0.04em',
            verticalAlign: '-0.15em',
            background: caretColor,
            opacity: on ? 1 : 0,
          }}
        />
      )}
    </span>
  );
};

// ============================================================================
// Product UI: windows + camera over 4K captures
// ============================================================================

/**
 * Shows a product capture (e.g. a 3840×2160 PNG of a 1920×1080 viewport at 2× DPR) inside a box of size pw×ph,
 * framed on `focus` (a rect in VIEWPORT coordinates — the same space as <capture>.rects.json; cover-fit).
 * Children are overlays positioned in the SAME viewport coordinates (they follow the camera).
 * Stay at ≤ ~2.2× zoom (pw / focus.w) for 2× captures, or they go soft.
 */
export const ShotView: React.FC<{
  src: string; // relative to public/, e.g. 'shots/home.png'
  pw: number;
  ph: number;
  focus?: Rect;
  vw?: number; // capture viewport width (CSS px)
  vh?: number; // capture viewport height (CSS px)
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ src, pw, ph, focus = FULL, vw = 1920, vh = 1080, children, style }) => {
  const s = Math.max(pw / focus.w, ph / focus.h);
  const tx = -focus.x * s + (pw - focus.w * s) / 2;
  const ty = -focus.y * s + (ph - focus.h * s) / 2;
  return (
    <div style={{ position: 'relative', width: pw, height: ph, overflow: 'hidden', background: C.appBg, ...style }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: vw,
          height: vh,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        }}
      >
        <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh }} />
        {children}
      </div>
    </div>
  );
};

/**
 * A floating app window (rounded, hairline border, deep shadow) positioned in the 1920×1080 frame,
 * with optional 3D tilt. Put a <ShotView pw={w} ph={h}/> (or any UI) inside.
 */
export const AppWindow: React.FC<{
  x?: number; // center x
  y?: number; // center y
  w: number;
  h: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  opacity?: number;
  radius?: number;
  perspective?: number;
  glow?: string; // color of outer glow
  blur?: number;
  children: React.ReactNode;
}> = ({
  x = W / 2,
  y = H / 2,
  w,
  h,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  scale = 1,
  opacity = 1,
  radius = 18,
  perspective = 2400,
  glow,
  blur = 0,
  children,
}) => (
  <AbsoluteFill style={{ perspective, perspectiveOrigin: `${x}px ${y}px` }}>
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: radius,
        overflow: 'hidden',
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`,
        boxShadow: `0 0 0 1px rgba(253,254,251,0.10), 0 50px 140px rgba(0,0,0,0.75)${
          glow ? `, 0 0 120px ${glow}` : ''
        }`,
      }}
    >
      {children}
      {/* top sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 18%)',
        }}
      />
    </div>
  </AbsoluteFill>
);

/**
 * Overlay (inside ShotView, viewport coords): dims everything outside `rect` and draws a glowing ring.
 * progress 0→1 controls the effect.
 */
export const Spotlight: React.FC<{
  rect: Rect;
  progress: number;
  radius?: number;
  dim?: number;
  ring?: string;
}> = ({ rect, progress, radius = 12, dim = 0.62, ring = C.accent }) => (
  <div
    style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: radius,
      boxShadow: `0 0 0 4000px rgba(0,0,0,${dim * progress}), 0 0 0 ${1.5 * progress}px ${ring}, 0 0 ${
        30 * progress
      }px ${ring}55`,
      pointerEvents: 'none',
    }}
  />
);

/** Rounded rect outline that draws itself on (viewport coords, inside ShotView or a positioned parent). */
export const FocusRing: React.FC<{ rect: Rect; progress: number; color?: string; radius?: number; width?: number }> = ({
  rect,
  progress,
  color = C.accent,
  radius = 12,
  width = 2,
}) => {
  const per = 2 * (rect.w + rect.h);
  return (
    <svg
      style={{ position: 'absolute', left: rect.x - 4, top: rect.y - 4, overflow: 'visible' }}
      width={rect.w + 8}
      height={rect.h + 8}
    >
      <rect
        x={4}
        y={4}
        width={rect.w}
        height={rect.h}
        rx={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={per}
        strokeDashoffset={per * (1 - progress)}
        style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
      />
    </svg>
  );
};

// ============================================================================
// Lines & connectors
// ============================================================================

/**
 * SVG path that draws on. Set dashed for the house dashed-connector look (draw-on handled via mask).
 * Coordinates are in the 1920×1080 frame unless placed in another positioned parent.
 */
export const Connector: React.FC<{
  d: string;
  progress: number;
  color?: string;
  width?: number;
  dashed?: boolean;
  dash?: string;
  id: string;
  flow?: number; // animate dash offset (px/frame) for "data flowing" feel
}> = ({ d, progress, color = 'rgba(253,254,251,0.45)', width = 1.5, dashed = true, dash = '6 7', id, flow = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
          <path
            d={d}
            pathLength={1}
            stroke="white"
            strokeWidth={width + 8}
            fill="none"
            strokeDasharray="1 1"
            strokeDashoffset={1 - clamp01(progress)}
          />
        </mask>
      </defs>
      <path
        d={d}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeDasharray={dashed ? dash : undefined}
        strokeDashoffset={-frame * flow}
        mask={`url(#m-${id})`}
        strokeLinecap="round"
      />
    </svg>
  );
};

// ============================================================================
// Brand
// ============================================================================

/**
 * Brand mark from logo.ts. `draw` 0→1 traces the outline; `fill` 0→1 fades the solid in. Size in px.
 * Falls back to an <Img> of FALLBACK_SRC (fade only) when no vector paths are provided.
 */
export const BrandMark: React.FC<{
  size?: number;
  color?: string;
  draw?: number;
  fill?: number;
  strokeWidth?: number; // in viewBox units
  style?: React.CSSProperties;
}> = ({ size = 160, color = C.text, draw = 1, fill = 1, strokeWidth, style }) => {
  if (!PATHS.length) {
    return (
      <Img
        src={staticFile(FALLBACK_SRC)}
        style={{ width: size, height: size, objectFit: 'contain', opacity: Math.max(clamp01(draw) * 0.4, clamp01(fill)), ...style }}
      />
    );
  }
  const vbW = Number(VIEWBOX.split(/[ ,]+/)[2]) || 100;
  const sw = strokeWidth ?? vbW / 200;
  return (
    <svg width={size} height={size} viewBox={VIEWBOX} style={style}>
      {PATHS.map((d, i) => (
        <path key={`f${i}`} d={d} fill={color} fillOpacity={fill} fillRule="evenodd" />
      ))}
      {draw < 1 || fill < 1
        ? PATHS.map((d, i) => (
            <path
              key={`s${i}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - clamp01(draw)}
              opacity={1 - fill}
            />
          ))
        : null}
    </svg>
  );
};

// ============================================================================
// Cursor
// ============================================================================
export type CursorKey = { f: number; x: number; y: number; click?: boolean };
/** macOS-like pointer gliding through keyframes (frame-local, frame coords). Click ripples on keys with click:true. */
export const Cursor: React.FC<{ keys: CursorKey[]; scale?: number; color?: string }> = ({
  keys,
  scale = 1.4,
  color = C.text,
}) => {
  const frame = useCurrentFrame();
  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.f && frame <= b.f) {
      const t = prog(frame, a.f, b.f, EASE.inOut);
      x = mix(a.x, b.x, t);
      y = mix(a.y, b.y, t);
    } else if (frame > b.f) {
      x = b.x;
      y = b.y;
    }
  }
  const clicks = keys.filter((k) => k.click);
  const press = clicks.reduce((acc, k) => {
    const d = frame - k.f;
    return d >= 0 && d < 8 ? Math.max(acc, 1 - Math.abs(d - 3) / 4) : acc;
  }, 0);
  return (
    <>
      {clicks.map((k, i) => {
        const d = frame - k.f;
        if (d < 0 || d > 20) return null;
        const p = d / 20;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: k.x - 30 * p - 6,
              top: k.y - 30 * p - 6,
              width: 60 * p + 12,
              height: 60 * p + 12,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              opacity: 1 - p,
            }}
          />
        );
      })}
      <svg
        width={24 * scale}
        height={30 * scale}
        viewBox="0 0 24 30"
        style={{ position: 'absolute', left: x - 3 * scale, top: y - 2 * scale, transform: `scale(${1 - press * 0.12})`, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
      >
        <path d="M3 2 L3 24 L9 18.5 L13 27.5 L16.5 26 L12.6 17.2 L20.5 17.2 Z" fill={color} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

// ============================================================================
// Scene envelope
// ============================================================================

/**
 * Wrap a scene's content: fades/blurs in over `inDur` frames and out over the last `outDur` frames.
 */
export const SceneEnvelope: React.FC<{
  dur: number; // scene length in frames (pass the scene's durationInFrames)
  inDur?: number;
  outDur?: number;
  blur?: number;
  children: React.ReactNode;
}> = ({ dur, inDur = 8, outDur = 8, blur = 8, children }) => {
  const frame = useCurrentFrame();
  const durationInFrames = dur;
  const a = inDur > 0 ? prog(frame, 0, inDur, EASE.out) : 1;
  const b = outDur > 0 ? 1 - prog(frame, durationInFrames - outDur, durationInFrames, EASE.in) : 1;
  const o = Math.min(a, b);
  return (
    <AbsoluteFill style={{ opacity: o, filter: o < 1 && blur > 0 ? `blur(${(1 - o) * blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/** Deterministic pseudo-random in [0,1) */
export const rnd = (seed: string | number) => random(`film-${seed}`);

/** Centered flex container helper */
export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>{children}</AbsoluteFill>
);
