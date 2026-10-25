import { describe, expect, it } from 'vitest';
import { PingMeter } from './ping';

function setup() {
  let clock = 0;
  const meter = new PingMeter(() => clock);
  return { meter, tick: (milliseconds: number) => (clock += milliseconds) };
}

describe('핑 재기', () => {
  it('처음에는 바로 보낼 때이고, 보낸 뒤 1초가 지나야 다시 보낸다', () => {
    const { meter, tick } = setup();
    expect(meter.due()).toBe(0);
    tick(999);
    expect(meter.due()).toBeNull();
    tick(1);
    expect(meter.due()).toBe(1000);
  });

  it('잰 적이 없으면 값이 없고, 첫 값은 그대로 쓴다', () => {
    const { meter, tick } = setup();
    expect(meter.milliseconds).toBeNull();
    const sentAt = meter.due() ?? 0;
    tick(42);
    meter.record(sentAt);
    expect(meter.milliseconds).toBe(42);
  });

  it('새로 잰 값은 평균에 30퍼센트만 반영하고 반올림한다', () => {
    const { meter, tick } = setup();
    tick(100);
    meter.record(0);
    expect(meter.milliseconds).toBe(100);
    meter.record(50);
    expect(meter.milliseconds).toBe(85);
    meter.record(75);
    expect(meter.milliseconds).toBe(67);
  });

  it('처음으로 되돌리면 값이 지워지고 바로 다시 보낸다', () => {
    const { meter, tick } = setup();
    meter.due();
    tick(10);
    meter.record(0);
    meter.reset();
    expect(meter.milliseconds).toBeNull();
    expect(meter.due()).toBe(10);
  });
});
