import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { makeView } from '../testing/canvas';
import { drawDebugBoxes, drawFighter } from './fighters';

describe('캐릭터 그리기', () => {
  it('그림자를 먼저 그리고 그림을 바라보는 방향으로 그린다', () => {
    const { view, canvas, engine } = makeView();
    const fighter = engine.fighters[1];
    patch(fighter, { x: 400, face: -1 });
    drawFighter(view, fighter);
    expect(canvas.of('ellipse')).toHaveLength(1);
    expect(canvas.of('translate')[0]).toEqual([400, 452]);
    expect(canvas.of('scale')[0]).toEqual([-1, 1]);
    expect(canvas.of('drawImage')).toHaveLength(1);
    expect(canvas.last('filter')).toBe('none');
  });

  it('높이 떠 있을수록 그림자가 작고 옅다', () => {
    const near = makeView();
    drawFighter(near.view, near.engine.fighters[1]);
    const far = makeView();
    patch(far.engine.fighters[1], { altitude: 160 });
    drawFighter(far.view, far.engine.fighters[1]);
    const nearWidth = Number(near.canvas.of('ellipse')[0]?.[2]);
    const farWidth = Number(far.canvas.of('ellipse')[0]?.[2]);
    expect(farWidth).toBeLessThan(nearWidth);
  });

  it('그림을 아직 못 불렀으면 그림자만 그린다', () => {
    const { view, canvas, engine } = makeView({ loaded: false });
    drawFighter(view, engine.fighters[0]);
    expect(canvas.of('ellipse')).toHaveLength(1);
    expect(canvas.of('drawImage')).toHaveLength(0);
  });

  it('맞은 직후에는 찌그러지고 번쩍인다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine.fighters[1], { hurtFlash: 8 });
    drawFighter(view, engine.fighters[1]);
    expect(canvas.of('scale')).toHaveLength(2);
    expect(canvas.calls.some(c => c[0] === 'set filter' && c[1] === 'brightness(2)')).toBe(true);
  });

  it('맞은 지 오래되지 않았으면 번쩍이지 않는다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine.fighters[1], { hurtFlash: 3 });
    drawFighter(view, engine.fighters[1]);
    expect(canvas.calls.some(c => c[0] === 'set filter' && c[1] === 'brightness(2)')).toBe(false);
    expect(canvas.of('scale')).toHaveLength(2);
  });

  it('무적 동안에는 세 프레임마다 반투명하게 깜빡인다', () => {
    const blink = makeView();
    patch(blink.engine, { frame: 3 });
    patch(blink.engine.fighters[1], { invincibleFrames: 5 });
    drawFighter(blink.view, blink.engine.fighters[1]);
    expect(blink.canvas.calls.some(c => c[0] === 'set globalAlpha' && c[1] === 0.55)).toBe(true);
    const solid = makeView();
    patch(solid.engine.fighters[1], { invincibleFrames: 5 });
    drawFighter(solid.view, solid.engine.fighters[1]);
    expect(solid.canvas.calls.some(c => c[0] === 'set globalAlpha' && c[1] === 0.55)).toBe(false);
  });

  it('분노 게이지가 가득이면 주황빛이 맥동한다', () => {
    const { view, canvas, engine } = makeView({ now: 0 });
    patch(engine.fighters[1], { rage: 100 });
    drawFighter(view, engine.fighters[1]);
    expect(canvas.calls.some(c => c[0] === 'set fillStyle' && c[1] === '#ff8a3a')).toBe(true);
    const calm = makeView();
    drawFighter(calm.view, calm.engine.fighters[1]);
    expect(calm.canvas.calls.some(c => c[0] === 'set fillStyle' && c[1] === '#ff8a3a')).toBe(false);
  });
});

describe('판정 상자 표시', () => {
  it('맞을 수 있는 상자와 공격 상자, 기준점, 바닥선을 그린다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine.fighters[1], { state: 'attack', moveId: 'a5', elapsed: 3 });
    drawDebugBoxes(view);
    expect(canvas.of('fillRect').length).toBeGreaterThanOrEqual(5);
    expect(canvas.of('strokeRect').length).toBeGreaterThanOrEqual(4);
    expect(canvas.of('lineTo')).toEqual([[1200, 452]]);
  });

  it('공격하지 않으면 공격 상자는 없다', () => {
    const { view, canvas } = makeView();
    drawDebugBoxes(view);
    expect(canvas.of('strokeRect')).toHaveLength(2);
  });
});
