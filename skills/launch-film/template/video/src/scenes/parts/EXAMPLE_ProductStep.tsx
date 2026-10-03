// EXAMPLE (not registered in the timeline): the canonical "product step" pattern used in the loop section.
// Copy into your own SNN.tsx and adapt. Shows: caption band + floating 3D app window over a real capture,
// a push-in aimed with rects.json coordinates, a spotlight + focus ring landing on a beat, a typing wipe
// between blank/typed captures, a cursor click, and a rebuilt house-style chip.
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  AppWindow,
  Backdrop,
  Cursor,
  FocusRing,
  FULL,
  MonoLabel,
  SceneEnvelope,
  ShotView,
  Spotlight,
  Words,
  focusAt,
  prog,
} from '../../design/primitives';
import { C, EASE } from '../../design/tokens';
import { FONT } from '../../design/fonts';
import { SceneProps, at } from '../../timeline';

// Window spec shared by every product step (keep identical across S05–S08 so the band/window never jump).
const WIN = { cx: 1040, cy: 300 + 675 / 2, w: 1200, h: 675, rotX: 3, rotY: -6 };
// Element boxes come from public/shots/<capture>.rects.json (viewport coordinates).
const INPUT = { x: 719, y: 243, w: 726, h: 48 }; // the textarea to "type" into
const CARD = { x: 482, y: 348, w: 395, h: 149 }; // the card the beat lands on

export const ExampleProductStep: React.FC<SceneProps> = ({ dur, start }) => {
  const frame = useCurrentFrame();
  const F = (t: number) => at(t, start); // absolute seconds → local frames

  // camera: wide → push onto the input (≤ ~2.2× zoom keeps 2× captures crisp)
  const focus = focusAt(frame, [
    { f: 0, rect: FULL },
    { f: F(start + 1.2), rect: { x: 560, y: 120, w: 1050, h: 590 }, ease: EASE.inOut },
  ]);
  const dolly = interpolate(frame, [0, dur], [1, 1.03]); // never fully static

  // typing: reveal the typed capture left→right inside the input rect
  const typed = prog(frame, F(start + 1.4), F(start + 3.0), (t) => t);
  const caretX = INPUT.x + 12 + (INPUT.w - 24) * typed;

  // the beat: spotlight + ring land on start+3.5 s
  const hit = prog(frame, F(start + 3.5), F(start + 3.5) + 12, EASE.out);

  return (
    <SceneEnvelope dur={dur} inDur={10} outDur={0}>
      <Backdrop />
      {/* caption band (identical position in every step) */}
      <AbsoluteFill style={{ padding: '96px 120px' }}>
        <MonoLabel>01 — Learns your system</MonoLabel>
        <div style={{ height: 14 }} />
        <Words text="It reads your [code, data] and experiments." size={56} align="left" start={6} />
      </AbsoluteFill>

      <AppWindow x={WIN.cx} y={WIN.cy} w={WIN.w} h={WIN.h} rotX={WIN.rotX} rotY={WIN.rotY} scale={dolly}>
        <ShotView src="shots/goal_blank.png" pw={WIN.w} ph={WIN.h} focus={focus}>
          {/* typed capture revealed inside the input only (identical geometry → pixel-exact) */}
          <div
            style={{
              position: 'absolute',
              left: INPUT.x,
              top: INPUT.y,
              width: INPUT.w,
              height: INPUT.h,
              overflow: 'hidden',
              clipPath: `inset(0 ${(1 - typed) * 100}% 0 0)`,
            }}
          >
            <Img
              src={staticFile('shots/goal_typed.png')}
              style={{ position: 'absolute', left: -INPUT.x, top: -INPUT.y, width: 1920, height: 1080 }}
            />
          </div>
          {typed > 0 && typed < 1 && (
            <div style={{ position: 'absolute', left: caretX, top: INPUT.y + 12, width: 2, height: 24, background: C.text }} />
          )}
          <Spotlight rect={CARD} progress={hit} />
          <FocusRing rect={CARD} progress={hit} />
        </ShotView>
      </AppWindow>

      {/* rebuilt house-style chip */}
      <div
        style={{
          position: 'absolute',
          left: 160,
          top: 820,
          padding: '10px 18px',
          borderRadius: 999,
          background: C.surface,
          border: `1px solid ${C.border}`,
          fontFamily: FONT.mono,
          fontSize: 24,
          color: C.text,
          opacity: hit,
        }}
      >
        <span style={{ color: C.accent }}>●</span> 4,869 artifacts read
      </div>

      <Cursor keys={[{ f: F(start + 3.0), x: 1700, y: 900 }, { f: F(start + 3.5), x: 1410, y: 560, click: true }]} />
    </SceneEnvelope>
  );
};
