import { describe, expect, it } from 'vitest';
import type { Fighter, MoveId } from '../engine';
import { makeFighter } from '../engine/fighter';
import { patch } from '../patch';
import { poseKey } from './poses';

const fighter = (changes: Partial<Fighter>): Fighter => patch(makeFighter(1), changes);
const attacking = (moveId: MoveId, elapsed: number): Fighter => fighter({ state: 'attack', moveId, elapsed });

describe('상태별 자세', () => {
  const rows: [Partial<Fighter>, string][] = [
    [{ state: 'idle' }, 'idle'],
    [{ state: 'down' }, 'down'],
    [{ state: 'ko', altitude: 30 }, 'hurt-air'],
    [{ state: 'ko', altitude: 0 }, 'down'],
    [{ state: 'hitstun', knockedDown: true, altitude: 0 }, 'down'],
    [{ state: 'hitstun', altitude: 20 }, 'hurt-air'],
    [{ state: 'hitstun', altitude: 0 }, 'hurt'],
    [{ state: 'blockstun', guardingCrouched: true }, 'block-crouch'],
    [{ state: 'blockstun' }, 'block'],
    [{ state: 'roll' }, 'dash'],
    [{ state: 'run' }, 'dash'],
    [{ state: 'bdash' }, 'jump'],
    [{ state: 'prejump' }, 'crouch'],
    [{ state: 'crouch' }, 'crouch'],
    [{ state: 'air', velocityY: 3 }, 'jump'],
    [{ state: 'air', velocityY: -3 }, 'fall'],
    [{ state: 'lock', altitude: 10 }, 'fall'],
    [{ state: 'lock', gettingUp: true }, 'getup'],
    [{ state: 'lock' }, 'idle'],
    [{ state: 'attack', moveId: null }, 'idle'],
  ];
  it.each(rows)('%j는 %s', (patch, expected) => {
    expect(poseKey(fighter(patch), 0)).toBe(expected);
  });

  it('걷기는 7프레임마다 두 그림이 번갈아 나온다', () => {
    const walking = fighter({ state: 'walk' });
    expect(poseKey(walking, 0)).toBe('walk2');
    expect(poseKey(walking, 7)).toBe('walk1');
    expect(poseKey(walking, 14)).toBe('walk2');
  });

  it('잡힌 상대는 붙잡힘, 들려 있음, 뒤집혀 던져짐 순서다', () => {
    expect(poseKey(fighter({ state: 'thrown', elapsed: 1 }), 0)).toBe('hurt');
    expect(poseKey(fighter({ state: 'thrown', elapsed: 10 }), 0)).toBe('held');
    expect(poseKey(fighter({ state: 'thrown', elapsed: 18 }), 0)).toBe('hurt-air');
    expect(poseKey(fighter({ state: 'thrown', elapsed: 21 }), 0)).toBe('tossed');
  });

  it('던지는 쪽은 움켜쥠, 들어 올림, 던짐 순서다', () => {
    expect(poseKey(fighter({ state: 'throwing', elapsed: 1 }), 0)).toBe('grab-x');
    expect(poseKey(fighter({ state: 'throwing', elapsed: 10 }), 0)).toBe('throw-lift');
    expect(poseKey(fighter({ state: 'throwing', elapsed: 20 }), 0)).toBe('throw-toss');
  });
});

describe('기술 자세', () => {
  it('준비 구간의 앞 60퍼센트는 준비, 나머지는 중간 자세이고, 중간 그림이 없는 기술은 준비만 쓴다', () => {
    expect(poseKey(attacking('a5', 0), 0)).toBe('jab-a');
    expect(poseKey(attacking('c5', 6), 0)).toBe('straight-m');
    expect(poseKey(attacking('a2', 2), 0)).toBe('cjab-a');
  });

  it('타격 구간은 타격 자세다', () => {
    expect(poseKey(attacking('a5', 3), 0)).toBe('jab-x');
    expect(poseKey(attacking('a5', 5), 0)).toBe('jab-x');
  });

  it('후딜의 앞 절반은 회수 자세, 나머지는 대기 자세다. 앉는 기술은 앉은 자세로 돌아온다', () => {
    expect(poseKey(attacking('c5', 12), 0)).toBe('straight-r');
    expect(poseKey(attacking('c5', 24), 0)).toBe('idle');
    expect(poseKey(attacking('c2', 24), 0)).toBe('crouch');
  });

  it('공중 기술은 발동 전에는 점프, 뒤에는 펀치나 킥 자세다', () => {
    expect(poseKey(attacking('ja', 2), 0)).toBe('jump');
    expect(poseKey(attacking('ja', 6), 0)).toBe('airpunch-x');
    expect(poseKey(attacking('jc', 8), 0)).toBe('airpunch-x');
    expect(poseKey(attacking('jb', 8), 0)).toBe('airkick-x');
    expect(poseKey(attacking('jd', 10), 0)).toBe('airkick-x');
  });

  it('분노 필살기는 구간마다 다른 기술 자세다', () => {
    expect(poseKey(attacking('super', 3), 0)).toBe('straight-a');
    expect(poseKey(attacking('super', 9), 0)).toBe('straight-x');
    expect(poseKey(attacking('super', 21), 0)).toBe('kickheavy-x');
    expect(poseKey(attacking('super', 36), 0)).toBe('upper-x');
    expect(poseKey(attacking('super', 45), 0)).toBe('upper-r');
    expect(poseKey(attacking('super', 65), 0)).toBe('idle');
  });

  it('잡기는 움켜쥐는 그림 묶음을 쓴다', () => {
    expect(poseKey(attacking('throw', 1), 0)).toBe('grab-a');
  });
});
