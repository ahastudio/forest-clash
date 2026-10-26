import type { Rect } from '../menu';
import { MENU_BUTTONS } from '../menu';
import { patch } from '../patch';
import { fillScreen, withState } from './canvas';
import type { Ctx } from './layout';
import { CENTER_X, CENTER_Y, GOLD, SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';
import { bannerText, smallText } from './text';
import type { View } from './view';

const BLINK_FRAMES = 30;
const ROUND_END_WINNER_FRAMES = 120;
const RESULT_PROMPT_DELAY = 120;
const INTRO_CALL_FRAMES = 45;

// 깜빡이는 글자가 보이는 구간인가.
const isBlinkOn = (phaseTime: number): boolean => Math.floor(phaseTime / BLINK_FRAMES) % 2 === 0;

function titleShade(g: Ctx): CanvasGradient {
  const shade = g.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  shade.addColorStop(0, 'rgba(20,30,60,0.12)');
  shade.addColorStop(0.55, 'rgba(20,30,60,0.22)');
  shade.addColorStop(1, 'rgba(10,15,30,0.5)');
  return shade;
}

function drawLogo(g: Ctx, logo: HTMLImageElement, bob: number): void {
  const width = 640;
  const height = (width * logo.height) / logo.width;
  withState(g, () => {
    patch(g, { shadowColor: 'rgba(0,0,0,0.35)', shadowBlur: 14, shadowOffsetY: 6 });
    g.drawImage(logo, CENTER_X - width / 2, 34 + bob, width, height);
  });
}

// 로고가 위아래로 살짝 흔들린다. 그림을 아직 못 불렀으면 글자로 대신한다.
function drawTitleLogo({ g, engine, sprites }: View): void {
  const bob = Math.sin(engine.phaseTime / 36) * 4;
  const logo = sprites.logo();
  if (logo) {
    drawLogo(g, logo, bob);
  } else {
    bannerText(g, { text: '숲속대전', color: '#9be37a', size: 118, y: 190 + bob });
  }
}

const NOTICE_Y = 497;

// 버튼 한 개의 색: 마우스를 올린 버튼은 숲처럼 짙은 초록 바탕에 금색 테두리와 글자, 나머지는 어두운 남색 바탕에 흰색이다.
const BUTTON_LOOK = {
  idle: { fill: '#1b2a3a8c', line: '#ffffffaa', text: '#fff' },
  hover: { fill: '#2f7d3a8c', line: GOLD, text: GOLD },
};

function drawButtonFrame(g: Ctx, { x, y, width, height }: Rect, look: { fill: string; line: string }): void {
  withState(g, () => {
    patch(g, { fillStyle: look.fill, strokeStyle: look.line, lineWidth: 3 });
    g.beginPath();
    g.roundRect(x, y, width, height, 18);
    g.fill();
    g.stroke();
  });
}

const BUTTON_LINE_HEIGHT = 30;

// 버튼 안의 글자를 줄마다 가운데에 쓴다. 줄이 몇 개이든 버튼 한가운데에 모인다.
function drawButtonLines(g: Ctx, button: { lines: readonly string[]; rect: Rect; color: string }): void {
  const { lines, rect, color } = button;
  const top = rect.y + rect.height / 2 - ((lines.length - 1) * BUTTON_LINE_HEIGHT) / 2 + 8;
  lines.forEach((line, row) => {
    smallText(g, line, { x: rect.x + rect.width / 2, y: top + row * BUTTON_LINE_HEIGHT, size: 22, color });
  });
}

// 대전 방식 버튼 세 개를 가로로 그린다.
function drawMenu({ g, menu }: View): void {
  for (const { choice, lines, rect } of MENU_BUTTONS) {
    const look = BUTTON_LOOK[choice === menu.selected ? 'hover' : 'idle'];
    drawButtonFrame(g, rect, look);
    drawButtonLines(g, { lines, rect, color: look.text });
  }
}

function drawTitlePrompts(view: View): void {
  drawMenu(view);
  if (view.notice) {
    smallText(view.g, view.notice, { x: CENTER_X, y: NOTICE_Y, size: 18, color: GOLD });
  }
  smallText(view.g, view.guide.titleHint, { x: CENTER_X, y: 530, size: 15 });
}

/**
 * 타이틀: 어둡게 가라앉힌 배경 위에 로고가 흔들리고, 그 아래에 대전 방식을 고르는 메뉴가 있다.
 */
export function drawTitle(view: View): void {
  fillScreen(view.g, titleShade(view.g));
  drawTitleLogo(view);
  drawTitlePrompts(view);
}

/**
 * 라운드 시작 안내(ROUND n, FIGHT!).
 */
export function drawIntro({ g, engine }: View): void {
  const calling = engine.phaseTime > INTRO_CALL_FRAMES;
  const text = calling ? `ROUND ${engine.round}` : 'FIGHT!';
  bannerText(g, { text, color: calling ? '#fff' : GOLD, size: calling ? 72 : 108, y: CENTER_Y - 20 });
}

// 이긴 쪽 안내: 비기면 나오지 않는다.
function drawRoundWinner(g: Ctx, { firstWon }: { firstWon: boolean }): void {
  bannerText(g, { text: `${firstWon ? '1P' : '2P'} 승!`, color: '#fff', size: 48, y: CENTER_Y + 54 });
}

function drawRoundBanner({ g, engine }: View, banner: string): void {
  const knockOut = banner === 'K.O.';
  bannerText(g, { text: banner, color: knockOut ? '#ff5a4a' : GOLD, size: knockOut ? 128 : 84, y: CENTER_Y - 10 });
  const decided = engine.wins[0] !== engine.wins[1];
  if (engine.phaseTime < ROUND_END_WINNER_FRAMES && decided) {
    drawRoundWinner(g, { firstWon: engine.wins[0] > engine.wins[1] });
  }
}

/**
 * 라운드 끝 안내(K.O., TIME UP)와 이긴 쪽.
 */
export function drawRoundEnd(view: View): void {
  if (view.engine.banner) {
    drawRoundBanner(view, view.engine.banner);
  }
}

/**
 * 결과 화면: 이긴 쪽과 타이틀로 돌아가는 안내.
 */
export function drawResult({ g, engine }: View): void {
  fillScreen(g, '#000a');
  bannerText(g, { text: `${engine.matchWinner === 0 ? '1P' : '2P'} 승리!`, color: GOLD, size: 88, y: CENTER_Y });
  if (engine.phaseTime > RESULT_PROMPT_DELAY && isBlinkOn(engine.phaseTime)) {
    smallText(g, '아무 공격 버튼을 누르면 타이틀로', { x: CENTER_X, y: CENTER_Y + 56, size: 22 });
  }
}

// 핑이 이 값 이하이면 쾌적하고, 이 값 이하이면 보통이며, 넘으면 느리다(밀리초).
const PING_GOOD_MS = 60;
const PING_OKAY_MS = 120;
const PING_COLORS = { good: '#7be495', okay: GOLD, slow: '#ff7b7b' };
const PING_X = SCREEN_WIDTH - 16;
const PING_Y = 515;

// 핑의 높낮이에 맞는 글자색.
function pingColor(ping: number): string {
  if (ping <= PING_GOOD_MS) {
    return PING_COLORS.good;
  }
  return ping <= PING_OKAY_MS ? PING_COLORS.okay : PING_COLORS.slow;
}

/**
 * 온라인 대전 중 화면 오른쪽 아래에 서버와의 왕복 시간을 보인다. 느린 이유가 연결 때문인지 알 수 있게 한다.
 */
export function drawPing({ g, ping }: View): void {
  if (ping !== null) {
    smallText(g, `Ping ${ping}ms`, { x: PING_X, y: PING_Y, size: 18, color: pingColor(ping), align: 'right' });
  }
}

/**
 * 타이틀 밖에서 보이는 온라인 상황 한 줄(상대를 기다리는 중 등). 타이틀은 메뉴 아래에 직접 그린다.
 */
export function drawNotice(view: View): void {
  if (view.notice && view.engine.phase !== 'title') {
    smallText(view.g, view.notice, { x: CENTER_X, y: 515, size: 20, color: GOLD });
  }
}
