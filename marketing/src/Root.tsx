import './index.css';
import { Composition } from 'remotion';
import { HeroLoop } from './HeroLoop';

// HeroLoop — 600×540 (matches AnimatedHeroIllustration viewBox), 30 fps,
// 240 frames = 8s. The composition is built as a perfect loop: frame 0
// and frame 240 render to identical pixels so `<video autoplay loop>`
// in the app has no visible jump between iterations.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroLoop"
        component={HeroLoop}
        durationInFrames={240}
        fps={30}
        width={600}
        height={540}
      />
    </>
  );
};
