import { describe, expect, it } from 'vitest';
import { KEY_MAP, Keyboard } from './keyboard';

describe('키보드', () => {
  it('누른 키를 플레이어별 방향과 버튼으로 바꾼다', () => {
    const keyboard = new Keyboard();
    keyboard.press('ArrowLeft');
    keyboard.press('KeyI');
    keyboard.press('KeyR');
    expect(keyboard.read(0)).toEqual({ l: true, r: false, u: false, d: false, A: true, B: false, C: false, D: false });
    expect(keyboard.read(1)).toEqual({ l: false, r: false, u: false, d: false, A: true, B: false, C: false, D: false });
  });

  it('키를 놓으면 입력이 사라지고, 모두 놓으면 전부 사라진다', () => {
    const keyboard = new Keyboard();
    keyboard.press('KeyW');
    keyboard.press('KeyG');
    keyboard.release('KeyW');
    expect(keyboard.read(1).u).toBe(false);
    expect(keyboard.read(1).D).toBe(true);
    keyboard.releaseAll();
    expect(Object.values(keyboard.read(1)).every(v => v === false)).toBe(true);
  });

  it('두 플레이어의 키는 겹치지 않는다', () => {
    const first = Object.values(KEY_MAP[0]);
    const second = Object.values(KEY_MAP[1]);
    expect(first.filter(code => second.includes(code))).toEqual([]);
    expect(new Set([...first, ...second]).size).toBe(16);
  });
});
