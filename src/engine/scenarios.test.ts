import { describe, expect, it } from 'vitest';
import { patch } from '../patch';
import type { Duel, Script } from '../testing/duel';
import { drive, eventsOf, hold, idlePad, isNeutral, seededRandom, setup, tap } from '../testing/duel';
import type { MoveId, PadInput } from './index';
import { constants, createEngine, MAX_HP, MOVES } from './index';

type Button = 'A' | 'B' | 'C' | 'D';
type Row = readonly [MoveId, Button, Partial<PadInput>];

const contactOf = (duel: Duel) => duel.events.find(e => e.type === 'hit' || e.type === 'block');
const movesOf = (duel: Duel) => eventsOf(duel, 'move').map(e => e.moveId);

describe('기술의 발동', () => {
  const rows: Row[] = [
    ['a5', 'A', {}],
    ['b5', 'B', {}],
    ['c5', 'C', {}],
    ['d5', 'D', {}],
    ['a2', 'A', { d: 1 }],
    ['b2', 'B', { d: 1 }],
    ['c2', 'C', { d: 1 }],
    ['d2', 'D', { d: 1 }],
  ];
  it.each(rows)('%s는 정확히 start 프레임에 맞는다', (id, button, extra) => {
    const duel = setup((MOVES[id].hitboxRange[1] ?? 0) - 8);
    drive(duel, 90, tap(button, 0, extra));
    const move = eventsOf(duel, 'move')[0];
    const contact = contactOf(duel);
    expect(contact && move ? contact.frame - move.frame : null).toBe(MOVES[id].start);
  });
});

/**
 * 앞+강공격은 잡기 범위(THROW_RANGE) 밖에서만 나간다. 막는 쪽은 뒤로 물러나므로,
 * 막는 경우는 방어자를 오른쪽 벽에 붙여 물러나지 못하게 하고 잰다.
 */
function duelFor(id: MoveId, retreating = false): Duel {
  if (id !== 'c6' && id !== 'd6') {
    return setup((MOVES[id].hitboxRange[1] ?? 0) - 8);
  }
  const duel = setup(constants.THROW_RANGE + 4);
  if (retreating) {
    patch(duel.R, { x: constants.WALL_R });
    patch(duel.L, { x: constants.WALL_R - constants.THROW_RANGE - 4 });
  }
  return duel;
}

/** 접촉한 뒤 공격자와 방어자 중 누가 몇 프레임 먼저 움직일 수 있게 되는가. */
function measureAdvantage(id: MoveId, button: Button, extra: Partial<PadInput>, block: boolean): number | null {
  const duel = duelFor(id, block);
  const defend = block ? { r: 1, d: MOVES[id].kind === 'low' ? 1 : 0 } : {};
  let freeAttacker: number | null = null;
  let freeDefender: number | null = null;
  let contact: number | null = null;
  for (let i = 0; i < 140 && (freeAttacker === null || freeDefender === null); i++) {
    drive(duel, 1, tap(button, 0, extra), hold(defend));
    contact ??= contactOf(duel) ? duel.engine.frame : null;
    if (contact === null || duel.engine.frame <= contact) {
      continue;
    }
    if (freeAttacker === null && isNeutral(duel.L) && duel.L.state !== 'attack') {
      freeAttacker = duel.engine.frame;
    }
    if (freeDefender === null && isNeutral(duel.R)) {
      freeDefender = duel.engine.frame;
    }
  }
  return freeAttacker !== null && freeDefender !== null ? freeDefender - freeAttacker : null;
}

