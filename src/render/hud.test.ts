import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { makeView } from '../testing/canvas';
import { Hud } from './hud';

describe('체력 막대와 시계', () => {
  it('양쪽의 막대, 초상화, 시계, 라운드를 그린다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { roundTimer: 3600 });
    new Hud().draw(view);
    expect(canvas.texts()).toContain('ROUND 1');
    expect(canvas.texts()).toContain('60');
    expect(canvas.of('drawImage')).toHaveLength(2);
    expect(canvas.last('textAlign')).toBe('left');
  });

  it('오른쪽 막대는 좌우로 뒤집어 그린다', () => {
    const { view, canvas } = makeView();
    new Hud().draw(view);
    expect(canvas.of('scale').filter(args => args[0] === -1)).toHaveLength(1);
  });

  it('남은 초는 올림하고 10초 안쪽이면 붉은 시계판이다', () => {
    const calm = makeView();
    patch(calm.engine, { roundTimer: 61 });
    new Hud().draw(calm.view);
    expect(calm.canvas.texts()).toContain('2');
    const warn = makeView();
    patch(warn.engine, { roundTimer: 599 });
    new Hud().draw(warn.view);
    const stops = warn.canvas.calls.filter(c => c[0] === 'createLinearGradient');
    expect(stops.length).toBeGreaterThan(0);
    expect(warn.canvas.texts()).toContain('10');
  });

  it('시간이 음수가 되어도 0으로 보인다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { roundTimer: -5 });
    new Hud().draw(view);
    expect(canvas.texts()).toContain('0');
  });

  it('맞은 체력은 한 프레임에 0.5씩 천천히 줄어든다', () => {
    const hud = new Hud();
    const first = makeView();
    hud.draw(first.view);
    first.engine.fighters[0].hp = 80;
    const second = makeView();
    patch(second.engine.fighters[0], { hp: 80 });
    hud.draw(second.view);
    const widths = second.canvas.of('fillRect').map(args => Number(args[2]));
    expect(widths).toContain(340 * (99.5 / 100));
  });

  it('체력이 다시 차면 곧바로 따라간다', () => {
    const hud = new Hud();
    const low = makeView();
    patch(low.engine.fighters[1], { hp: 40 });
    hud.draw(low.view);
    const full = makeView();
    hud.draw(full.view);
    expect(full.canvas.of('fillRect').map(args => Number(args[2]))).toContain(340);
  });

  it('체력이 어떤 값이어도 막대를 그린다', () => {
    for (const hp of [100, 40, 10]) {
      const { view, canvas, engine } = makeView();
      patch(engine.fighters[1], { hp });
      new Hud().draw(view);
      expect(canvas.of('createLinearGradient').length).toBeGreaterThan(0);
    }
  });

  it('분노 게이지가 가득이면 시각에 따라 막대 색이 번갈아 바뀐다', () => {
    const stopsAt = (now: number): string[] => {
      const { view, canvas, engine } = makeView({ now });
      patch(engine.fighters[1], { rage: 100 });
      new Hud().draw(view);
      return canvas.calls.flatMap(call =>
        call[0] === 'set fillStyle' && typeof call[1] === 'object'
          ? (call[1] as { stops: [number, string][] }).stops.map(stop => stop[1])
          : [],
      );
    };
    const orange = stopsAt(0);
    const yellow = stopsAt(140);
    expect(orange).toContain('#ff8a00');
    expect(yellow).toContain('#ffb300');
    expect(orange).not.toContain('#ffb300');
  });

  it('이긴 판 수만큼 동그라미가 채워진다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { wins: [1, 2] });
    new Hud().draw(view);
    const gold = canvas.calls.filter(c => c[0] === 'set fillStyle' && c[1] === '#ffd54a');
    expect(gold.length).toBeGreaterThanOrEqual(3);
  });

  it('초상화 그림을 아직 못 불렀으면 바탕색만 그린다', () => {
    const { view, canvas } = makeView({ loaded: false });
    new Hud().draw(view);
    expect(canvas.of('drawImage')).toHaveLength(0);
    expect(canvas.of('clip').length).toBeGreaterThan(0);
  });

  it('콤보는 두 번 이상 맞혔을 때 숫자와 HIT를 크게 보인다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { comboCount: [3, 0], comboTimer: [70, 0] });
    new Hud().draw(view);
    expect(canvas.texts()).toContain('3');
    expect(canvas.texts()).toContain('HIT');
    const none = makeView();
    patch(none.engine, { comboCount: [1, 0] });
    new Hud().draw(none.view);
    expect(none.canvas.texts()).not.toContain('HIT');
  });

  it('두 번째 캐릭터의 콤보는 왼쪽에 보인다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { comboCount: [0, 4], comboTimer: [0, 30] });
    new Hud().draw(view);
    expect(canvas.of('translate').some(args => args[0] === 120 && args[1] === 190)).toBe(true);
    expect(canvas.of('rotate')[0]).toEqual([-0.06]);
  });
});
