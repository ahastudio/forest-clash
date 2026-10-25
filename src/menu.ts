import { SCREEN_WIDTH } from './render/layout';

/** 타이틀에서 고를 수 있는 대전 방식. */
export type StartChoice = 'cpu' | '2p' | 'online';

/** 캔버스 그림 좌표 위의 한 점. */
export interface Point {
  x: number;
  y: number;
}

/** 캔버스 그림 좌표 위의 사각형. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MenuButton {
  choice: StartChoice;
  /** 버튼 안에 줄을 바꿔 쓰는 글자. 버튼이 정사각형에 가까워서 한 줄에 다 쓰지 않는다. */
  lines: readonly string[];
  rect: Rect;
}

const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 160;
const BUTTON_GAP = 24;
const BUTTON_TOP = 322;

const LABELS: readonly [StartChoice, readonly string[]][] = [
  ['cpu', ['혼자서', '컴퓨터와']],
  ['2p', ['같은 컴퓨터에서', '둘이서']],
  ['online', ['온라인', '대전']],
];

/** 버튼 세 개가 화면 가운데에 가로로 나란히 놓이도록 첫 버튼의 왼쪽 끝을 구한다. */
const MENU_LEFT = (SCREEN_WIDTH - (LABELS.length * BUTTON_WIDTH + (LABELS.length - 1) * BUTTON_GAP)) / 2;

/** 왼쪽에서 오른쪽으로 보이는 순서의 버튼. 그리는 코드와 누른 버튼을 찾는 코드가 같은 자리를 쓴다. */
export const MENU_BUTTONS: readonly MenuButton[] = LABELS.map(([choice, lines], index) => ({
  choice,
  lines,
  rect: {
    x: MENU_LEFT + index * (BUTTON_WIDTH + BUTTON_GAP),
    y: BUTTON_TOP,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  },
}));

const contains = ({ x, y, width, height }: Rect, point: Point): boolean =>
  point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;

/** 누른 점이 어느 버튼 위인지 찾는다. 어느 버튼도 아니면 null이다. */
export function choiceAt(point: Point): StartChoice | null {
  return MENU_BUTTONS.find(button => contains(button.rect, point))?.choice ?? null;
}

/** 타이틀의 선택 메뉴. 마우스를 올린 버튼을 강조하고, 누른 버튼을 돌려준다. */
export class TitleMenu {
  /** 마우스가 올라가 있는 버튼. 올라가 있지 않으면 null이다. */
  selected: StartChoice | null = null;

  hover(point: Point): void {
    this.selected = choiceAt(point);
  }

  /** 누른 점의 버튼을 돌려준다. 버튼 밖을 눌렀으면 null이다. */
  press(point: Point): StartChoice | null {
    this.hover(point);
    return this.selected;
  }
}
