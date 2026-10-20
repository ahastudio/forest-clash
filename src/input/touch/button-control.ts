import type { Game } from '../../game';
import type { TouchPad } from './touch-pad';

type ButtonName = 'A' | 'B' | 'C' | 'D';

export const BUTTON_NAMES: readonly ButtonName[] = ['A', 'B', 'C', 'D'];

interface ButtonParts {
  name: ButtonName;
  element: HTMLElement;
}

/** 공격 버튼 하나. 누르는 동안만 눌린 것으로 본다. */
export class ButtonControl {
  constructor(
    private readonly game: Game,
    private readonly pad: TouchPad,
    private readonly button: ButtonParts,
  ) {}

  attach(): void {
    const { element } = this.button;
    element.addEventListener('pointerdown', event => this.down(event));
    element.addEventListener('pointerup', () => this.up());
    element.addEventListener('pointercancel', () => this.up());
  }

  private down(event: PointerEvent): void {
    this.game.sound.init();
    this.button.element.setPointerCapture(event.pointerId);
    this.pad.press(this.button.name);
    this.button.element.setAttribute('data-pressed', '');
  }

  private up(): void {
    this.pad.release(this.button.name);
    this.button.element.removeAttribute('data-pressed');
  }
}
