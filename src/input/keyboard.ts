import type { Pad, PlayerId } from '../engine';

type KeyMap = Record<keyof Pad, string>;

/**
 * 키 배치. 버튼은 네 개(A 약펀치, B 약킥, C 강펀치, D 강킥)다. 위 줄이 펀치, 아래 줄이 킥이고 왼쪽 열이 약하다.
 */
export const KEY_MAP: readonly [KeyMap, KeyMap] = [
  { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown', A: 'KeyI', B: 'KeyK', C: 'KeyO', D: 'KeyL' },
  { l: 'KeyA', r: 'KeyD', u: 'KeyW', d: 'KeyS', A: 'KeyR', B: 'KeyF', C: 'KeyT', D: 'KeyG' },
];

/**
 * 지금 눌려 있는 키를 기억하고, 플레이어마다 방향과 버튼 입력으로 바꿔 준다.
 */
export class Keyboard {
  private readonly down = new Set<string>();

  press(code: string): void {
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  releaseAll(): void {
    this.down.clear();
  }

  private isHeld(player: PlayerId, control: keyof Pad): boolean {
    return this.down.has(KEY_MAP[player][control]);
  }

  read(player: PlayerId): Pad {
    const held = (control: keyof Pad): boolean => this.isHeld(player, control);
    return {
      l: held('l'),
      r: held('r'),
      u: held('u'),
      d: held('d'),
      A: held('A'),
      B: held('B'),
      C: held('C'),
      D: held('D'),
    };
  }
}
