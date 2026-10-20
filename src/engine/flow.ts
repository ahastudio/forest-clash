import { patch } from '../patch';
import { readInput } from './fighter';
import { detectHits } from './hits';
import { keepInStage } from './stage';
import type { GameMode, PadInput, Phase, PlayerId, World } from './types';
import { updateFighter } from './update';
import { emit, resetFighters } from './world';

const ROUND_SECONDS = 60;
const FRAMES_PER_SECOND = 60;
const INTRO_FRAMES = 110;
const FIGHT_CALL_FRAME = 45;
const TIME_UP_FRAMES = 160;
const ROUNDS_TO_WIN = 2;
const TITLE_INPUT_DELAY = 20;
const RESULT_INPUT_DELAY = 120;

export type Inputs = readonly [Partial<PadInput>, Partial<PadInput>];

const NO_INPUT: Inputs = [{}, {}];

const hasButton = (input: Partial<PadInput>): boolean => !!(input.A || input.B || input.C || input.D);

/** 각 플레이어가 공격 버튼(A~D)을 하나라도 누르고 있는가. */
export const anyButton = (inputs: Inputs): [boolean, boolean] => [hasButton(inputs[0]), hasButton(inputs[1])];

function startRound(world: World): void {
  resetFighters(world);
  const fresh: Partial<World> = { comboCount: [0, 0], comboTimer: [0, 0], hitstop: 0, banner: null };
  patch(world, { ...fresh, phase: 'intro', phaseTime: INTRO_FRAMES, roundTimer: ROUND_SECONDS * FRAMES_PER_SECOND });
  emit(world, { type: 'round', round: world.round });
}

/** 새 판을 시작한다: 승수를 지우고 첫 라운드를 연다. */
export function newMatch(world: World, mode: GameMode): void {
  patch(world, { mode, wins: [0, 0], round: 1, matchWinner: null });
  startRound(world);
}

/** 타이틀 화면으로 돌아가고 두 캐릭터를 처음 모습으로 되돌린다. */
export function toTitle(world: World): void {
  patch(world, { phase: 'title', phaseTime: 0 });
  resetFighters(world);
  world.events.length = 0;
}

interface Edges {
  first: boolean;
  second: boolean;
}

/** 두 플레이어 중 누구라도 새로 눌렀는가. */
const anyPressed = ({ first, second }: Edges): boolean => first || second;

/** 이번 프레임에 새로 눌린 버튼이 있는가: 이전 프레임의 눌림을 기억해 두고 비교한다. */
function risingEdges(world: World, memory: 'titleButtonsHeld' | 'resultButtonsHeld', inputs: Inputs): Edges {
  const [first, second] = anyButton(inputs);
  const [wasFirst, wasSecond] = world[memory];
  world[memory] = [first, second];
  return { first: first && !wasFirst, second: second && !wasSecond };
}

/** 1P가 눌렀으면 컴퓨터와, 2P만 눌렀으면 둘이서 대전한다. */
function beginMatch(world: World, edges: Edges): void {
  newMatch(world, edges.second && !edges.first ? '2p' : 'cpu');
  emit(world, { type: 'start' });
}

function stepTitle(world: World, inputs: Inputs): void {
  world.phaseTime++;
  const edges = risingEdges(world, 'titleButtonsHeld', inputs);
  if (world.phaseTime > TITLE_INPUT_DELAY && anyPressed(edges)) {
    beginMatch(world, edges);
  }
}

function returnToTitle(world: World): void {
  toTitle(world);
  emit(world, { type: 'title' });
}

function stepResult(world: World, inputs: Inputs): void {
  world.phaseTime++;
  const edges = risingEdges(world, 'resultButtonsHeld', inputs);
  if (world.phaseTime > RESULT_INPUT_DELAY && anyPressed(edges)) {
    returnToTitle(world);
  }
}

function readInputs(world: World, inputs: Inputs): void {
  readInput(world, world.fighters[0], inputs[0]);
  readInput(world, world.fighters[1], inputs[1]);
}

function countDownIntro(world: World): void {
  world.phaseTime--;
  if (world.phaseTime === FIGHT_CALL_FRAME) {
    emit(world, { type: 'fight' });
  }
  if (world.phaseTime <= 0) {
    world.phase = 'fight';
  }
}

/** 라운드 시작 안내 동안은 입력을 비워서 받는다. */
function stepIntro(world: World): void {
  readInputs(world, NO_INPUT);
  countDownIntro(world);
}

/** 시간이 다했다: 체력이 더 많은 쪽이 한 판을 얻는다. */
function creditLeader(world: World): void {
  const [a, b] = world.fighters;
  if (a.hp !== b.hp) {
    world.wins[a.hp > b.hp ? 0 : 1]++;
  }
}

function timeUp(world: World): void {
  patch(world, { phase: 'time', phaseTime: TIME_UP_FRAMES, banner: 'TIME UP' });
  creditLeader(world);
  emit(world, { type: 'time' });
}

function tickTimer(world: World): void {
  world.roundTimer--;
  if (world.roundTimer <= 0) {
    timeUp(world);
  }
}

function tickCombos(world: World): void {
  for (const side of [0, 1] as const) {
    world.comboTimer[side] = Math.max(0, world.comboTimer[side] - 1);
    if (world.comboTimer[side] === 0) {
      world.comboCount[side] = 0;
    }
  }
}

const isMatchOver = (world: World): boolean => world.wins[0] >= ROUNDS_TO_WIN || world.wins[1] >= ROUNDS_TO_WIN;

function endMatch(world: World): void {
  const matchWinner: PlayerId = world.wins[0] >= ROUNDS_TO_WIN ? 0 : 1;
  patch(world, { phase: 'over', phaseTime: 0, matchWinner });
  emit(world, { type: 'over', winner: matchWinner });
}

function nextRound(world: World): void {
  world.round++;
  startRound(world);
}

/** 라운드 끝 안내가 끝나면 다음 라운드로 넘어가거나 판을 끝낸다. */
function finishRound(world: World): void {
  world.phaseTime--;
  if (world.phaseTime > 0) {
    return;
  }
  const advance = isMatchOver(world) ? endMatch : nextRound;
  advance(world);
}

const isRoundEnding = (phase: Phase): boolean => phase === 'ko' || phase === 'time';

function simulate(world: World): void {
  for (const fighter of world.fighters) {
    updateFighter(world, fighter);
  }
  detectHits(world);
  keepInStage(world);
}

/** 타격 정지가 풀린 프레임의 전투: 움직이고, 맞히고, 벽 안에 가두고, 끝났으면 다음으로 넘긴다. */
function stepBattle(world: World): void {
  if (world.phase === 'fight') {
    tickTimer(world);
  }
  simulate(world);
  if (isRoundEnding(world.phase)) {
    finishRound(world);
  }
}

/** 입력은 타격 정지 중에도 받는다(버퍼). 정지가 풀리기 전에는 시간이 흐르지 않는다. */
function stepActive(world: World, inputs: Inputs): void {
  readInputs(world, inputs);
  tickCombos(world);
  if (world.hitstop > 0) {
    world.hitstop--;
  } else {
    stepBattle(world);
  }
}

const PHASE_STEPS: Record<Phase, (world: World, inputs: Inputs) => void> = {
  title: stepTitle,
  over: stepResult,
  intro: stepIntro,
  fight: stepActive,
  ko: stepActive,
  time: stepActive,
};

/** 60분의 1초 한 프레임을 진행한다. 입력은 [1P, 2P]다. */
export function step(world: World, inputs: Inputs): void {
  world.frame++;
  PHASE_STEPS[world.phase](world, inputs);
}
