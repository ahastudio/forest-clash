import { patch } from '../patch';
import { fillScreen, withState } from './canvas';
import type { Ctx } from './layout';
import { CENTER_X, CENTER_Y, GOLD, SCREEN_HEIGHT } from './layout';
import { bannerText, smallText } from './text';
import type { View } from './view';

const BLINK_FRAMES = 30;
const ROUND_END_WINNER_FRAMES = 120;
const RESULT_PROMPT_DELAY = 120;
const INTRO_CALL_FRAMES = 45;

/** 깜빡이는 글자가 보이는 구간인가. */
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

/** 로고가 위아래로 살짝 흔들린다. 그림을 아직 못 불렀으면 글자로 대신한다. */
function drawTitleLogo({ g, engine, sprites }: View): void {
  const bob = Math.sin(engine.phaseTime / 36) * 4;
  const logo = sprites.logo();
  if (logo) {
    drawLogo(g, logo, bob);
  } else {
    bannerText(g, { text: '숲속대전', color: '#9be37a', size: 118, y: 190 + bob });
  }
}

function drawTitlePrompts({ g, engine }: View): void {
  if (isBlinkOn(engine.phaseTime)) {
    smallText(g, '아무 공격 버튼이나 눌러 시작', { x: CENTER_X, y: 506, size: 24 });
  }
  smallText(g, '1P 버튼: 컴퓨터와 대전   2P 버튼: 둘이서 대전   Space: 조작법', { x: CENTER_X, y: 530, size: 15 });
}

/** 타이틀: 어둡게 가라앉힌 배경 위에 로고가 흔들리고, 시작 안내가 깜빡인다. */
export function drawTitle(view: View): void {
  fillScreen(view.g, titleShade(view.g));
  drawTitleLogo(view);
  drawTitlePrompts(view);
}

/** 라운드 시작 안내(ROUND n, FIGHT!). */
export function drawIntro({ g, engine }: View): void {
  const calling = engine.phaseTime > INTRO_CALL_FRAMES;
  const text = calling ? `ROUND ${engine.round}` : 'FIGHT!';
  bannerText(g, { text, color: calling ? '#fff' : GOLD, size: calling ? 72 : 108, y: CENTER_Y - 20 });
}

/** 이긴 쪽 안내: 비기면 나오지 않는다. */
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

/** 라운드 끝 안내(K.O., TIME UP)와 이긴 쪽. */
export function drawRoundEnd(view: View): void {
  if (view.engine.banner) {
    drawRoundBanner(view, view.engine.banner);
  }
}

/** 결과 화면: 이긴 쪽과 타이틀로 돌아가는 안내. */
export function drawResult({ g, engine }: View): void {
  fillScreen(g, '#000a');
  bannerText(g, { text: `${engine.matchWinner === 0 ? '1P' : '2P'} 승리!`, color: GOLD, size: 88, y: CENTER_Y });
  if (engine.phaseTime > RESULT_PROMPT_DELAY && isBlinkOn(engine.phaseTime)) {
    smallText(g, '아무 공격 버튼을 누르면 타이틀로', { x: CENTER_X, y: CENTER_Y + 56, size: 22 });
  }
}
