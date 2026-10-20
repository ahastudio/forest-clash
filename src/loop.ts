const FRAMES_PER_SECOND = 60;
const MAX_ELAPSED_MS = 100;
const MAX_STEPS_PER_TICK = 4;

interface LoopHost {
  now(): number;
  requestFrame(callback: () => void): void;
}

/** 고정 시간 간격으로 시뮬레이션을 돌리고, 화면은 그릴 수 있을 때마다 그린다. */
export class FixedStepLoop {
  private accumulated = 0;
  private last: number;
  private readonly stepMs: number;

  constructor(
    private readonly host: LoopHost,
    private readonly game: { update(): void; render(now: number): void },
    speed: number,
  ) {
    this.last = host.now();
    this.stepMs = 1000 / (FRAMES_PER_SECOND * speed);
  }

  /** 지난 시간을 돌려주고 지금을 기억한다. */
  private elapsed(): number {
    const now = this.host.now();
    const elapsed = now - this.last;
    this.last = now;
    return elapsed;
  }

  /** 쌓인 시간만큼 시뮬레이션을 진행한다. 한 번에 너무 많이 몰아 진행하지 않는다. */
  private runDueSteps(): void {
    for (let steps = 0; this.accumulated >= this.stepMs && steps < MAX_STEPS_PER_TICK; steps++) {
      this.accumulated -= this.stepMs;
      this.game.update();
    }
  }

  tick(): void {
    this.accumulated += Math.min(MAX_ELAPSED_MS, this.elapsed());
    this.runDueSteps();
    this.game.render(Date.now());
  }

  start(): void {
    this.tick();
    this.host.requestFrame(() => this.start());
  }
}