describe('막힘·맞음 이득은 기술 표(`MOVES`)의 값과 같다', () => {
  const rows: Row[] = [
    ['a5', 'A', {}],
    ['b5', 'B', {}],
    ['c5', 'C', {}],
    ['d5', 'D', {}],
    ['a2', 'A', { d: 1 }],
    ['b2', 'B', { d: 1 }],
    ['c2', 'C', { d: 1 }],
    ['c6', 'C', { r: 1 }],
    ['d6', 'D', { r: 1 }],
  ];
  it.each(rows)('막힘 이득 %s', (id, button, extra) => {
    expect(measureAdvantage(id, button, extra, true)).toBe(MOVES[id].blockAdvantage);
  });
  const hitRows = rows.filter(([id]) => typeof MOVES[id].hitAdvantage === 'number' && !MOVES[id].launchSpeed);
  it.each(hitRows)('맞음 이득 %s', (id, button, extra) => {
    expect(measureAdvantage(id, button, extra, false)).toBe(MOVES[id].hitAdvantage);
  });
});

describe('방어 높이', () => {
  const outcome = (id: MoveId, button: Button, extra: Partial<PadInput>, defend: Partial<PadInput>): string => {
    const duel = duelFor(id, !!defend.r);
    drive(duel, 80, tap(button, 0, extra), hold(defend));
    if (duel.events.some(e => e.type === 'block')) {
      return '막음';
    }
    return duel.events.some(e => e.type === 'hit') ? '맞음' : '헛침';
  };
  it('중단은 서서도 앉아서도 막는다', () => {
    expect(outcome('a5', 'A', {}, { r: 1 })).toBe('막음');
    expect(outcome('a5', 'A', {}, { r: 1, d: 1 })).toBe('막음');
  });
  it('상단은 서서만 막는다', () => {
    expect(outcome('c6', 'C', { r: 1 }, { r: 1 })).toBe('막음');
    expect(outcome('c6', 'C', { r: 1 }, { r: 1, d: 1 })).toBe('맞음');
  });
  it('하단은 앉아서만 막는다', () => {
    expect(outcome('b2', 'B', { d: 1 }, { r: 1, d: 1 })).toBe('막음');
    expect(outcome('b2', 'B', { d: 1 }, { r: 1 })).toBe('맞음');
  });
  it('방어하지 않으면 맞는다', () => {
    expect(outcome('a5', 'A', {}, {})).toBe('맞음');
  });
});

