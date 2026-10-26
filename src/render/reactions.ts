import type { Sound } from '../audio/sound';
import type { SoundName } from '../audio/voices';
import type { Engine, GameEvent, MoveId, PlayerId } from '../engine';
import type { Point } from './canvas';
import type { Effects } from './effects';
import { GOLD, GROUND_Y } from './layout';

const PUNCH_MOVES: readonly MoveId[] = ['a5', 'a2', 'c5', 'c2', 'c6', 'ja', 'jc', 'throw', 'elbow_a', 'elbow_c'];
const SPARK_ORANGE = '#ffa526';
const BLOCK_BLUE = '#7ab8ff';
const DEFAULT_SPARK_HEIGHT = 50;
const CLINCH_HEIGHT = 55;
const KO_HEIGHT = 60;

// 사건이 일어난 곳을 화면 좌표로: 사건이 높이를 알려 주지 않으면 몸 한가운데쯤이다.
const sparkAt = (event: { x: number; y?: number }): Point => ({
  x: event.x,
  y: GROUND_Y - (event.y || DEFAULT_SPARK_HEIGHT),
});

type Of<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

// 사건을 받았을 때 효과와 소리를 내는 데 필요한 것들.
interface ReactionContext {
  engine: Engine;
  effects: Effects;
  sound: Sound;
}

// 발 아래에 먼지가 일고 소리가 난다.
function footstep(context: ReactionContext, id: PlayerId, step: { sound: SoundName; dust: number }): void {
  context.sound.play(step.sound);
  context.effects.dust({ x: context.engine.fighters[id].x, y: GROUND_Y }, step.dust);
}

function onHit(context: ReactionContext, event: Of<'hit'>): void {
  const at = sparkAt(event);
  context.effects.impact(at, event.power, event.counter ? GOLD : SPARK_ORANGE);
  context.sound.play('hit', event.power);
  if (event.counter) {
    context.effects.ring(at, { life: 18, big: true, color: GOLD });
  }
}

function onBlock(context: ReactionContext, event: Of<'block'>): void {
  context.effects.impact(sparkAt(event), 4, BLOCK_BLUE);
  context.sound.play('block');
}

// 주먹으로 나가는 기술은 주먹 소리, 나머지는 발차기 소리다. 분노 필살기는 따로 한 번 더 울린다.
function onMove(context: ReactionContext, event: Of<'move'>): void {
  context.sound.play(PUNCH_MOVES.includes(event.moveId) ? 'punch' : 'kick');
  if (event.moveId === 'super') {
    context.sound.play('super');
  }
}

// 붙잡은 자리에 불꽃이 튄다.
function clinchSpark(context: ReactionContext, event: { x: number }, color: string): void {
  context.effects.impact({ x: event.x, y: GROUND_Y - CLINCH_HEIGHT }, 5, color);
}

function onKnockOut(context: ReactionContext, event: Of<'ko'>): void {
  const at = { x: event.x, y: GROUND_Y - KO_HEIGHT };
  context.sound.play('ko');
  context.effects.impact(at, 22, GOLD);
  context.effects.ring(at, { life: 40, big: true, color: '#fff' });
}

// 소리만 내는 사건.
const soundOnly =
  (name: SoundName) =>
  (context: ReactionContext): void =>
    context.sound.play(name);

// 사건마다 하는 일.
const HANDLERS: { [T in GameEvent['type']]: (context: ReactionContext, event: Of<T>) => void } = {
  hit: onHit,
  block: onBlock,
  move: onMove,
  jump: (context, event) => footstep(context, event.id, { sound: 'jump', dust: 4 }),
  land: (context, event) => footstep(context, event.id, { sound: 'land', dust: event.hard ? 8 : 4 }),
  dash: (context, event) => footstep(context, event.id, { sound: 'dash', dust: 5 }),
  roll: (context, event) => footstep(context, event.id, { sound: 'dash', dust: 5 }),
  grab: (context, event) => {
    clinchSpark(context, event, SPARK_ORANGE);
    context.sound.play('grab');
  },
  lift: soundOnly('lift'),
  toss: soundOnly('toss'),
  ko: onKnockOut,
  round: soundOnly('round'),
  fight: soundOnly('fight'),
  over: soundOnly('win'),
  start: () => undefined,
  title: () => undefined,
  time: () => undefined,
};

function dispatch<T extends GameEvent['type']>(context: ReactionContext, event: Of<T>): void {
  HANDLERS[event.type](context, event);
}

/**
 * 엔진이 알려 준 사건을 효과와 소리로 바꾼다.
 */
export class Reactions {
  constructor(private readonly context: ReactionContext) {}

  /**
   * 쌓인 사건을 모두 꺼내 처리한다.
   */
  handle(): void {
    for (const event of this.context.engine.consume()) {
      dispatch(this.context, event);
    }
  }
}
