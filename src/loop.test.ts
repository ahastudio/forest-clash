import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixedStepLoop } from './loop';

afterEach(() => vi.useRealTimers());

function setup(speed = 1) {
  let clock = 1000;
  const frames: (() => void)[] = [];
  const game = { update: vi.fn(() => true), render: vi.fn() };
  const host = { now: () => clock, requestFrame: (callback: () => void) => frames.push(callback) };
  const loop = new FixedStepLoop(host, game, speed);
  return { loop, game, frames, advance: (ms: number) => (clock += ms) };
}

describe('고정 시간 간격 반복', () => {
  it('지난 시간만큼만 시뮬레이션을 진행하고 매번 한 번 그린다', () => {
    const { loop, game, advance } = setup();
    advance(51);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(3);
    expect(game.render).toHaveBeenCalledTimes(1);
  });

  it('남은 시간은 다음으로 이월된다', () => {
    const { loop, game, advance } = setup();
    advance(10);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(0);
    advance(10);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(1);
  });

  it('한 번에 너무 오래 쉬어도 몰아서 진행하지 않는다', () => {
    const { loop, game, advance } = setup();
    advance(5000);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(4);
  });

  it('속도를 낮추면 같은 시간에 진행이 줄어든다', () => {
    const { loop, game, advance } = setup(0.5);
    advance(50);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(1);
  });

  it('시작하면 바로 한 번 돌리고 다음 프레임을 예약한다', () => {
    const { loop, game, frames, advance } = setup();
    loop.start();
    expect(game.render).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    advance(17);
    frames[0]?.();
    expect(game.render).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(2);
  });

  it('진행하지 못한 프레임의 시간은 돌려받아 입력이 오면 따라잡는다', () => {
    const { loop, game, advance } = setup();
    game.update.mockReturnValueOnce(false);
    advance(34);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(1);
    advance(17);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(4);
  });

  it('기다리는 동안은 그 틱에 더 시도하지 않는다', () => {
    const { loop, game, advance } = setup();
    game.update.mockReturnValue(false);
    advance(100);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(1);
  });

  it('오래 기다려도 돌려받는 시간은 한도까지만 쌓인다', () => {
    const { loop, game, advance } = setup();
    game.update.mockReturnValue(false);
    for (let tick = 0; tick < 50; tick++) {
      advance(100);
      loop.tick();
    }
    game.update.mockReturnValue(true);
    game.update.mockClear();
    advance(1);
    loop.tick();
    expect(game.update).toHaveBeenCalledTimes(4);
  });

  it('그릴 때는 현재 시각을 넘긴다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(123456);
    const { loop, game } = setup();
    loop.tick();
    expect(game.render).toHaveBeenCalledWith(123456);
  });
});