describe('막힘과 후딜', () => {
  it('막힘 경직 중에도 계속 막고, 막으면 피해가 없다', () => {
    const duel = setup(70);
    drive(duel, 200, i => (i % 12 === 0 ? { A: 1 } : {}), hold({ r: 1 }));
    expect(eventsOf(duel, 'hit')).toHaveLength(0);
    expect(eventsOf(duel, 'block').length).toBeGreaterThanOrEqual(2);
    expect(duel.R.hp).toBe(MAX_HP);
  });

  it('헛친 강펀치는 후딜 동안 움직일 수 없다', () => {
    const duel = setup(300);
    drive(duel, 1, tap('C'));
    const start = duel.engine.frame;
    let free: number | null = null;
    for (let i = 0; i < 80 && free === null; i++) {
      drive(duel, 1, tap('A', 0));
      if (duel.engine.frame > start + 2 && isNeutral(duel.L)) {
        free = duel.engine.frame - start;
      }
    }
    expect(free).toBeGreaterThanOrEqual(MOVES.c5.total - 3);
  });

  it('막은 뒤 후딜에 약펀치로 반격하면 맞는다', () => {
    const duel = setup(72);
    patch(duel.R, { x: constants.WALL_R });
    patch(duel.L, { x: constants.WALL_R - 72 });
    let blocked = false;
    let punished = false;
    drive(duel, 1, tap('D'), hold({ r: 1 }));
    for (let i = 0; i < 70 && !punished; i++) {
      blocked = blocked || duel.events.some(e => e.type === 'block');
      const recovering =
        blocked && duel.L.state === 'attack' && duel.L.elapsed > MOVES.d5.end && duel.R.state === 'blockstun';
      const counter = recovering && duel.R.stunFrames <= 2 && Math.abs(duel.L.x - duel.R.x) <= 111;
      drive(duel, 1, null, () => (counter ? { A: 1 } : blocked ? {} : { r: 1 }));
      punished = duel.events.some(e => e.type === 'hit' && e.attacker === 0);
    }
    expect(punished && duel.L.hp < MAX_HP).toBe(true);
  });

  it('연타하는 쪽이 막고 반격하는 쪽에 진다', () => {
    let mashWins = 0;
    let counterWins = 0;
    let hpGap = 0;
    for (let seed = 0; seed < 8; seed++) {
      const duel = setup(110);
      const rand = seededRandom(seed * 7919 + 13);
      const buttons = ['A', 'B', 'C', 'D'] as const;
      const masher: Script = () => {
        const pad: Partial<PadInput> = {};
        if (Math.abs(duel.R.x - duel.L.x) > constants.THROW_RANGE && rand() < 0.9) {
          pad.r = 1;
        }
        if (rand() < 0.2) {
          pad[buttons[Math.floor(rand() * 4)] as Button] = 1;
        }
        if (rand() < 0.1) {
          pad.d = 1;
        }
        return pad;
      };
      const counterer: Script = () => {
        const move = duel.L.moveId ? MOVES[duel.L.moveId] : null;
        const distance = Math.abs(duel.L.x - duel.R.x);
        const recovering = duel.L.state === 'attack' && !!move && duel.L.elapsed > move.end && distance <= 100;
        if (recovering && rand() < 0.9) {
          return { A: 1 };
        }
        if (duel.R.state === 'thrown' && duel.R.elapsed <= 9) {
          return { C: 1 };
        }
        return {
          ...(distance < 150 ? { r: 1 } : {}),
          ...(duel.L.state === 'attack' && move?.kind === 'low' ? { d: 1 } : {}),
        };
      };
      for (let i = 0; i < 1800 && duel.engine.phase === 'fight'; i++) {
        drive(duel, 1, masher, counterer);
      }
      if (duel.L.hp < duel.R.hp - 2) {
        counterWins++;
      } else if (duel.R.hp < duel.L.hp - 2) {
        mashWins++;
      }
      hpGap += duel.R.hp - duel.L.hp;
    }
    expect(mashWins).toBeLessThanOrEqual(1);
    expect(counterWins).toBeGreaterThanOrEqual(6);
    expect(hpGap).toBeGreaterThanOrEqual(100);
  });
});

describe('카운터 히트와 맞교환', () => {
  it('상대 기술이 발동하는 중에 맞히면 카운터 히트이고 피해가 25퍼센트 늘며 상대 기술이 끊긴다', () => {
    const duel = setup(78);
    drive(duel, 1, tap('B'), null);
    drive(duel, 1, null, tap('A'));
    drive(duel, 40);
    const hit = eventsOf(duel, 'hit').find(e => e.attacker === 0);
    expect(hit?.counter).toBe(true);
    expect(hit?.damage).toBe(Math.round(MOVES.a5.damage * 1.25));
    expect(eventsOf(duel, 'hit').some(e => e.attacker === 1)).toBe(false);
  });

  it('같은 프레임에 서로 맞히면 둘 다 맞는다', () => {
    const duel = setup(70);
    drive(duel, 20, tap('A'), tap('A'));
    const hits = eventsOf(duel, 'hit');
    expect(hits.some(e => e.attacker === 0) && hits.some(e => e.attacker === 1)).toBe(true);
    expect(duel.L.hp < MAX_HP && duel.R.hp < MAX_HP).toBe(true);
  });
});

