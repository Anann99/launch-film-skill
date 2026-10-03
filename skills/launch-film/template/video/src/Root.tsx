// film.ts, timeline.ts, scenes/index.ts, scenes/SNN.tsx stubs and entries/* are GENERATED from scenes.json by
// tools/scaffold.mjs (runs automatically on `npm i`; re-run with `npm run scaffold` after editing scenes.json).
import React from 'react';
import { Composition } from 'remotion';
import { FILM } from './film';
import { Main, seqLen } from './Main';
import { SCENES } from './scenes';
import { SCENE_IDS, SCENE_TIMES } from './timeline';
import './design/fonts';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Main"
      component={Main}
      durationInFrames={Math.round(FILM.duration * FILM.fps)}
      fps={FILM.fps}
      width={FILM.width}
      height={FILM.height}
    />
    {SCENE_IDS.map((id) => {
      const Scene = SCENES[id];
      const len = seqLen(id);
      const Wrapped: React.FC = () => <Scene dur={len} start={SCENE_TIMES[id].start} />;
      return <Composition key={id} id={id} component={Wrapped} durationInFrames={len} fps={FILM.fps} width={FILM.width} height={FILM.height} />;
    })}
  </>
);
