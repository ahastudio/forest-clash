import { describe, expect, it } from 'vitest';
import type { Phase } from '../engine';
import { patch } from '../patch';
import { makeView } from '../testing/canvas';
import { Scene } from './scene';
import type { View } from './view';

/** 그릴 장면의 깃발: 캐릭터는 그 View의 엔진으로 그린다. */
const flagsOf = (view: View, changes: Partial<{ paused: boolean; showBoxes: boolean }> = {}) => ({
  world: view.engine,
  paused: false,
  showBoxes: false,
  version: 'v1',
  ...changes,
});

describe('장면', () => {
  it('타이틀에서는 로고와 안내를 그리고 체력 막대는 그리지 않는다', () => {
    const { view, canvas } = makeView();
    new Scene().draw(view, flagsOf(view));
    expect(canvas.texts().join('')).toContain('조작법');
    expect(canvas.texts()).not.toContain('ROUND 1');
  });

  const phases: [Phase, string][] = [
    ['intro', 'ROUND 1'],
    ['fight', '60'],
    ['ko', 'K.O.'],
    ['time', 'TIME UP'],
    ['over', '1P 승리!'],
  ];
  it.each(phases)('%s 단계에서는 %s를 보인다', (phase, text) => {
    const { view, canvas, engine } = makeView();
    patch(engine, {
      phase,
      phaseTime: 150,
      banner: phase === 'ko' ? 'K.O.' : 'TIME UP',
      matchWinner: 0,
      roundTimer: 3600,
    });
    new Scene().draw(view, flagsOf(view));
    expect(canvas.texts()).toContain(text);
  });

  it('결과 화면에서는 색종이가 떨어진다', () => {
    const { view, engine } = makeView();
    patch(engine, { phase: 'over', matchWinner: 0 });
    const scene = new Scene();
    scene.draw(view, flagsOf(view));
    expect(scene.effects.particles.length).toBeGreaterThan(0);
  });

  it('배경 그림이 있으면 그림을 그리고 없으면 초록 땅을 그린다', () => {
    const loaded = makeView();
    new Scene().draw(loaded.view, flagsOf(loaded.view));
    expect(loaded.canvas.of('drawImage').length).toBeGreaterThan(0);
    const loading = makeView({ loaded: false });
    new Scene().draw(loading.view, flagsOf(loading.view));
    expect(loading.canvas.calls.some(c => c[0] === 'set fillStyle' && c[1] === '#9bcd68')).toBe(true);
  });

  it('판정 상자 표시를 켜면 상자를 그린다', () => {
    const off = makeView();
    new Scene().draw(off.view, flagsOf(off.view));
    const on = makeView();
    new Scene().draw(on.view, flagsOf(on.view, { showBoxes: true }));
    expect(on.canvas.of('strokeRect').length).toBeGreaterThan(off.canvas.of('strokeRect').length);
  });

  it('일시정지 중에는 일시정지 화면과 버전을 보인다', () => {
    const { view, canvas } = makeView();
    new Scene().draw(view, flagsOf(view, { paused: true }));
    expect(canvas.texts()).toContain('일시정지');
    expect(canvas.texts()).toContain('버전 v1');
  });

  it('캐릭터는 flags의 world 엔진으로 그리고, 덮는 화면은 View의 엔진 단계로 고른다', () => {
    const shown = makeView();
    const other = makeView();
    patch(shown.engine, { phase: 'title' });
    const flags = { ...flagsOf(shown.view), world: other.engine };
    new Scene().draw(shown.view, flags);
    expect(shown.canvas.texts()).toContain('온라인');
  });
});