describe('연계와 취소', () => {
  it('앉아 약펀치 → 앉아 약킥 링크 → 대공 어퍼 취소 콤보', () => {
    const duel = setup(70);
    const script: Script = i => {
      if (i < 24) {
        return i === 0 ? { d: 1, A: 1 } : i === 13 ? { d: 1, B: 1 } : { d: 1 };
      }
      if (i < 26) {
        return { r: 1 };
      }
      if (i < 28) {
        return { d: 1 };
      }
      return i === 28 ? { d: 1, A: 1 } : {};
    };
    drive(duel, 120, script);
    const hits = eventsOf(duel, 'hit')
      .filter(e => e.attacker === 1)
      .map(e => e.moveId);
    expect(hits.slice(0, 2)).toEqual(['a2', 'b2']);
    expect(new Set(hits).size).toBeGreaterThanOrEqual(3);
    expect(hits).toContain('dp_a');
    expect(eventsOf(duel, 'block')).toHaveLength(0);
  });
});

describe('특수기 입력', () => {
  const special = (script: Script) => {
    const duel = setup(300);
    drive(duel, 40, script);
    return movesOf(duel);
  };
  it('↓→ + 약펀치는 돌진 팔꿈치다(대각선 없이)', () => {
    expect(special(i => (i < 2 ? { d: 1 } : i < 4 ? { r: 1 } : i === 4 ? { r: 1, A: 1 } : {}))).toContain('elbow_a');
  });
  it('→↓ + 약펀치는 대공 어퍼다(대각선 없이)', () => {
    expect(special(i => (i < 2 ? { r: 1 } : i < 4 ? { d: 1 } : i === 4 ? { d: 1, A: 1 } : {}))).toContain('dp_a');
  });
  it('→↓→ + 약펀치는 마지막 입력이 앞이라 돌진 팔꿈치다', () => {
    const moves = special(i =>
      i < 2 ? { r: 1 } : i < 4 ? { d: 1 } : i < 6 ? { r: 1 } : i === 6 ? { r: 1, A: 1 } : {},
    );
    expect(moves).toContain('elbow_a');
    expect(moves).not.toContain('dp_a');
  });
  it('대각선을 눌러도 돌진 팔꿈치다(패드 호환)', () => {
    expect(
      special(i => (i < 2 ? { d: 1 } : i < 4 ? { d: 1, r: 1 } : i < 6 ? { r: 1 } : i === 6 ? { r: 1, A: 1 } : {})),
    ).toContain('elbow_a');
  });
  it('위 다음에 앞을 눌러도 앞으로 점프한다', () => {
    const duel = setup(300);
    drive(duel, 30, i => (i < 4 ? { u: 1 } : i < 8 ? { u: 1, r: 1 } : {}));
    expect(duel.L.x > 510 || duel.L.velocityX > 0).toBe(true);
  });
  it('대공 어퍼는 시작 5프레임 동안 무적이다', () => {
    const duel = setup(70);
    const rising: Script = i => (i < 2 ? { r: 1 } : i < 4 ? { d: 1 } : i === 4 ? { d: 1, A: 1 } : {});
    drive(duel, 30, rising, i => (i === 4 ? { A: 1 } : {}));
    expect(eventsOf(duel, 'hit').some(e => e.attacker === 0)).toBe(false);
  });
});

