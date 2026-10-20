import { describe, expect, it } from 'vitest';
import type { SoundName } from './voices';
import { SOUNDS } from './voices';

const names = Object.keys(SOUNDS) as SoundName[];

describe('효과음', () => {
  it.each(names)('%s는 목소리가 하나 이상이고 모두 올바른 값이다', name => {
    const voices = SOUNDS[name](10);
    expect(voices.length).toBeGreaterThan(0);
    for (const voice of voices) {
      expect(voice.duration).toBeGreaterThan(0);
      expect(voice.volume).toBeGreaterThan(0);
      expect(voice.from).toBeGreaterThan(0);
    }
  });

  it('타격음은 세기가 클수록 길고 세게 맞으면 묵직한 울림이 더해진다', () => {
    const weak = SOUNDS.hit(3);
    const strong = SOUNDS.hit(14);
    expect(weak).toHaveLength(3);
    expect(strong).toHaveLength(5);
    expect(strong[0]?.duration).toBeGreaterThan(weak[0]?.duration ?? 0);
  });

  it('여러 음으로 이루어진 소리는 늦춤이 있다', () => {
    const win = SOUNDS.win(0);
    expect(win[3]?.delay).toBeCloseTo(0.42);
    expect(SOUNDS.fight(0)).toHaveLength(4);
  });
});
