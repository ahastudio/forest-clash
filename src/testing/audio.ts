/** 테스트용 가짜 오디오 장치. 어떤 소리를 어떻게 이었는지 기록만 한다. */
class FakeParam {
  value = 0;
  readonly events: [string, number, number][] = [];

  setValueAtTime(value: number, time: number): void {
    this.events.push(['set', value, time]);
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.events.push(['ramp', value, time]);
  }
}

class FakeNode {
  readonly targets: FakeNode[] = [];

  connect<T extends FakeNode>(target: T): T {
    this.targets.push(target);
    return target;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeSource extends FakeNode {
  type = '';
  buffer: unknown = null;
  started: number | null = null;
  stopped: number | null = null;
  readonly frequency = new FakeParam();

  start(time: number): void {
    this.started = time;
  }

  stop(time: number): void {
    this.stopped = time;
  }
}

class FakeFilter extends FakeNode {
  type = '';
  readonly frequency = new FakeParam();
  readonly Q = { value: 0 };
}

export class FakeContext {
  currentTime = 0;
  state = 'running';
  sampleRate = 8;
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly filters: FakeFilter[] = [];
  resumed = 0;

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createBufferSource(): FakeSource {
    return this.createOscillator();
  }

  createBiquadFilter(): FakeFilter {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }

  createBuffer(_channels: number, length: number): { getChannelData(): Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }

  resume(): Promise<void> {
    this.resumed++;
    return Promise.resolve();
  }
}

export class FakeOfflineContext extends FakeContext {
  constructor(
    readonly channels = 0,
    readonly length = 0,
    sampleRate = 0,
  ) {
    super();
    this.sampleRate = sampleRate || 8;
  }

  startRendering(): Promise<{ length: number }> {
    return Promise.resolve({ length: this.length });
  }
}

/** 타입 검사를 통과시키기 위한 변환. */
export const asAudio = <T>(fake: unknown): T => fake as T;