describe('잡기', () => {
  const grabAt = (i: number): Partial<PadInput> => (i === 0 ? { r: 1, C: 1 } : i === 1 ? { r: 1 } : {});
  it('방어하지 않아도 잡힌다', () => {
    const duel = setup(55);
    drive(duel, 60, grabAt);
    expect(duel.R.hp).toBe(MAX_HP - MOVES.throw.damage);
  });
  it('잡히면 어떤 버튼을 눌러도 풀리지 않고 끝까지 던져진다', () => {
    const duel = setup(55);
    const mash: Script = i =>
      i < 14 ? {} : { A: i % 2, B: (i + 1) % 2, C: i % 3 === 0 ? 1 : 0, D: i % 3 === 1 ? 1 : 0, u: 1, l: 1 };
    drive(duel, 60, grabAt, mash);
    expect(duel.R.hp).toBe(MAX_HP - MOVES.throw.damage);
    expect(eventsOf(duel, 'toss')).toHaveLength(1);
  });
  it('방어를 무시한다', () => {
    const duel = setup(55);
    drive(duel, 60, grabAt, hold({ r: 1 }));
    expect(duel.R.hp).toBeLessThan(MAX_HP);
    expect(eventsOf(duel, 'grab')).toHaveLength(1);
  });
  it('멀리서는 잡기가 나가지 않고 앞+강펀치가 나간다', () => {
    const duel = setup(130);
    drive(duel, 70, grabAt);
    expect(eventsOf(duel, 'grab')).toHaveLength(0);
    expect(movesOf(duel)).toContain('c6');
  });
  it('들어 올림, 던짐, 타격이 순서대로 일어나고 머리 위로 들린다', () => {
    const duel = setup(55);
    let maxAlt = 0;
    for (let i = 0; i < 40; i++) {
      drive(duel, 1, () => (i === 0 ? { r: 1, C: 1 } : { r: 1 }));
      maxAlt = Math.max(maxAlt, duel.R.altitude);
    }
    const order = duel.events.filter(e => ['grab', 'lift', 'toss', 'hit'].includes(e.type)).map(e => e.type);
    expect(order).toEqual(['grab', 'lift', 'toss', 'hit']);
    expect(maxAlt).toBeGreaterThanOrEqual(50);
    expect(duel.R.x).toBeGreaterThan(duel.L.x + 40);
    expect(duel.R.hp).toBe(MAX_HP - MOVES.throw.damage);
  });
  it('상대의 공격에 판정이 나온 뒤에는 잡을 수 없다', () => {
    const duel = setup(55);
    drive(duel, 60, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), tap('A'));
    expect(eventsOf(duel, 'grab')).toHaveLength(0);
  });
  it('들어 올려진 동안에는 아무 입력에도 움직이지 않는다', () => {
    const duel = setup(55);
    drive(
      duel,
      20,
      i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }),
      i => (i < 14 ? {} : { D: 1, u: 1, l: 1 }),
    );
    expect(duel.R.state).toBe('thrown');
    expect(duel.R.altitude).toBeGreaterThan(0);
  });
  it('근거리에서는 상대가 맞는 중이어도 큰 공격 대신 잡기가 나간다(잡을 수 없으면 헛친다)', () => {
    const duel = setup(55);
    patch(duel.R, { state: 'hitstun', stunFrames: 30 });
    drive(duel, 40, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }));
    expect(movesOf(duel)).toContain('throw');
    expect(movesOf(duel)).not.toContain('c6');
    expect(eventsOf(duel, 'grab')).toHaveLength(0);
  });
  it('근거리에서 앞이나 뒤로 밀면서 강펀치나 강킥을 누르면 곧바로 잡기가 나간다', () => {
    const inputs = [
      { r: 1, C: 1 },
      { r: 1, D: 1 },
      { l: 1, C: 1 },
      { l: 1, D: 1 },
    ];
    for (const input of inputs) {
      const duel = setup(55);
      drive(duel, 60, i => (i === 0 ? input : { r: input.r, l: input.l }));
      expect(eventsOf(duel, 'grab')).toHaveLength(1);
      expect(movesOf(duel)).not.toContain('c6');
    }
  });
  it('약펀치를 세 번 연타해 막힌 뒤 잡기는 상대가 물러나지 못하면 잡히고, 물러나면 놓친다', () => {
    const attempt = (pinned: boolean): Duel => {
      const duel = setup(55);
      if (pinned) {
        patch(duel.R, { x: constants.WALL_R });
        patch(duel.L, { x: constants.WALL_R - 55 });
      }
      const jabAt = (i: number): boolean => i === 0 || i === 9 || i === 18;
      drive(duel, 31, i => ({ r: 1, A: jabAt(i) ? 1 : 0 }), hold({ r: 1 }));
      drive(duel, 60, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), hold({ r: 1 }));
      return duel;
    };
    expect(eventsOf(attempt(true), 'grab')).toHaveLength(1);
    expect(eventsOf(attempt(false), 'grab')).toHaveLength(0);
  });
  it('오른쪽에 선 쪽도 앞(왼쪽)으로 밀면서 강펀치를 누르면 잡는다', () => {
    const duel = setup(55);
    drive(duel, 60, null, i => (i === 0 ? { l: 1, C: 1 } : { l: 1 }));
    expect(eventsOf(duel, 'grab')).toHaveLength(1);
    expect(duel.L.hp).toBe(MAX_HP - MOVES.throw.damage);
  });
  it('방향 없이 누르거나 약한 버튼이면 잡기가 아니라 일반 공격이 나간다', () => {
    const neutral = setup(55);
    drive(neutral, 60, i => (i === 0 ? { C: 1 } : {}));
    expect(eventsOf(neutral, 'grab')).toHaveLength(0);
    expect(movesOf(neutral)).toContain('c5');
    const light = setup(55);
    drive(light, 60, i => (i === 0 ? { r: 1, A: 1 } : { r: 1 }));
    expect(eventsOf(light, 'grab')).toHaveLength(0);
  });
  it('잡기는 약한 공격보다 느리고 강한 공격과 비슷하게 발동한다', () => {
    const light = Math.max(MOVES.a5.start, MOVES.b5.start);
    expect(MOVES.throw.start).toBeGreaterThan(light);
    expect(Math.abs(MOVES.throw.start - MOVES.c5.start)).toBeLessThanOrEqual(1);
    expect(Math.abs(MOVES.throw.start - MOVES.d5.start)).toBeLessThanOrEqual(1);
  });
  it('잡으려는 사이에 상대가 약펀치로 때리면 잡기가 끊기고 맞는다', () => {
    const duel = setup(55);
    drive(duel, 40, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), tap('A'));
    expect(eventsOf(duel, 'grab')).toHaveLength(0);
    expect(duel.L.hp).toBeLessThan(MAX_HP);
  });
  it('상대가 강킥을 막 시작했을 때는 발동 전이라 잡히고, 강펀치는 먼저 발동해 잡으려는 쪽이 맞는다', () => {
    const kick = setup(55);
    drive(kick, 60, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), tap('D'));
    expect(eventsOf(kick, 'grab')).toHaveLength(1);
    expect(kick.L.hp).toBe(MAX_HP);
    const punch = setup(55);
    drive(punch, 40, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), tap('C'));
    expect(eventsOf(punch, 'grab')).toHaveLength(0);
    expect(punch.L.hp).toBeLessThan(MAX_HP);
  });
  it('막고 있는 상대도 잡는다', () => {
    const guarded = setup(55);
    drive(guarded, 60, i => (i === 0 ? { r: 1, C: 1 } : { r: 1 }), hold({ r: 1 }));
    expect(eventsOf(guarded, 'grab')).toHaveLength(1);
    expect(eventsOf(guarded, 'block')).toHaveLength(0);
  });
  it('앉으면 잡기가 아니라 앉아 강펀치가 나가고, 조금 멀면 서서 강펀치가 나간다', () => {
    const crouched = setup(55);
    drive(crouched, 60, i => (i === 0 ? { d: 1, C: 1 } : { d: 1 }));
    expect(eventsOf(crouched, 'grab')).toHaveLength(0);
    expect(movesOf(crouched)).toContain('c2');
    const far = setup(90);
    drive(far, 60, i => (i === 0 ? { C: 1 } : {}));
    expect(eventsOf(far, 'grab')).toHaveLength(0);
    expect(movesOf(far)).toContain('c5');
  });
});

