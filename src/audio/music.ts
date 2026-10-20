import type { ToneVoice, Voice } from './voices';

/** 짧은 반복 곡(코드 합성). 한 박을 8분음표 둘로 나눈 칸마다 베이스 하나와 선율 하나를 낸다. */
const BASS = [36, 36, 43, 43, 45, 45, 41, 41];
const LEAD = [
  72, 0, 76, 0, 79, 76, 0, 74, 72, 0, 69, 0, 74, 0, 76, 0, 77, 0, 76, 0, 74, 72, 0, 69, 67, 0, 72, 0, 71, 0, 0, 0,
];
const BEATS_PER_MINUTE = 138;

/** 8분음표 한 칸의 길이(초). */
export const STEP_SECONDS = 60 / BEATS_PER_MINUTE / 2;

const BASS_VOICE = { kind: 'tone', wave: 'triangle', duration: STEP_SECONDS * 0.9, volume: 0.16 } as const;
const LEAD_VOICE = { kind: 'tone', wave: 'square', duration: STEP_SECONDS * 0.8, volume: 0.045 } as const;

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** 반복되는 악보에서 step번째 음. 쉬는 칸은 0이다. */
/** 나머지 연산이라 언제나 악보 안이다. */
const noteAt = (notes: readonly number[], step: number): number => notes[step % notes.length] as number;

/** 높이가 변하지 않는 음 하나. */
function note(voice: typeof BASS_VOICE | typeof LEAD_VOICE, midi: number): ToneVoice {
  const hz = midiToHz(midi);
  return { ...voice, from: hz, to: hz };
}

/** 곡의 step번째 칸을 이루는 목소리들. 선율이 쉬는 칸에는 베이스만 있다. */
export function musicStep(step: number): Voice[] {
  const lead = noteAt(LEAD, step);
  const bass = note(BASS_VOICE, noteAt(BASS, step));
  return lead ? [bass, note(LEAD_VOICE, lead)] : [bass];
}

/** 짝수 칸마다 가볍게 잡음을 더해 박자를 표시한다. */
export const hasHiHat = (step: number): boolean => step % 2 === 0;
