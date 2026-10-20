import { describe, expect, it } from 'vitest';
import { makeView } from '../testing/canvas';
import { drawPause } from './pause';

describe('일시정지 화면', () => {
  it('키보드 배치와 안내, 버전을 보인다', () => {
    const { view, canvas } = makeView();
    drawPause(view, 'abc123');
    const all = canvas.texts();
    expect(all).toContain('일시정지');
    expect(all).toContain('1P (오른쪽 캐릭터)');
    expect(all).toContain('←');
    expect(all).toContain('G');
    expect(all).toContain('약');
    expect(all).toContain('펀치');
    expect(all).toContain('이동');
    expect(all).toContain('버전 abc123');
    expect(all.join('')).toContain('판정 상자');
    expect(all.join('')).toContain('Space 계속');
  });

  it('터치 기기에서는 키보드 그림과 Space 안내 없이 일시정지 버튼으로 계속하라고 알린다', () => {
    const { view, canvas } = makeView({ input: 'touch' });
    drawPause(view, 'abc123');
    const all = canvas.texts();
    expect(all).toContain('일시정지');
    expect(all).toContain('이동');
    expect(all).toContain('오른쪽 위 ⏸ 버튼으로 계속');
    expect(all).not.toContain('1P (오른쪽 캐릭터)');
    expect(all).not.toContain('←');
    expect(all.join('')).not.toContain('Space');
  });
});
