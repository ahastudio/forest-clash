import { afterEach, describe, expect, it, vi } from 'vitest';
import { create } from './ai';
import type { Engine, Fighter, PadInput } from './engine';
import { createEngine } from './engine';

afterEach(() => vi.restoreAllMocks());

/** 테스트마다 같은 값이 나오도록 하는 난수 생성기. */
function mulberry(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열을 32비트 숫자로 섞어 이어 붙인다. */
function mix(hash: number, text: string): number {
  let next = hash;
  for (let i = 0; i < text.length; i++) {
    next = Math.imul(next ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return next;
}

/** 눈에 보이는 결과만 요약한다(위치, 높이, 체력, 분노, 상태, 방향). 내부 기록의 모양이 바뀌어도 값이 변하지 않는다. */
const fighterSummary = (fighter: Fighter) => [
  fighter.x,
  fighter.altitude,
  fighter.hp,
  fighter.rage,
  fighter.state,
  fighter.face,
];

const frameSummary = (engine: Engine, events: unknown): string =>
  JSON.stringify([
    engine.fighters.map(fighterSummary),
    engine.phase,
    engine.roundTimer,
    engine.wins,
    engine.hitstop,
    engine.comboCount,
    events,
  ]);

interface Outcome {
  frames: number;
  wins: [number, number];
  winner: number | null;
  digest: string;
}

/** 컴퓨터끼리 한 판을 끝까지 두고, 모든 프레임의 상태를 하나의 값으로 요약한다. */
function playMatch(seed: number, levels: [number, number]): Outcome {
  vi.spyOn(Math, 'random').mockImplementation(mulberry(seed));
  const engine = createEngine();
  const idle: Partial<PadInput> = {};
  engine.toTitle();
  for (let i = 0; i < 25; i++) {
    engine.step([idle, idle]);
  }
  engine.step([{ A: 1 }, idle]);
  engine.newMatch('2p');
  const [first, second] = [create(engine, { level: levels[0] }), create(engine, { level: levels[1] })];
  let digest = 2166136261;
  let frames = 0;
  while (engine.phase !== 'over' && frames < 30000) {
    frames++;
    engine.step([first(0), second(1)]);
    digest = mix(digest, frameSummary(engine, engine.consume()));
  }
  return { frames, wins: engine.wins, winner: engine.matchWinner, digest: digest.toString(16) };
}

describe('회귀: 컴퓨터끼리 한 판은 언제나 같은 결과가 나온다', () => {
  it('아주 쉬움 대 아주 쉬움', () => {
    expect(playMatch(11, [0, 0])).toMatchInlineSnapshot(`
      {
        "digest": "d6c61264",
        "frames": 4217,
        "winner": 1,
        "wins": [
          0,
          2,
        ],
      }
    `);
  });

  it('보통 대 어려움', () => {
    expect(playMatch(22, [2, 3])).toMatchInlineSnapshot(`
      {
        "digest": "83453246",
        "frames": 6756,
        "winner": 1,
        "wins": [
          1,
          2,
        ],
      }
    `);
  });

  it('어려움 대 어려움', () => {
    expect(playMatch(33, [3, 3])).toMatchInlineSnapshot(`
      {
        "digest": "f0d191e2",
        "frames": 4189,
        "winner": 1,
        "wins": [
          0,
          2,
        ],
      }
    `);
  });
});
