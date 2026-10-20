import { describe, expect, it } from 'vitest';
import { Keyboard } from '../keyboard';
import { TouchPad } from './touch-pad';

describe('화면 입력을 1P 입력으로 옮기기', () => {
  it('기울인 방향과 누른 버튼이 1P 입력으로만 읽힌다', () => {
    const keyboard = new Keyboard();
    const pad = new TouchPad(keyboard);
    pad.tilt({ x: 1, y: 0 });
    pad.press('C');
    expect(keyboard.read(0)).toMatchObject({ r: true, l: false, C: true, A: false });
    expect(keyboard.read(1)).toMatchObject({ r: false, C: false });
    pad.tilt({ x: 0, y: 0 });
    pad.release('C');
    expect(keyboard.read(0)).toMatchObject({ r: false, C: false });
  });
});
