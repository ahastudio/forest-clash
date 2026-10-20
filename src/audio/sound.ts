import { STEP_SECONDS } from './music';
import type { SoundEvent } from './output';
import { MASTER_VOLUME, Output } from './output';
import type { SoundName } from './voices';
import { SOUNDS } from './voices';

const SCHEDULE_INTERVAL_MS = 120;
const SCHEDULE_AHEAD_SECONDS = 0.3;
const START_DELAY_SECONDS = 0.1;
const OFFLINE_SAMPLE_RATE = 44100;
const OFFLINE_CHANNELS = 2;

export type { SoundEvent } from './output';

type AudioContextConstructor = new () => AudioContext;

const audioContextClass = (): AudioContextConstructor | undefined => {
  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
};

/** 브라우저의 오디오 장치를 연다. 열 수 없으면 null이다. */
function openOutput(volume: number): Output | null {
  try {
    const Context = audioContextClass();
    return Context ? new Output(new Context(), volume) : null;
  } catch {
    return null;
  }
}

/** 재생 장치 없이 duration초 분량의 소리를 만들 수 있는 장치. */
const createOfflineContext = (duration: number): OfflineAudioContext =>
  new OfflineAudioContext(OFFLINE_CHANNELS, Math.ceil(OFFLINE_SAMPLE_RATE * duration), OFFLINE_SAMPLE_RATE);

/** 배경음악의 진행: 다음에 낼 칸과 그 시각을 기억하고, 정해진 시간 앞까지 미리 깔아 둔다. */
class MusicClock {
  private step = 0;
  private nextAt = 0;

  start(now: number): void {
    this.nextAt = now + START_DELAY_SECONDS;
  }

  /** 소리를 끈 동안은 곡이 흐르지 않고 시각만 따라간다. */
  advance(output: Output, { muted }: { muted: boolean }): void {
    const now = output.now();
    this.nextAt = muted ? Math.max(this.nextAt, now) : this.nextAt;
    while (!muted && this.nextAt < now + SCHEDULE_AHEAD_SECONDS) {
      this.playNext(output);
    }
  }

  private playNext(output: Output): void {
    output.playMusicStep({ step: this.step++, at: this.nextAt });
    this.nextAt += STEP_SECONDS;
  }
}

/** 게임 소리 전체. 소리는 모두 코드로 합성하며, 재생 장치 없이 오프라인으로도 만들 수 있다. */
export class Sound {
  private output: Output | null = null;
  private muted = false;
  private readonly music = new MusicClock();

  /** 사용자 입력 뒤에 한 번 불러 소리 장치를 연다. 이미 열려 있으면 멈춘 소리를 다시 울린다. */
  init(): void {
    if (this.output) {
      this.output.resume();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.output = openOutput(this.muted ? 0 : MASTER_VOLUME);
    if (this.output) {
      this.startMusic(this.output);
    }
  }

  /** 곡을 시작하고, 정해진 간격마다 다음 칸들을 미리 깔아 둔다. */
  private startMusic(output: Output): void {
    this.music.start(output.now());
    setInterval(() => this.music.advance(output, { muted: this.muted }), SCHEDULE_INTERVAL_MS);
  }

  play(name: SoundName, power = 0): void {
    if (this.muted || !this.output) {
      return;
    }
    this.output.playVoices(SOUNDS[name](power), this.output.now());
  }

  toggle(): void {
    this.muted = !this.muted;
    if (this.output) {
      this.output.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    }
  }

  /** 재생 장치 없이 소리를 만든다: 소리 사건 목록을 받아 배경음과 효과음을 섞은 오디오 버퍼를 돌려준다. */
  async renderOffline(events: readonly SoundEvent[], duration: number): Promise<AudioBuffer> {
    const offline = createOfflineContext(duration);
    const output = new Output(offline, MASTER_VOLUME);
    output.scheduleMusic({ duration, from: START_DELAY_SECONDS });
    output.scheduleEvents(events);
    return offline.startRendering();
  }
}
