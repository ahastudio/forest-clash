import { patch } from '../patch';
import type { Point } from './canvas';
import { fillScreen, roundRectPath, withState } from './canvas';
import type { Ctx } from './layout';
import { CENTER_X, GOLD, SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';
import { smallText, wrapText } from './text';
import type { View } from './view';

const HELP_ROWS: readonly (readonly [string, string])[] = [
  [
    '이동',
    '앞·뒤 걷기(뒤로 걸으면 방어) · 위 점프(짧게 누르면 낮은 점프, 위를 누른 뒤 앞을 눌러도 앞 점프) · 아래 앉기 · 앞 두 번 달리기 · 뒤 두 번 뒤 대시',
  ],
  ['방어', '상대 반대 방향. 서서 막기: 중단·상단 / 앉아서 막기(아래+뒤): 중단·하단. 점프 공격과 앞+강펀치는 상단'],
  [
    '잡기',
    '가까이서 앞이나 뒤로 밀면서 강펀치나 강킥. 큰 공격 대신 잡기가 나가고 방어를 무시하지만, 발동이 강공격만큼 걸려 그 사이 약한 공격에 맞는다. 한 번 잡히면 풀 수 없고 들어 올려졌다가 던져진다',
  ],
  ['동시 입력', '약펀치+약킥 구르기(앞 무적) · 강펀치+강킥 강타'],
  [
    '특수기',
    '↓→ + 약/강펀치: 돌진 팔꿈치 · →↓ + 약/강펀치: 대공 어퍼(방향 두 개를 차례로, 대각선 필요 없음) · 앞+강펀치 내려찍기 주먹(상단) · 앞+강킥 돌진 발차기',
  ],
  ['분노 필살기', '분노 게이지가 가득 차면 ↓→↓→ + 강펀치. 때리거나 맞거나 막으면 게이지가 찬다'],
  ['연계', '약한 기술은 맞히면 이어 누를 수 있고, 맞히거나 막힌 뒤 특수기로 끊어 이을 수 있다(미리 눌러도 된다)'],
];

const HELP_FONT = '600 15px "Apple SD Gothic Neo",sans-serif';
const HELP_LINE_HEIGHT = 20;
const HELP_ROW_GAP = 10;
const HELP_TOP = 222;
const HELP_BODY_X = 150;
const HELP_MAX_WIDTH = SCREEN_WIDTH - 170 - 40;

function wrapHelp(g: Ctx, body: string): string[] {
  g.save();
  g.font = HELP_FONT;
  const lines = wrapText(g, body, HELP_MAX_WIDTH);
  g.restore();
  return lines;
}

/** 안내 한 줄(제목과 본문)을 쓰고, 다음 줄이 시작할 세로 위치를 돌려준다. */
function drawHelpRow(g: Ctx, [head, body]: readonly [string, string], y: number): number {
  smallText(g, head, { x: 40, y, size: 15, color: GOLD, align: 'left', weight: 800 });
  const lines = wrapHelp(g, body);
  for (const [k, line] of lines.entries()) {
    smallText(g, line, { x: HELP_BODY_X, y: y + k * HELP_LINE_HEIGHT, size: 15, align: 'left', weight: 600 });
  }
  return y + lines.length * HELP_LINE_HEIGHT + HELP_ROW_GAP;
}

/** 화면에 그리는 키: 방향 넷과 버튼 넷. */
type PadControl = 'up' | 'left' | 'down' | 'right' | 'weakPunch' | 'strongPunch' | 'weakKick' | 'strongKick';

interface KeySpec {
  dx: number;
  dy: number;
  control: PadControl;
  color?: string;
}

/** 방향키 네 개와 버튼 네 개의 배치. 위 줄은 약펀치(왼쪽)와 강펀치(오른쪽), 아래 줄은 약킥(왼쪽)과 강킥(오른쪽). */
const PAD_KEYS: readonly KeySpec[] = [
  { dx: 44, dy: 0, control: 'up' },
  { dx: 0, dy: 38, control: 'left' },
  { dx: 44, dy: 38, control: 'down' },
  { dx: 88, dy: 38, control: 'right' },
  { dx: 170, dy: 0, control: 'weakPunch', color: '#a04a4a' },
  { dx: 214, dy: 0, control: 'strongPunch', color: '#6a3a3a' },
  { dx: 170, dy: 38, control: 'weakKick', color: '#3a7a8a' },
  { dx: 214, dy: 38, control: 'strongKick', color: '#3a5a6a' },
];

interface Caption {
  text: string;
  dx: number;
  dy: number;
  color: string;
  align: CanvasTextAlign;
}

const PAD_CAPTIONS: readonly Caption[] = [
  { text: '약', dx: 189, dy: -6, color: '#e8d0c8', align: 'center' },
  { text: '강', dx: 233, dy: -6, color: '#e8d0c8', align: 'center' },
  { text: '펀치', dx: 262, dy: 22, color: '#ffd0c0', align: 'left' },
  { text: '킥', dx: 262, dy: 60, color: '#c0e8f0', align: 'left' },
];

function drawKey(g: Ctx, key: { at: Point; label: string; color?: string }): void {
  withState(g, () => {
    patch(g, { fillStyle: key.color ?? '#2a3550', strokeStyle: '#8fa4d8', lineWidth: 2 });
    roundRectPath(g, { ...key.at, w: 38, h: 34 }, 7);
    g.fill();
    g.stroke();
  });
  smallText(g, key.label, { x: key.at.x + 19, y: key.at.y + 24, size: 16, weight: 800 });
}

function drawPadKeys(g: Ctx, origin: Point, labels: Record<PadControl, string>): void {
  for (const key of PAD_KEYS) {
    const at = { x: origin.x + key.dx, y: origin.y + key.dy };
    drawKey(g, { at, label: labels[key.control], color: key.color });
  }
}

function drawPadCaptions(g: Ctx, origin: Point): void {
  for (const caption of PAD_CAPTIONS) {
    const { text, dx, dy, color, align } = caption;
    smallText(g, text, { x: origin.x + dx, y: origin.y + dy, size: 12, color, align, weight: 800 });
  }
}

/** 1P(방향키와 I O K L)와 2P(W A S D와 R T F G)의 키 이름. */
const PADS: readonly { centerX: number; labels: Record<PadControl, string> }[] = [
  {
    centerX: 250,
    labels: {
      left: '←',
      up: '↑',
      down: '↓',
      right: '→',
      weakPunch: 'I',
      strongPunch: 'O',
      weakKick: 'K',
      strongKick: 'L',
    },
  },
  {
    centerX: 710,
    labels: {
      left: 'A',
      up: 'W',
      down: 'S',
      right: 'D',
      weakPunch: 'R',
      strongPunch: 'T',
      weakKick: 'F',
      strongKick: 'G',
    },
  },
];

function drawPads(g: Ctx): void {
  for (const pad of PADS) {
    const origin = { x: pad.centerX - 170, y: 90 };
    drawPadKeys(g, origin, pad.labels);
    drawPadCaptions(g, origin);
  }
}

function drawKeyboardHeadings(g: Ctx): void {
  smallText(g, '1P (오른쪽 캐릭터)', { x: 250, y: 62, size: 15, color: '#ff9a8a', weight: 800 });
  smallText(g, '2P (왼쪽 캐릭터)', { x: 710, y: 62, size: 15, color: '#8ab8ff', weight: 800 });
}

function drawPauseFooter(g: Ctx, { text, version }: { text: string; version: string }): void {
  smallText(g, text, {
    x: CENTER_X,
    y: SCREEN_HEIGHT - 22,
    size: 16,
    color: '#e8f0ff',
  });
  const style = { x: SCREEN_WIDTH - 14, y: SCREEN_HEIGHT - 8, size: 11, color: 'rgba(255,255,255,0.65)' };
  smallText(g, `버전 ${version}`, { ...style, align: 'right', weight: 600 });
}

function drawPauseBackdrop(g: Ctx): void {
  fillScreen(g, 'rgba(10,18,36,0.95)');
  smallText(g, '일시정지', { x: CENTER_X, y: 40, size: 30, color: GOLD });
}

function drawKeyboardGuide(g: Ctx): void {
  drawKeyboardHeadings(g);
  drawPads(g);
}

/** 일시정지 화면: 조작법 안내. 키보드 그림은 키보드를 쓸 때만 보이고, 아래 문구는 입력 장치마다 다르다. */
export function drawPause({ g, guide }: View, version: string): void {
  drawPauseBackdrop(g);
  if (guide.showKeyboards) {
    drawKeyboardGuide(g);
  }
  HELP_ROWS.reduce((y, row) => drawHelpRow(g, row, y), HELP_TOP);
  drawPauseFooter(g, { text: guide.pauseFooter, version });
}
