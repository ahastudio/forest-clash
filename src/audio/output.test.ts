import { describe, expect, it } from 'vitest';
import { asAudio, FakeContext, FakeGain } from '../testing/audio';
import { MASTER_VOLUME, Output } from './output';
import type { Voice } from './voices';

const make = () => {
  const audioContext = new FakeContext();
  const output = new Output(asAudio<BaseAudioContext>(audioContext), MASTER_VOLUME);
  return { audioContext, output };
};

const tone: Voice = { kind: 'tone', wave: 'sine', from: 440, to: 220, duration: 0.5, volume: 0.3 };
const noise: Voice = { kind: 'noise', filter: 'bandpass', from: 2000, to: 500, duration: 0.2, volume: 0.4, delay: 0.1 };

describe('소리 출력', () => {
  it('마스터 음량을 정하고 출력에 연결한다', () => {
    const { audioContext, output } = make();
    expect(output.master.gain.value).toBe(MASTER_VOLUME);
    expect((output.master as unknown as FakeGain).targets).toContain(audioContext.destination);
  });

  it('지금 시각을 돌려주고, 멈춘 장치만 다시 울린다', () => {
    const { audioContext, output } = make();
    audioContext.currentTime = 4;
    expect(output.now()).toBe(4);
    output.resume();
    expect(audioContext.resumed).toBe(0);
    audioContext.state = 'suspended';
    output.resume();
    expect(audioContext.resumed).toBe(1);
  });

  it('음 목소리는 높이가 변하며 서서히 줄어들고 약간 여유를 두고 멈춘다', () => {
    const { audioContext, output } = make();
    output.playVoices([tone], 1);
    const source = audioContext.sources[0];
    expect(source?.type).toBe('sine');
    expect(source?.frequency.events).toEqual([
      ['set', 440, 1],
      ['ramp', 220, 1.5],
    ]);
    expect(source?.started).toBe(1);
    expect(source?.stopped).toBeCloseTo(1.52);
    const fade = audioContext.gains.find(g => g.gain.events.length > 0);
    expect(fade?.gain.events[1]).toEqual(['ramp', 0.0001, 1.5]);
  });

  it('너무 낮은 높이는 하한으로 막는다', () => {
    const { audioContext, output } = make();
    output.playVoices([{ ...tone, to: 1 }], 0);
    expect(audioContext.sources[0]?.frequency.events[1]?.[1]).toBe(20);
    output.playVoices([{ ...noise, to: 1 }], 0);
    expect(audioContext.filters[0]?.frequency.events[1]?.[1]).toBe(40);
  });

  it('잡음 목소리는 필터를 거쳐 마스터로 가고 지연만큼 늦게 시작한다', () => {
    const { audioContext, output } = make();
    output.playVoices([noise], 2);
    const source = audioContext.sources[0];
    expect(source?.started).toBeCloseTo(2.1);
    expect(source?.buffer).not.toBeNull();
    expect(audioContext.filters[0]?.type).toBe('bandpass');
    expect(audioContext.filters[0]?.Q.value).toBeCloseTo(1.2);
  });

  it('목소리를 보낼 곳을 따로 정할 수 있다', () => {
    const { audioContext, output } = make();
    const bus = new FakeGain();
    output.playVoices([tone], 0, asAudio<AudioNode>(bus));
    const fade = audioContext.gains.find(g => g.targets.includes(bus));
    expect(fade).toBeDefined();
  });

  it('곡의 한 칸은 전용 통로로 보내고, 짝수 칸에는 하이햇이 더해진다', () => {
    const { audioContext, output } = make();
    output.playMusicStep({ step: 0, at: 0 });
    const withHiHat = audioContext.sources.length;
    output.playMusicStep({ step: 1, at: 0 });
    const withoutHiHat = audioContext.sources.length - withHiHat;
    expect(withHiHat).toBe(3);
    expect(withoutHiHat).toBe(1);
  });

  it('곡을 끝까지 미리 깔아 두고, 소리 사건은 제 시각에 낸다', () => {
    const { audioContext, output } = make();
    output.scheduleMusic({ duration: 1, from: 0.1 });
    const music = audioContext.sources.length;
    expect(music).toBeGreaterThan(5);
    output.scheduleEvents([
      [0.5, 'punch'],
      [0.7, 'hit', 9],
    ]);
    expect(audioContext.sources.length).toBeGreaterThan(music);
  });
});
