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

/** 사건이 일어난 곳을 화면 좌표로: 사건이 높이를 알려 주지 않으면 몸 한가운데쯤이다. */
const sparkAt = (event: { x: number; y?: number }): Point => ({
  x: event.x,
  y: GROUND_Y - (event.y || DEFAULT_SPARK_HEIGHT),
});

type Of<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

/** 사건을 받았을 때 효과와 소리를 내는 데 필요한 것들. */
interface Stage {
  engine: Engine;
  effects: Effects;
  sound: Sound;
}

/** 발 아래에 먼지가 일고 소리가 난다. */
function footstep(stage: Stage, id: PlayerId, step: { sound: SoundName; dust: number }): void {
  stage.sound.play(step.sound);
  stage.effects.dust({ x: stage.engine.fighters[id].x, y: GROUND_Y }, step.dust);
}

function onHit(stage: Stage, event: Of<'hit'>): void {
  const at = sparkAt(event);
  stage.effects.impact(at, event.power, event.counter ? GOLD : SPARK_ORANGE);
  stage.sound.play('hit', event.power);
  if (event.counter) {
    stage.effects.ring(at, { life: 18, big: true, color: GOLD });
  }
}

function onBlock(stage: Stage, event: Of<'block'>): void {
  stage.effects.impact(sparkAt(event), 4, BLOCK_BLUE);
  stage.sound.play('block');
}

/** 주먹으로 나가는 기술은 주먹 소리, 나머지는 발차기 소리다. 분노 필살기는 따로 한 번 더 울린다. */
function onMove(stage: Stage, event: Of<'move'>): void {
  stage.sound.play(PUNCH_MOVES.includes(event.moveId) ? 'punch' : 'kick');
  if (event.moveId === 'super') {
    stage.sound.play('super');
  }
}

/** 붙잡거나 잡기를 푼 자리에 불꽃이 튄다. */
function clinchSpark(stage: Stage, event: { x: number }, color: string): void {
  stage.effects.impact({ x: event.x, y: GROUND_Y - CLINCH_HEIGHT }, 5, color);
}

function onKnockOut(stage: Stage, event: Of<'ko'>): void {
  const at = { x: event.x, y: GROUND_Y - KO_HEIGHT };
  stage.sound.play('ko');
  stage.effects.impact(at, 22, GOLD);
  stage.effects.ring(at, { life: 40, big: true, color: '#fff' });
}

/** 소리만 내는 사건. */
const soundOnly =
  (name: SoundName) =>
  (stage: Stage): void =>
    stage.sound.play(name);

/** 사건마다 하는 일. */
const HANDLERS: { [T in GameEvent['type']]: (stage: Stage, event: Of<T>) => void } = {
  hit: onHit,
  block: onBlock,
  move: onMove,
  jump: (stage, event) => footstep(stage, event.id, { sound: 'jump', dust: 4 }),
  land: (stage, event) => footstep(stage, event.id, { sound: 'land', dust: event.hard ? 8 : 4 }),
  dash: (stage, event) => footstep(stage, event.id, { sound: 'dash', dust: 5 }),
  roll: (stage, event) => footstep(stage, event.id, { sound: 'dash', dust: 5 }),
  grab: (stage, event) => {
    clinchSpark(stage, event, SPARK_ORANGE);
    stage.sound.play('grab');
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

function dispatch<T extends GameEvent['type']>(stage: Stage, event: Of<T>): void {
  HANDLERS[event.type](stage, event);
}

/** 엔진이 알려 준 사건을 효과와 소리로 바꾼다. */
export class Reactions {
  constructor(private readonly stage: Stage) {}

  /** 쌓인 사건을 모두 꺼내 처리한다. */
  handle(): void {
    for (const event of this.stage.engine.consume()) {
      dispatch(this.stage, event);
    }
  }
}
