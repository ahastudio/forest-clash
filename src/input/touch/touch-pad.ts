import type { Pad } from '../../engine';
import { KEY_MAP, type Keyboard } from '../keyboard';
import { DIRECTIONS, directionsOf, type Tilt } from './tilt';

/**
 * 화면 조이스틱과 버튼의 입력을 1P 키보드 입력으로 옮긴다. 모바일에서는 언제나 1P다.
 */
export class TouchPad {
  constructor(private readonly keyboard: Keyboard) {}

  tilt(tilt: Tilt): void {
    const held = directionsOf(tilt);
    for (const direction of DIRECTIONS) {
      if (held[direction]) {
        this.press(direction);
      } else {
        this.release(direction);
      }
    }
  }

  press(control: keyof Pad): void {
    this.keyboard.press(KEY_MAP[0][control]);
  }

  release(control: keyof Pad): void {
    this.keyboard.release(KEY_MAP[0][control]);
  }
}
