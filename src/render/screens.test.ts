import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import { makeView } from '../testing/canvas';
import { drawIntro, drawResult, drawRoundEnd, drawTitle } from './screens';

describe('타이틀', () => {
  it('로고와 시작 안내가 있고 안내는 깜빡인다', () => {
    const on = makeView();
    patch(on.engine, { phaseTime: 0 });
    drawTitle(on.view);
    expect(on.canvas.of('drawImage')).toHaveLength(1);
    expect(on.canvas.texts()).toContain('아무 공격 버튼이나 눌러 시작');
    const off = makeView();
    patch(off.engine, { phaseTime: 30 });
    drawTitle(off.view);
    expect(off.canvas.texts()).not.toContain('아무 공격 버튼이나 눌러 시작');
    expect(off.canvas.texts().join('')).toContain('조작법');
  });

  it('로고 그림을 아직 못 불렀으면 글자로 대신한다', () => {
    const { view, canvas } = makeView({ loaded: false });
    drawTitle(view);
    expect(canvas.texts()).toContain('숲속대전');
    expect(canvas.of('drawImage')).toHaveLength(0);
  });
});

describe('라운드 안내', () => {
  it('시작 때는 ROUND, 마지막 45프레임은 FIGHT!', () => {
    const calling = makeView();
    patch(calling.engine, { phaseTime: 100, round: 2 });
    drawIntro(calling.view);
    expect(calling.canvas.texts()).toEqual(['ROUND 2']);
    const fight = makeView();
    patch(fight.engine, { phaseTime: 20 });
    drawIntro(fight.view);
    expect(fight.canvas.texts()).toEqual(['FIGHT!']);
  });

  it('K.O.와 이긴 쪽을 알린다', () => {
    const { view, canvas, engine } = makeView();
    patch(engine, { banner: 'K.O.', phaseTime: 100, wins: [0, 1] });
    drawRoundEnd(view);
    expect(canvas.texts()).toEqual(['K.O.', '2P 승!']);
  });

  it('1P가 이겼을 때와 비겼을 때, 안내가 길어졌을 때', () => {
    const first = makeView();
    patch(first.engine, { banner: 'TIME UP', phaseTime: 50, wins: [1, 0] });
    drawRoundEnd(first.view);
    expect(first.canvas.texts()).toEqual(['TIME UP', '1P 승!']);
    const draw = makeView();
    patch(draw.engine, { banner: 'TIME UP', phaseTime: 50, wins: [1, 1] });
    drawRoundEnd(draw.view);
    expect(draw.canvas.texts()).toEqual(['TIME UP']);
    const late = makeView();
    patch(late.engine, { banner: 'K.O.', phaseTime: 150, wins: [1, 0] });
    drawRoundEnd(late.view);
    expect(late.canvas.texts()).toEqual(['K.O.']);
  });

  it('안내 문구가 없으면 아무것도 그리지 않는다', () => {
    const { view, canvas } = makeView();
    drawRoundEnd(view);
    expect(canvas.calls).toHaveLength(0);
  });
});

describe('결과 화면', () => {
  it('이긴 쪽을 보이고 120프레임 뒤부터 깜빡이는 안내가 나온다', () => {
    const early = makeView();
    patch(early.engine, { matchWinner: 0, phaseTime: 10 });
    drawResult(early.view);
    expect(early.canvas.texts()).toEqual(['1P 승리!']);
    const late = makeView();
    patch(late.engine, { matchWinner: 1, phaseTime: 130 });
    drawResult(late.view);
    expect(late.canvas.texts()).toEqual(['2P 승리!', '아무 공격 버튼을 누르면 타이틀로']);
    const blinkOff = makeView();
    patch(blinkOff.engine, { matchWinner: 1, phaseTime: 165 });
    drawResult(blinkOff.view);
    expect(blinkOff.canvas.texts()).toEqual(['2P 승리!']);
  });
});
