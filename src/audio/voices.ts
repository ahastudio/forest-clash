/** 소리를 이루는 목소리 하나. 높이가 from에서 to로 변하며 duration초 동안 울리고 서서히 줄어든다. */
export interface ToneVoice {
  kind: 'tone';
  wave: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume: number;
  /** 시작을 이만큼(초) 늦춘다. */
  delay?: number;
}

/** 걸러 낸 잡음 목소리. 필터의 기준 주파수가 from에서 to로 변한다. */
export interface NoiseVoice {
  kind: 'noise';
  filter: BiquadFilterType;
  from: number;
  to: number;
  duration: number;
  volume: number;
  delay?: number;
}

export type Voice = ToneVoice | NoiseVoice;

export type SoundName =
  | 'punch'
  | 'kick'
  | 'jump'
  | 'land'
  | 'dash'
  | 'hit'
  | 'grab'
  | 'lift'
  | 'toss'
  | 'block'
  | 'ko'
  | 'round'
  | 'fight'
  | 'tick'
  | 'super'
  | 'win';

/** 높이가 변하는 폭: [처음 높이, 끝 높이]. */
type Glide = readonly [from: number, to: number];
/** 소리의 모양: [길이(초), 크기, 지연(초)]. */
type Envelope = readonly [duration: number, volume: number, delay?: number];

const tone = (wave: OscillatorType, [from, to]: Glide, [duration, volume, delay = 0]: Envelope): ToneVoice => ({
  kind: 'tone',
  wave,
  from,
  to,
  duration,
  volume,
  delay,
});

const noise = (filter: BiquadFilterType, [from, to]: Glide, [duration, volume, delay = 0]: Envelope): NoiseVoice => ({
  kind: 'noise',
  filter,
  from,
  to,
  duration,
  volume,
  delay,
});

/** 세게 맞았을 때 더해지는 묵직한 울림. */
const heavyBoom = (): Voice[] => [
  tone('sine', [90, 30], [0.35, 0.5, 0.02]),
  noise('lowpass', [1400, 120], [0.25, 0.3, 0.02]),
];

/** 타격음은 세기(power)가 클수록 낮고 길고 크다. */
function hitVoices(power: number): Voice[] {
  const k = Math.min(1, power / 14);
  const base: Voice[] = [
    tone('sine', [180 + 40 * (1 - k), 45], [0.18 + 0.12 * k, 0.55 + 0.3 * k]),
    noise('highpass', [1800, 900], [0.07 + 0.05 * k, 0.5]),
    tone('square', [900, 300], [0.06, 0.12]),
  ];
  return k > 0.6 ? base.concat(heavyBoom()) : base;
}

const FIGHT_CHORD = [523, 659, 784];
const WIN_NOTES = [523, 659, 784, 1047];
const WIN_NOTE_GAP = 0.14;

export const SOUNDS: Record<SoundName, (power: number) => Voice[]> = {
  punch: () => [noise('bandpass', [2400, 700], [0.12, 0.35])],
  kick: () => [noise('bandpass', [1500, 380], [0.18, 0.42]), tone('sine', [220, 90], [0.12, 0.12])],
  jump: () => [tone('square', [280, 620], [0.14, 0.09])],
  land: () => [tone('sine', [120, 55], [0.12, 0.3]), noise('lowpass', [900, 200], [0.08, 0.12])],
  dash: () => [noise('bandpass', [500, 3200], [0.22, 0.4]), tone('sawtooth', [160, 420], [0.18, 0.06])],
  hit: hitVoices,
  grab: () => [noise('bandpass', [1200, 600], [0.08, 0.3]), tone('square', [300, 200], [0.06, 0.1])],
  lift: () => [tone('sine', [200, 520], [0.3, 0.18]), noise('bandpass', [500, 2500], [0.25, 0.2])],
  toss: () => [noise('bandpass', [3000, 400], [0.3, 0.45]), tone('sawtooth', [500, 120], [0.25, 0.12])],
  block: () => [
    tone('square', [520, 380], [0.09, 0.2]),
    tone('triangle', [1040, 760], [0.12, 0.15]),
    noise('highpass', [3000, 2000], [0.05, 0.25]),
  ],
  ko: () => [
    tone('sine', [140, 28], [0.9, 0.9]),
    noise('lowpass', [2200, 80], [0.7, 0.55]),
    tone('sawtooth', [600, 70], [0.8, 0.2, 0.05]),
    tone('square', [330, 90], [0.6, 0.12, 0.1]),
  ],
  round: () => [tone('triangle', [392, 392], [0.22, 0.3])],
  fight: () => [
    ...FIGHT_CHORD.map(f => tone('square', [f, f], [0.35, 0.16])),
    tone('sawtooth', [130, 130], [0.4, 0.2]),
  ],
  tick: () => [tone('square', [880, 880], [0.05, 0.12])],
  super: () => [
    noise('bandpass', [400, 4000], [0.6, 0.5]),
    tone('sawtooth', [110, 880], [0.5, 0.25]),
    tone('square', [660, 1320], [0.4, 0.12, 0.1]),
    tone('sine', [70, 35], [0.4, 0.5, 0.05]),
  ],
  win: () => [
    ...WIN_NOTES.map((f, i) => tone('square', [f, f], [0.22, 0.18, i * WIN_NOTE_GAP])),
    tone('triangle', [1047, 1047], [0.6, 0.2, 0.56]),
  ],
};
