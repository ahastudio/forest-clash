import { patch } from '../patch';
import { hasHiHat, musicStep, STEP_SECONDS } from './music';
import type { NoiseVoice, SoundName, ToneVoice, Voice } from './voices';
import { SOUNDS } from './voices';

/** 소리 사건: [시각(초), 이름, 세기]. */
export type SoundEvent = readonly [number, SoundName, number?];

export const MASTER_VOLUME = 0.6;
const MUSIC_BUS_VOLUME = 3;
const MIN_TONE_HZ = 20;
const MIN_FILTER_HZ = 40;
const SILENCE = 0.0001;
const STOP_MARGIN = 0.02;
const FILTER_Q = 1.2;
const HI_HAT: NoiseVoice = { kind: 'noise', filter: 'highpass', from: 6000, to: 5000, duration: 0.04, volume: 0.06 };

/** 소리 하나가 울리는 시간 구간. */
interface Span {
  start: number;
  end: number;
}

/** 값이 처음 값에서 끝 값으로 지수 곡선을 그리며 변한다. */
function glide(param: AudioParam, range: { from: number; to: number }, span: Span): void {
  param.setValueAtTime(range.from, span.start);
  param.exponentialRampToValueAtTime(range.to, span.end);
}

/** 재생을 시작하고 약간의 여유를 두고 멈춘다. */
function play(source: AudioScheduledSourceNode, span: Span): void {
  source.start(span.start);
  source.stop(span.end + STOP_MARGIN);
}

function createNoiseBuffer(audioContext: BaseAudioContext): AudioBuffer {
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** 소리를 낼 수 있는 장치 한 벌: 재생 장치(또는 오프라인 장치), 마스터 음량, 잡음 재료. */
export class Output {
  readonly master: GainNode;
  private readonly noiseBuffer: AudioBuffer;

  constructor(
    readonly audioContext: BaseAudioContext,
    volume: number,
  ) {
    this.master = audioContext.createGain();
    this.master.gain.value = volume;
    this.master.connect(audioContext.destination);
    this.noiseBuffer = createNoiseBuffer(audioContext);
  }

  now(): number {
    return this.audioContext.currentTime;
  }

  /** 소리가 멈춰 있으면 다시 울릴 수 있게 한다. */
  resume(): void {
    if (this.audioContext.state === 'suspended') {
      void (this.audioContext as AudioContext).resume();
    }
  }

  /** 시간이 흐를수록 작아지는 음량 통로. */
  private fadeOut(volume: number, span: Span): GainNode {
    const gain = this.audioContext.createGain();
    glide(gain.gain, { from: volume, to: SILENCE }, span);
    return gain;
  }

  private playTone(voice: ToneVoice, span: Span, destination: AudioNode): void {
    const oscillator = patch(this.audioContext.createOscillator(), { type: voice.wave });
    glide(oscillator.frequency, { from: voice.from, to: Math.max(MIN_TONE_HZ, voice.to) }, span);
    oscillator.connect(this.fadeOut(voice.volume, span)).connect(destination);
    play(oscillator, span);
  }

  private noiseFilter(voice: NoiseVoice, span: Span): BiquadFilterNode {
    const filter = patch(this.audioContext.createBiquadFilter(), { type: voice.filter });
    filter.Q.value = FILTER_Q;
    glide(filter.frequency, { from: voice.from, to: Math.max(MIN_FILTER_HZ, voice.to) }, span);
    return filter;
  }

  private playNoise(voice: NoiseVoice, span: Span): void {
    const source = patch(this.audioContext.createBufferSource(), { buffer: this.noiseBuffer });
    source.connect(this.noiseFilter(voice, span)).connect(this.fadeOut(voice.volume, span)).connect(this.master);
    play(source, span);
  }

  private playVoice(voice: Voice, at: number, destination: AudioNode): void {
    const start = at + (voice.delay ?? 0);
    const span = { start, end: start + voice.duration };
    if (voice.kind === 'tone') {
      this.playTone(voice, span, destination);
    } else {
      this.playNoise(voice, span);
    }
  }

  /** 목소리들을 기준 시각부터 낸다. destination을 주면 마스터 대신 그쪽으로 보낸다. */
  playVoices(voices: readonly Voice[], at: number, destination: AudioNode = this.master): void {
    for (const voice of voices) {
      this.playVoice(voice, at, destination);
    }
  }

  /** 베이스와 선율이 함께 지나가는 음량 통로. */
  private musicBus(): GainNode {
    const bus = this.audioContext.createGain();
    bus.gain.value = MUSIC_BUS_VOLUME;
    bus.connect(this.master);
    return bus;
  }

  /** 곡의 한 칸을 낸다: 베이스와 선율은 전용 통로로, 하이햇은 바로 마스터로. */
  playMusicStep({ step, at }: { step: number; at: number }): void {
    this.playVoices(musicStep(step), at, this.musicBus());
    if (hasHiHat(step)) {
      this.playVoices([HI_HAT], at);
    }
  }

  /** 곡의 처음 칸부터 끝(duration초)까지 모두 미리 깔아 둔다. */
  scheduleMusic({ duration, from }: { duration: number; from: number }): void {
    for (let step = 0, at = from; at < duration; step++, at += STEP_SECONDS) {
      this.playMusicStep({ step, at });
    }
  }

  /** 소리 사건들을 제 시각에 낸다. */
  scheduleEvents(events: readonly SoundEvent[]): void {
    for (const [at, name, power] of events) {
      this.playVoices(SOUNDS[name](power ?? 0), at);
    }
  }
}
