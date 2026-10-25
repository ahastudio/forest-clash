import { describe, expect, it } from 'vitest';
import { MENU_BUTTONS } from '../menu';
import { patch } from '../patch';
import { makeView } from '../testing/canvas';
import { SCREEN_WIDTH } from './layout';
import { drawIntro, drawNotice, drawPing, drawResult, drawRoundEnd, drawTitle } from './screens';

describe('타이틀', () => {
  it('로고와 대전 방식 버튼 세 개가 있고 글자는 버튼 안에 있다', () => {
    const { view, canvas } = makeView();
    drawTitle(view);
    expect(canvas.of('drawImage')).toHaveLength(1);
    expect(canvas.texts()).toEqual(
      expect.arrayContaining(['혼자서', '컴퓨터와', '같은 컴퓨터에서', '둘이서', '온라인', '대전']),
    );
    expect(canvas.texts().join('')).toContain('Space: 조작법');
    expect(canvas.of('roundRect').map(([x]) => x)).toEqual(MENU_BUTTONS.map(button => button.rect.x));
  });

  it('버튼의 바탕은 마우스를 올린 버튼만 다르다', () => {
    const fills = (hover: boolean): unknown[] => {
      const { view, canvas } = makeView();
      if (hover) {
        view.menu.hover({ x: MENU_BUTTONS[1]?.rect.x ?? 0, y: MENU_BUTTONS[1]?.rect.y ?? 0 });
      }
      drawTitle(view);
      let fillStyle: unknown;
      return canvas.calls.flatMap(([name, value]) => {
        fillStyle = name === 'set fillStyle' ? value : fillStyle;
        return name === 'fill' ? [fillStyle] : [];
      });
    };
    expect(new Set(fills(false)).size).toBe(1);
    const hovered = fills(true);
    expect(new Set(hovered).size).toBe(2);
    expect(hovered[1]).not.toBe(hovered[0]);
    expect(hovered[0]).toBe(hovered[2]);
  });

  it('온라인 상황이 있으면 메뉴 아래에 보이고, 없으면 그리지 않는다', () => {
    const shown = makeView({ notice: '고양이 2승 1패 · 상대를 찾는 중' });
    drawTitle(shown.view);
    expect(shown.canvas.texts()).toContain('고양이 2승 1패 · 상대를 찾는 중');
    const hidden = makeView();
    drawTitle(hidden.view);
    expect(hidden.canvas.texts()).toHaveLength(7);
  });

  it('터치 기기에서는 Space 대신 일시정지 버튼을 안내한다', () => {
    const { view, canvas } = makeView({ input: 'touch' });
    drawTitle(view);
    expect(canvas.texts().join('')).toContain('⏸: 조작법');
    expect(canvas.texts().join('')).not.toContain('Space');
  });

  it('터치 기기에서는 Space 대신 일시정지 버튼을 안내한다', () => {
    const { view, canvas } = makeView({ input: 'touch' });
    drawTitle(view);
    expect(canvas.texts()).toContain('화면의 메뉴를 눌러 선택   오른쪽 위 ⏸: 조작법');
    expect(canvas.texts().join('')).not.toContain('Space');
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

  it('1P가 이겼을 때와 비겼을 때, 안내 표시 시간이 지났을 때', () => {
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

describe('핑 표시', () => {
  const colorOf = (ping: number): unknown => {
    const { view, canvas } = makeView({ ping });
    drawPing(view);
    expect(canvas.texts()).toEqual([`Ping ${ping}ms`]);
    return canvas.last('fillStyle');
  };

  it('핑이 없으면 아무것도 그리지 않는다', () => {
    const { view, canvas } = makeView();
    drawPing(view);
    expect(canvas.texts()).toEqual([]);
  });

  it('화면 오른쪽 아래에 오른쪽 정렬로 그린다', () => {
    const { view, canvas } = makeView({ ping: 38 });
    drawPing(view);
    expect(canvas.of('fillText').at(-1)).toEqual(['Ping 38ms', SCREEN_WIDTH - 16, 515]);
  });

  it('핑이 낮으면 초록, 보통이면 금색, 높으면 빨강으로 그린다', () => {
    expect([colorOf(60), colorOf(61), colorOf(120), colorOf(121)]).toEqual([
      '#7be495',
      '#ffd54a',
      '#ffd54a',
      '#ff7b7b',
    ]);
  });
});

describe('온라인 상황 안내', () => {
  it('대전 중에는 화면 아래에 한 줄로 보인다', () => {
    const { view, canvas, engine } = makeView({ notice: '상대를 기다리는 중' });
    patch(engine, { phase: 'fight' });
    drawNotice(view);
    expect(canvas.texts()).toEqual(['상대를 기다리는 중']);
  });

  it('내용이 없거나 타이틀이면 그리지 않는다', () => {
    const empty = makeView();
    patch(empty.engine, { phase: 'fight' });
    drawNotice(empty.view);
    expect(empty.canvas.texts()).toEqual([]);
    const title = makeView({ notice: '안내' });
    drawNotice(title.view);
    expect(title.canvas.texts()).toEqual([]);
  });
});
