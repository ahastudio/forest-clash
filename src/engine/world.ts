import { makeFighter } from './fighter';
import type { Fighter, GameEvent, PlayerId, World } from './types';

// 아직 판이 시작되지 않은 진행 상태: 타이틀 화면, 1라운드, 점수 없음.
function initialProgress(): Omit<
  World,
  'fighters' | 'events' | 'hitstop' | 'comboCount' | 'comboTimer' | 'titleButtonsHeld' | 'resultButtonsHeld'
> {
  return {
    phase: 'title',
    phaseTime: 0,
    frame: 0,
    roundTimer: 0,
    round: 1,
    wins: [0, 0],
    mode: 'cpu',
    matchWinner: null,
    banner: null,
  };
}

// 판 진행과 별개로 잠깐 쓰는 임시 상태(라운드가 시작되면 일부를 비운다): 사건 목록, 타격 정지, 콤보, 누름 기록.
function initialTransients(): Pick<
  World,
  'events' | 'hitstop' | 'comboCount' | 'comboTimer' | 'titleButtonsHeld' | 'resultButtonsHeld'
> {
  return {
    events: [],
    hitstop: 0,
    comboCount: [0, 0],
    comboTimer: [0, 0],
    titleButtonsHeld: [false, false],
    resultButtonsHeld: [false, false],
  };
}

/**
 * 새 게임 세계를 만든다: 두 캐릭터와 진행 상태, 임시 값.
 */
export function newWorld(): World {
  return { fighters: [makeFighter(0), makeFighter(1)], ...initialProgress(), ...initialTransients() };
}

/**
 * 일어난 일을 사건으로 내보낸다. 화면과 소리가 가져가 쓴다.
 */
export function emit(world: World, event: GameEvent): void {
  world.events.push(event);
}

/**
 * 상대 플레이어의 번호. 0이면 1을, 1이면 0을 돌려준다.
 */
export const otherId = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0);

/**
 * 상대 캐릭터. 두 캐릭터가 번호 순으로 world.fighters에 있으므로 상대 번호로 꺼낸다.
 */
export const opponentOf = (world: World, fighter: Fighter): Fighter => world.fighters[otherId(fighter.id)];

/**
 * 새 라운드나 새 판을 위해 두 캐릭터를 처음 모습으로 되돌린다.
 */
export function resetFighters(world: World): void {
  world.fighters = [makeFighter(0), makeFighter(1)];
}