describe('이동', () => {
  const airStats = (upFrames: number) => {
    const duel = setup(300);
    let air = 0;
    let maxAlt = 0;
    for (let i = 0; i < 100; i++) {
      drive(duel, 1, () => (i < upFrames ? { u: 1 } : {}));
      if (duel.L.altitude > 0) {
        air++;
        maxAlt = Math.max(maxAlt, duel.L.altitude);
      }
      if (i > 10 && duel.L.altitude === 0 && air > 0) {
        break;
      }
    }
    return { air, maxAlt };
  };
  it('낮은 점프는 일반 점프보다 짧고 낮다', () => {
    const hop = airStats(2);
    const jump = airStats(8);
    expect(hop.air).toBeLessThan(jump.air);
    expect(hop.maxAlt).toBeLessThan(jump.maxAlt);
    expect(hop.air).toBeGreaterThan(20);
  });
  it('앞 두 번은 달리기다', () => {
    const duel = setup(300);
    drive(duel, 3, i => (i === 0 ? { r: 1 } : {}));
    drive(duel, 3, null);
    drive(duel, 12, hold({ r: 1 }));
    expect(duel.L.state).toBe('run');
    expect(Math.abs(duel.L.velocityX)).toBeGreaterThanOrEqual(4.5);
  });
  it('뒤 두 번은 뒤 대시다', () => {
    const duel = setup(300);
    drive(duel, 3, i => (i === 0 ? { l: 1 } : {}));
    drive(duel, 3, null);
    drive(duel, 2, hold({ l: 1 }));
    expect(duel.L.state).toBe('bdash');
  });
  it('구르기는 앞부분이 무적이다', () => {
    const duel = setup(60);
    drive(duel, 3, hold({ A: 1, B: 1 }));
    drive(duel, 4, null, tap('A', 0));
    expect(duel.L.state).toBe('roll');
    expect(eventsOf(duel, 'hit').some(e => e.attacker === 0)).toBe(false);
  });
  it('걷기 속도는 프레임당 2.4다', () => {
    const duel = setup(300);
    drive(duel, 80, hold({ r: 1 }));
    expect(Math.abs(duel.L.x - 500 - 80 * 2.4)).toBeLessThan(40);
  });
});

