const PING_INTERVAL_MS = 1000;
// 새로 잰 값이 평균에 반영되는 비율. 낮을수록 숫자가 덜 흔들린다.
const NEW_SAMPLE_WEIGHT = 0.3;

/**
 * 서버와의 왕복 시간(핑)을 일정한 간격으로 재고, 흔들림을 줄인 값을 알려 준다.
 */
export class PingMeter {
  private nextAt = 0;
  private smoothed: number | null = null;

  constructor(private readonly now: () => number) {}

  /**
   * 보낼 때가 되었으면 ping에 실을 지금 시각을, 아직이면 null을 돌려준다.
   */
  due(): number | null {
    const now = this.now();
    if (now < this.nextAt) {
      return null;
    }
    this.nextAt = now + PING_INTERVAL_MS;
    return now;
  }

  /**
   * pong이 돌아왔다. 보낸 시각부터 지금까지를 왕복 시간으로 삼는다.
   */
  record(sentAt: number): void {
    const sample = this.now() - sentAt;
    this.smoothed = this.smoothed === null ? sample : this.smoothed + (sample - this.smoothed) * NEW_SAMPLE_WEIGHT;
  }

  /**
   * 평균 왕복 시간(밀리초). 아직 재지 못했으면 null이다.
   */
  get milliseconds(): number | null {
    return this.smoothed === null ? null : Math.round(this.smoothed);
  }

  /**
   * 새 판을 위해 처음으로 되돌린다.
   */
  reset(): void {
    this.nextAt = 0;
    this.smoothed = null;
  }
}
