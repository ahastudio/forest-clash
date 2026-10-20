import type { Engine, Fighter, GameEvent, GameMode, PadInput } from '../engine';
import { createEngine } from '../engine';
import { patch } from '../patch';

/** 테스트용 입력: 아무것도 누르지 않은 입력. */
export const idlePad = (): PadInput => ({ l: 0, r: 0, u: 0, d: 0, A: 0, B: 0, C: 0, D: 0 });

/** 프레임 번호를 붙여 모아 둔 사건. */
type LoggedEvent = GameEvent & { frame: number };

/** 프레임마다 입력을 돌려주는 함수. i는 이번 테스트에서 몇 번째 프레임인가. */
export type Script = (i: number) => Partial<PadInput>;

/** 왼쪽(공격자 L, 1번)과 오른쪽(방어자 R, 0번)이 마주 선 테스트 상황. */
export interface Duel {
  engine: Engine;
  L: Fighter;
  R: Fighter;
  events: LoggedEvent[];
}

const START_FRAMES = 130;
const LEFT_X = 500;

/** 두 캐릭터를 dist 간격으로 마주 세우고 라운드 시작 안내가 끝난 상태로 만든다. */
export function setup(dist = 90, mode: GameMode = '2p'): Duel {
  const engine = createEngine();
  engine.newMatch(mode);
  for (let i = 0; i < START_FRAMES; i++) {
    engine.step([idlePad(), idlePad()]);
  }
  const [R, L] = engine.fighters;
  patch(L, { x: LEFT_X, face: 1 });
  patch(R, { x: LEFT_X + dist, face: -1 });
  return { engine, L, R, events: [] };
}

/** 프레임 수만큼 진행한다. left는 L의 입력, right는 R의 입력이다. */
export function drive(duel: Duel, frames: number, left?: Script | null, right?: Script | null): void {
  for (let i = 0; i < frames; i++) {
    const a = { ...idlePad(), ...left?.(i) };
    const b = { ...idlePad(), ...right?.(i) };
    duel.engine.step([b, a]);
    for (const event of duel.engine.consume()) {
      duel.events.push({ ...event, frame: duel.engine.frame });
    }
  }
}

/** 언제나 같은 입력을 낸다. */
export const hold =
  (pad: Partial<PadInput>): Script =>
  () =>
    pad;

/** at번째 프레임부터 두 프레임 동안 버튼을 누른다. extra는 그동안 함께 누르는 입력이다. */
export const tap =
  (button: 'A' | 'B' | 'C' | 'D', at = 0, extra: Partial<PadInput> = {}): Script =>
  i =>
    i >= at && i < at + 2 ? { ...extra, [button]: 1 } : extra;

/** 땅에서 행동할 수 있는 상태인가. */
export const isNeutral = (fighter: Fighter): boolean =>
  fighter.altitude === 0 && ['idle', 'crouch', 'walk', 'run'].includes(fighter.state);

export const eventsOf = <T extends GameEvent['type']>(
  duel: Duel,
  type: T,
): (Extract<GameEvent, { type: T }> & { frame: number })[] =>
  duel.events.filter((e): e is Extract<GameEvent, { type: T }> & { frame: number } => e.type === type);

/** 테스트마다 같은 값이 나오도록 하는 작은 난수 생성기. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
