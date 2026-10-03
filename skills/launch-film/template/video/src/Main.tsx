import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Backdrop, prog } from './design/primitives';
import { C, EASE } from './design/tokens';
import { FILM } from './film';
import { SCENES } from './scenes';
import { HAS_AUDIO, SCENE_IDS, SCENE_TIMES, SceneId, TAIL } from './timeline';

/**
 * Scene hand-off grammar (set per scene in scenes.json → "handoff"):
 * - 'dip'  (default): the whole scene layer blurs/fades out over its last `exit` frames, finishing exactly on the
 *          boundary; the next scene rises in over its own fade-in. Two text layers never share the screen.
 * - 'xfade': the scene keeps running TAIL frames under the next scene's fade-in (only when both share a background).
 * - 'cut'  : the scene ends on the boundary (it resolves to black itself, or the next scene starts on a hard cut).
 * A shared base backdrop sits underneath everything, so hand-offs never flash to pure black.
 */
const DEFAULT_EXIT = 7;
const f = (s: number) => Math.round(s * FILM.fps);

/** The `dur` each scene is authored against (nominal + TAIL, none for the last scene). */
export const seqLen = (id: SceneId) => {
  const t = SCENE_TIMES[id];
  const last = SCENE_IDS[SCENE_IDS.length - 1] === id;
  return f(t.end - t.start) + (last ? 0 : TAIL);
};

/** Frames the scene actually occupies in the master timeline. */
const occupied = (id: SceneId) => {
  const t = SCENE_TIMES[id];
  return f(t.end - t.start) + (t.handoff === 'xfade' ? TAIL : 0);
};

const Exit: React.FC<{ nominal: number; exit: number; children: React.ReactNode }> = ({ nominal, exit, children }) => {
  const frame = useCurrentFrame();
  const t = prog(frame, nominal - exit, nominal, EASE.in);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - t,
        filter: t > 0 ? `blur(${t * 10}px)` : undefined,
        transform: t > 0 ? `scale(${1 + t * 0.012})` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <Backdrop />
    {SCENE_IDS.map((id) => {
      const t = SCENE_TIMES[id];
      const Scene = SCENES[id];
      const nominal = f(t.end - t.start);
      const scene = <Scene dur={seqLen(id)} start={t.start} />;
      const exit = 'exit' in t && typeof t.exit === 'number' ? t.exit : DEFAULT_EXIT;
      return (
        <Sequence key={id} name={`${id} · ${t.title}`} from={f(t.start)} durationInFrames={occupied(id)}>
          {t.handoff === 'dip' ? (
            <Exit nominal={nominal} exit={exit}>
              {scene}
            </Exit>
          ) : (
            scene
          )}
        </Sequence>
      );
    })}
    {HAS_AUDIO && <Audio src={staticFile('audio/score.wav')} />}
  </AbsoluteFill>
);
