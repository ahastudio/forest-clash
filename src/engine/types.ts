import type { MoveId } from './moves';

export type PlayerId = 0 | 1;
type Facing = 1 | -1;
export type Button = 'A' | 'B' | 'C' | 'D';
type Direction = 'l' | 'r' | 'u' | 'd';

/** 누름 여부. 사람의 키 입력은 불리언, 컴퓨터 상대는 0 또는 1로 낸다. */
type Flag = boolean | number;
export type PadInput = Record<Direction | Button, Flag>;
export type Pad = Record<Direction | Button, boolean>;
export type ButtonCounts = Record<Button, number>;

export type FighterState =
  | 'idle'
  | 'crouch'
  | 'walk'
  | 'run'
  | 'lock'
  | 'prejump'
  | 'air'
  | 'roll'
  | 'bdash'
  | 'attack'
  | 'throwing'
  | 'thrown'
  | 'blockstun'
  | 'hitstun'
  | 'down'
  | 'ko';

export type Phase = 'title' | 'intro' | 'fight' | 'ko' | 'time' | 'over';
export type GameMode = 'cpu' | '2p';

interface Contact {
  type: 'block' | 'hit' | 'grab';
  frame?: number;
}

/** 위치와 몸 상태: 어디에 서 있고 어느 쪽을 보며 체력과 분노가 얼마인가. */
export interface FighterBody {
  id: PlayerId;
  x: number;
  altitude: number;
  velocityX: number;
  velocityY: number;
  knockback: number;
  face: Facing;
  hp: number;
  rage: number;
}

/** 지금 하는 행동과 그 진행: 상태, 기술, 경직, 무적. */
export interface FighterAction {
  state: FighterState;
  elapsed: number;
  moveId: MoveId | null;
  landedWindows: number;
  contact: Contact | null;
  cancelable: boolean;
  stunFrames: number;
  lockFrames: number;
  invincibleFrames: number;
  launched: boolean;
  juggleCount: number;
  knockedDown: boolean;
}

/** 입력 읽기: 지금 누른 것, 방금 누른 것, 기록, 두 번 누르기. */
export interface InputTracking {
  input: Pad;
  justPressed: ButtonCounts;
  directionHistory: number[];
  buttonAge: ButtonCounts;
  lastForwardPress: number;
  lastBackPress: number;
  wasForwardHeld: boolean;
  wasBackHeld: boolean;
  doubleTapForward: boolean;
  doubleTapBack: boolean;
}

/** 점프, 맞은 모습, 구르기, 잡힘처럼 상태에 딸린 표시와 방향. */
export interface FighterReactions {
  jumpDirection: number;
  airAttackUsed: boolean;
  hurtFlash: number;
  guardingCrouched: boolean;
  hitCrouching: boolean;
  gettingUp: boolean;
  rollDirection: number;
  /** 이 캐릭터를 잡고 있는(또는 잡힌) 상대의 번호. 없으면 -1. */
  heldBy: number;
  /** 잡혀서 들려 올라가기 시작한 가로 위치. */
  grabStartX?: number;
}

export type Fighter = FighterBody & FighterAction & InputTracking & FighterReactions;

export type GameEvent =
  | { type: 'round'; round: number }
  | { type: 'start' }
  | { type: 'title' }
  | { type: 'fight' }
  | { type: 'time' }
  | { type: 'over'; winner: PlayerId | null }
  | { type: 'move'; id: PlayerId; moveId: MoveId }
  | { type: 'roll'; id: PlayerId }
  | { type: 'dash'; id: PlayerId }
  | { type: 'jump'; id: PlayerId; hop: boolean }
  | { type: 'land'; id: PlayerId; hard?: boolean }
  | { type: 'lift'; id: PlayerId }
  | { type: 'toss'; id: PlayerId }
  | { type: 'grab'; id: PlayerId; x: number; y: number }
  | { type: 'block'; x: number; y: number; attacker: PlayerId; defender: PlayerId; moveId: MoveId }
  | {
      type: 'hit';
      x: number;
      y: number;
      power: number;
      counter: boolean;
      attacker: PlayerId;
      defender: PlayerId;
      moveId: MoveId;
      damage?: number;
      grab?: boolean;
    }
  | { type: 'ko'; id: PlayerId; x: number };

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface World {
  fighters: [Fighter, Fighter];
  events: GameEvent[];
  phase: Phase;
  phaseTime: number;
  frame: number;
  roundTimer: number;
  round: number;
  wins: [number, number];
  mode: GameMode;
  hitstop: number;
  comboCount: [number, number];
  comboTimer: [number, number];
  matchWinner: PlayerId | null;
  banner: string | null;
  titleButtonsHeld: [boolean, boolean];
  resultButtonsHeld: [boolean, boolean];
}
