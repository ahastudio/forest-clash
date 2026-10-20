import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContext, FakeOfflineContext } from '../testing/audio';
import { Sound } from './sound';

let created: FakeContext[] = [];

class FakeAudioContext extends FakeContext {
  constructor() {
    super();
    created.push(this);
  }
}

beforeEach(() => {
  created = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const withAudio = () => vi.stubGlobal('window', { AudioContext: FakeAudioContext });

describe('소리', () => {
  it('소리 장치를 열기 전에는 아무 소리도 나지 않는다', () => {
    const sound = new Sound();
    sound.play('punch');
    sound.toggle();
    expect(created).toHaveLength(0);
  });

  it('사용자 입력 뒤 장치를 열고 효과음을 낸다', () => {
    withAudio();
    const sound = new Sound();
    sound.init();
    expect(created).toHaveLength(1);
    sound.play('hit', 8);
    expect(created[0]?.sources.length).toBeGreaterThan(0);
  });

  it('이미 열려 있으면 다시 열지 않고 멈춘 소리를 깨운다', () => {
    withAudio();
    const sound = new Sound();
    sound.init();
    if (created[0]) {
      created[0].state = 'suspended';
    }
    sound.init();
    expect(created).toHaveLength(1);
    expect(created[0]?.resumed).toBe(1);
  });

  it('접두어가 붙은 옛 이름의 장치도 쓴다', () => {
    vi.stubGlobal('window', { webkitAudioContext: FakeAudioContext });
    new Sound().init();
    expect(created).toHaveLength(1);
  });

  it('장치를 열 수 없으면 소리 없이 넘어가고 다음에 다시 시도한다', () => {
    vi.stubGlobal('window', {});
    const sound = new Sound();
    sound.init();
    sound.play('punch');
    expect(created).toHaveLength(0);
    vi.stubGlobal('window', {
      AudioContext: class {
        constructor() {
          throw new Error('열 수 없음');
        }
      },
    });
    sound.init();
    sound.play('punch');
    withAudio();
    sound.init();
    expect(created).toHaveLength(1);
  });

  it('소리를 끄면 효과음이 나지 않고 마스터 음량이 0이 된다', () => {
    withAudio();
    const sound = new Sound();
    sound.init();
    const master = created[0]?.gains[0];
    sound.toggle();
    expect(master?.gain.value).toBe(0);
    const before = created[0]?.sources.length;
    sound.play('punch');
    expect(created[0]?.sources.length).toBe(before);
    sound.toggle();
    expect(master?.gain.value).toBe(0.6);
  });

  it('끈 채로 장치를 열면 음량 0으로 시작한다', () => {
    withAudio();
    const sound = new Sound();
    sound.toggle();
    sound.init();
    expect(created[0]?.gains[0]?.gain.value).toBe(0);
  });

  it('배경음악은 정해진 시간 앞까지 미리 깔리고 시간이 흐르면 이어진다', () => {
    withAudio();
    new Sound().init();
    const audioContext = created[0];
    expect(audioContext?.sources.length).toBe(0);
    vi.advanceTimersByTime(120);
    const first = audioContext?.sources.length ?? 0;
    expect(first).toBeGreaterThan(0);
    if (audioContext) {
      audioContext.currentTime = 5;
    }
    vi.advanceTimersByTime(120);
    expect(audioContext?.sources.length).toBeGreaterThan(first);
  });

  it('소리를 끈 동안에는 곡이 흐르지 않는다', () => {
    withAudio();
    const sound = new Sound();
    sound.init();
    sound.toggle();
    vi.advanceTimersByTime(600);
    expect(created[0]?.sources.length).toBe(0);
  });

  it('재생 장치 없이 소리를 만든다', async () => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineContext);
    const buffer = await new Sound().renderOffline(
      [
        [0.2, 'punch'],
        [0.4, 'hit', 6],
      ],
      1,
    );
    expect(buffer).toEqual({ length: 44100 });
  });
});