describe('공중 기술', () => {
  const kickOutcome = (jump: Script, dist: number, at: number, defend: Partial<PadInput>): string => {
    const duel = setup(dist);
    drive(duel, 80, i => (i === at ? { D: 1 } : jump(i)), hold(defend));
    if (duel.events.some(e => e.type === 'block' && e.moveId === 'jd')) {
      return '막음';
    }
    return duel.events.some(e => e.type === 'hit' && e.moveId === 'jd') ? '맞음' : '헛침';
  };
  const lowHop: Script = i => (i < 2 ? { u: 1, r: 1 } : {});
  const highJump: Script = i => (i < 24 ? { u: 1, r: 1 } : {});
  it('점프 킥은 상단이라 서서는 막고 앉으면 맞는다', () => {
    const results: Record<string, Set<string>> = { stand: new Set(), crouch: new Set() };
    for (const jump of [lowHop, highJump]) {
      for (const dist of [95, 135]) {
        for (let at = 4; at <= 44; at += 4) {
          results.stand?.add(kickOutcome(jump, dist, at, { r: 1 }));
          results.crouch?.add(kickOutcome(jump, dist, at, { r: 1, d: 1 }));
        }
      }
    }
    expect(results.stand?.has('막음')).toBe(true);
    expect(results.crouch?.has('맞음')).toBe(true);
    expect(results.crouch?.has('막음')).toBe(false);
  });
  it('공중 킥 판정은 발끝, 아래 앞쪽이다', () => {
    const [, far, bottom, top] = MOVES.jd.hitboxRange;
    expect(bottom).toBeLessThanOrEqual(10);
    expect(top).toBeLessThanOrEqual(40);
    expect(far).toBeGreaterThanOrEqual(50);
  });
});

