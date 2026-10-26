import { describe, expect, it } from 'vitest';
import { choiceAt, MENU_BUTTONS, TitleMenu } from './menu';

// 버튼 번호의 가운데 점.
const centerOf = (index: number) => {
  const { x, y, width, height } = MENU_BUTTONS[index]?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
  return { x: x + width / 2, y: y + height / 2 };
};

describe('타이틀 메뉴', () => {
  it('왼쪽에서 오른쪽으로 컴퓨터, 둘이서, 온라인 순서다', () => {
    expect(MENU_BUTTONS.map(button => button.choice)).toEqual(['cpu', '2p', 'online']);
  });

  it('버튼은 정사각형에 가깝고 글자는 줄을 바꿔 두 줄로 쓴다', () => {
    for (const { rect, lines } of MENU_BUTTONS) {
      expect(rect.width / rect.height).toBeGreaterThan(0.8);
      expect(rect.width / rect.height).toBeLessThan(1.25);
      expect(lines).toHaveLength(2);
    }
  });

  it('버튼 세 개가 같은 높이에 같은 크기로 화면 가운데에 대칭으로 놓인다', () => {
    const [first, second, third] = MENU_BUTTONS.map(button => button.rect);
    expect(first?.y).toBe(second?.y);
    expect(second?.y).toBe(third?.y);
    expect(first?.width).toBe(third?.width);
    expect((first?.x ?? 0) + (third?.x ?? 0) + (third?.width ?? 0)).toBe(960);
    expect((second?.x ?? 0) - ((first?.x ?? 0) + (first?.width ?? 0))).toBe(
      (third?.x ?? 0) - ((second?.x ?? 0) + (second?.width ?? 0)),
    );
  });

  it('버튼마다 그 버튼 위의 점이 그 버튼으로 읽힌다', () => {
    expect(choiceAt(centerOf(0))).toBe('cpu');
    expect(choiceAt(centerOf(1))).toBe('2p');
    expect(choiceAt(centerOf(2))).toBe('online');
  });

  it('버튼 사이의 빈틈, 위아래, 좌우 바깥은 어느 버튼도 아니다', () => {
    const first = MENU_BUTTONS[0]?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    expect(choiceAt({ x: first.x + first.width + 10, y: first.y + 10 })).toBeNull();
    expect(choiceAt({ x: first.x + 10, y: first.y - 5 })).toBeNull();
    expect(choiceAt({ x: first.x + 10, y: first.y + first.height + 5 })).toBeNull();
    expect(choiceAt({ x: first.x - 5, y: first.y + 10 })).toBeNull();
  });

  it('마우스를 올린 버튼이 강조되고, 벗어나면 강조가 사라진다', () => {
    const menu = new TitleMenu();
    expect(menu.selected).toBeNull();
    menu.hover(centerOf(1));
    expect(menu.selected).toBe('2p');
    menu.hover({ x: 0, y: 0 });
    expect(menu.selected).toBeNull();
  });

  it('누르면 그 버튼을 돌려주고, 버튼 밖을 누르면 null이다', () => {
    const menu = new TitleMenu();
    expect(menu.press(centerOf(2))).toBe('online');
    expect(menu.selected).toBe('online');
    expect(menu.press({ x: 0, y: 0 })).toBeNull();
  });
});
