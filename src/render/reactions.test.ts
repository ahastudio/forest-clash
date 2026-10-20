import { describe, expect, it, vi } from 'vitest';
import { Sound } from '../audio/sound';
import type { GameEvent } from '../engine';
import { createEngine } from '../engine';
import { Effects } from './effects';
import { Reactions } from './reactions';

function setup() {
  const engine = createEngine();
  const effects = new Effects();
  const sound = new Sound();
  const played: [string, number | undefined][] = [];
  vi.spyOn(sound, 'play').mockImplementation((name, power) => {
    played.push([name, power]);
  });
  const reactions = new Reactions({ engine, effects, sound });
  const run = (...events: GameEvent[]): void => {
    engine.events.push(...events);
    reactions.handle();
  };
  return { engine, effects, played, run };
}

describe('사건 반응', () => {
  it('타격은 불꽃과 타격음이고 카운터 히트는 고리가 더해진다', () => {
    const { effects, played, run } = setup();
    run({ type: 'hit', x: 100, y: 60, power: 8, counter: false, attacker: 0, defender: 1, moveId: 'a5' });
    expect(played).toEqual([['hit', 8]]);
    expect(effects.bursts).toHaveLength(2);
    run({ type: 'hit', x: 100, y: 60, power: 8, counter: true, attacker: 0, defender: 1, moveId: 'a5' });
    expect(effects.bursts).toHaveLength(5);
  });

  it('높이를 모르는 타격은 몸 한가운데쯤에 불꽃이 튄다', () => {
    const { effects, run } = setup();
    run({ type: 'hit', x: 100, y: 0, power: 8, counter: false, attacker: 0, defender: 1, moveId: 'a5' });
    expect(effects.bursts[0]?.y).toBe(402);
  });

  it('막으면 파란 불꽃과 방어음이다', () => {
    const { effects, played, run } = setup();
    run({ type: 'block', x: 100, y: 60, attacker: 0, defender: 1, moveId: 'a5' });
    expect(played).toEqual([['block', undefined]]);
    expect(effects.particles.some(p => p.color === '#7ab8ff')).toBe(true);
  });

  it('주먹 기술은 주먹 소리, 나머지는 발차기 소리이고 분노 필살기는 한 번 더 울린다', () => {
    const { played, run } = setup();
    run({ type: 'move', id: 1, moveId: 'a5' });
    run({ type: 'move', id: 1, moveId: 'd5' });
    run({ type: 'move', id: 1, moveId: 'super' });
    expect(played.map(p => p[0])).toEqual(['punch', 'kick', 'kick', 'super']);
  });

  it('점프, 착지, 대시, 구르기는 소리와 먼지다', () => {
    const { effects, played, run } = setup();
    run({ type: 'jump', id: 1, hop: false });
    run({ type: 'land', id: 1 });
    run({ type: 'land', id: 1, hard: true });
    run({ type: 'dash', id: 1 });
    run({ type: 'roll', id: 1 });
    expect(played.map(p => p[0])).toEqual(['jump', 'land', 'land', 'dash', 'dash']);
    expect(effects.particles).toHaveLength(4 + 4 + 8 + 5 + 5);
  });

  it('잡기는 가운데에 불꽃이 튄다', () => {
    const { effects, played, run } = setup();
    run({ type: 'grab', id: 1, x: 100, y: 0 });
    expect(played.map(p => p[0])).toEqual(['grab']);
    expect(effects.particles.length).toBeGreaterThan(0);
  });

  it('K.O.는 큰 불꽃과 고리다', () => {
    const { effects, played, run } = setup();
    run({ type: 'ko', id: 0, x: 300 });
    expect(played).toEqual([['ko', undefined]]);
    expect(effects.bursts.some(b => b.max === 40)).toBe(true);
  });

  it('소리만 나는 사건과 아무 일도 없는 사건', () => {
    const { effects, played, run } = setup();
    run({ type: 'lift', id: 1 });
    run({ type: 'toss', id: 1 });
    run({ type: 'round', round: 1 });
    run({ type: 'fight' });
    run({ type: 'over', winner: 0 });
    run({ type: 'start' });
    run({ type: 'title' });
    run({ type: 'time' });
    expect(played.map(p => p[0])).toEqual(['lift', 'toss', 'round', 'fight', 'win']);
    expect(effects.particles).toHaveLength(0);
  });

  it('처리한 사건은 비워진다', () => {
    const { engine, run } = setup();
    run({ type: 'fight' });
    expect(engine.events).toHaveLength(0);
  });
});
