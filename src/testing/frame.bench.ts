import { bench, describe } from 'vitest';
import { create } from '../ai';
import type { PadInput } from '../engine';
import { createEngine } from '../engine';

// 한 번의 측정에서 두는 프레임 수: 60프레임이 1초이므로 10초 분량이다.
const FRAMES_PER_RUN = 600;

// 가장 센 컴퓨터 둘이 10초 동안 싸운다. 판이 끝나면 새 판을 시작해 프레임 수를 채운다.
function playFrames(): void {
  const idle: Partial<PadInput> = {};
  const engine = createEngine();
  engine.toTitle();
  for (let i = 0; i < 25; i++) {
    engine.step([idle, idle]);
  }
  engine.step([{ A: 1 }, idle]);
  engine.newMatch('2p');
  const [first, second] = [create(engine, { level: 3 }), create(engine, { level: 3 })];
  for (let frame = 0; frame < FRAMES_PER_RUN; frame++) {
    engine.step([first(0), second(1)]);
    engine.consume();
  }
}

describe('프레임 속도', () => {
  bench('엔진과 컴퓨터 상대 600프레임', playFrames);
});