describe('분노 필살기', () => {
  const super_: Script = i =>
    i < 2 ? { d: 1 } : i < 4 ? { r: 1 } : i < 6 ? { d: 1 } : i < 8 ? { r: 1 } : i === 8 ? { r: 1, C: 1 } : {};
  it('게이지가 가득이면 나가고 게이지를 모두 쓰며 여러 타가 맞는다', () => {
    const duel = setup(70);
    duel.L.rage = 100;
    drive(duel, 160, super_);
    expect(movesOf(duel)).toContain('super');
    expect(duel.L.rage).toBeLessThan(100);
    expect(eventsOf(duel, 'hit').filter(e => e.attacker === 1).length).toBeGreaterThanOrEqual(2);
  });
  it('게이지가 모자라면 나가지 않는다', () => {
    const duel = setup(70);
    duel.L.rage = 50;
    drive(duel, 60, super_);
    expect(movesOf(duel)).not.toContain('super');
  });
});

describe('벽과 쓰러짐', () => {
  it('벽 앞에서 막아도 벽 밖으로 나가지 않는다', () => {
    const duel = setup(70);
    patch(duel.R, { x: constants.WALL_R });
    patch(duel.L, { x: constants.WALL_R - 70 });
    drive(duel, 200, i => (i % 16 === 0 ? { C: 1 } : {}), hold({ r: 1 }));
    expect(duel.R.x).toBeLessThanOrEqual(constants.WALL_R + 0.01);
    expect(duel.R.x).toBeGreaterThanOrEqual(constants.WALL_L);
  });
  it('두 캐릭터는 최대 간격을 넘어 벌어지지 않는다', () => {
    const duel = setup(300);
    drive(duel, 400, hold({ l: 1 }), hold({ r: 1 }));
    expect(Math.abs(duel.L.x - duel.R.x)).toBeLessThanOrEqual(constants.MAX_SEPARATION + 1);
  });
  it('쓸기는 쓰러뜨리고, 쓰러진 뒤 일어나 행동할 수 있다', () => {
    const duel = setup(70);
    drive(duel, 200, i => (i === 0 ? { d: 1, D: 1 } : { d: 1 }));
    expect(eventsOf(duel, 'hit').some(e => e.moveId === 'd2')).toBe(true);
    expect(eventsOf(duel, 'land').some(e => e.hard)).toBe(true);
    expect(isNeutral(duel.R)).toBe(true);
  });
});

describe('한 판의 진행', () => {
  it('타이틀 → 대전 → 결과 → 타이틀, 한 판이 오류 없이 끝난다', () => {
    const engine = createEngine();
    const step = (a: Partial<PadInput> = idlePad(), b: Partial<PadInput> = idlePad()): void => {
      engine.step([a, b]);
      engine.consume();
    };
    for (let i = 0; i < 60; i++) {
      step();
    }
    expect(engine.phase).toBe('title');
    step({ A: 1 });
    step();
    expect(engine.phase).toBe('intro');
    expect(engine.mode).toBe('cpu');
    const rand = seededRandom(5);
    const buttons = ['A', 'B', 'C', 'D'] as const;
    const randomPad = (): Partial<PadInput> => ({
      l: rand() < 0.3 ? 1 : 0,
      r: rand() < 0.3 ? 1 : 0,
      u: rand() < 0.04 ? 1 : 0,
      d: rand() < 0.2 ? 1 : 0,
      ...(rand() < 0.12 ? { [buttons[Math.floor(rand() * 4)] as string]: 1 } : {}),
    });
    for (let ticks = 0; engine.phase !== 'over' && ticks < 60000; ticks++) {
      step(randomPad(), randomPad());
    }
    expect(engine.phase).toBe('over');
    for (let i = 0; i < 130; i++) {
      step();
    }
    step({ B: 1 });
    step();
    expect(engine.phase).toBe('title');
    for (let i = 0; i < 30; i++) {
      step();
    }
    step(idlePad(), { D: 1 });
    step();
    expect(engine.phase).toBe('intro');
    expect(engine.mode).toBe('2p');
  });
});
