import type { Game } from '../../game';
import { CENTER, followOrigin, type Point, type Tilt, tiltOf } from './tilt';
import type { TouchPad } from './touch-pad';

/** 손잡이를 끝까지 미는 데 필요한 손가락 이동 거리. 조이스틱 너비에 대한 비율이다. */
const REACH_RATIO = 0.4;

/** 손잡이가 한가운데에서 움직이는 최대 거리. 손잡이 크기에 대한 퍼센트다. */
const KNOB_TRAVEL_PERCENT = 60;

interface StickParts {
  pad: TouchPad;
  stick: HTMLElement;
  knob: HTMLElement;
}

/** 조이스틱 하나. 손가락이 처음 닿은 곳을 가운데로 삼아 움직인 만큼 기울이고, 떼면 가운데로 돌아온다. */
export class StickControl {
  private origin: Point = { x: 0, y: 0 };

  constructor(
    private readonly game: Game,
    private readonly parts: StickParts,
  ) {}

  attach(): void {
    const { stick } = this.parts;
    stick.addEventListener('pointerdown', event => this.start(event));
    stick.addEventListener('pointermove', event => this.drag(event));
    stick.addEventListener('pointerup', () => this.aim(CENTER));
    stick.addEventListener('pointercancel', () => this.aim(CENTER));
  }

  private start(event: PointerEvent): void {
    this.game.sound.init();
    this.parts.stick.setPointerCapture(event.pointerId);
    this.origin = { x: event.clientX, y: event.clientY };
    this.aim(CENTER);
  }

  private drag(event: PointerEvent): void {
    if (this.parts.stick.hasPointerCapture(event.pointerId)) {
      this.follow({ x: event.clientX, y: event.clientY });
    }
  }

  /** 끝까지 민 거리를 넘으면 기준점을 끌어오고, 기준점에서 손가락까지의 기울기로 방향을 누른다. */
  private follow(point: Point): void {
    const reach = this.reach();
    this.origin = followOrigin(this.origin, point, reach);
    this.aim(tiltOf({ x: point.x - this.origin.x, y: point.y - this.origin.y }, reach));
  }

  /** 손잡이를 끝까지 미는 데 필요한 손가락 이동 거리(픽셀). */
  private reach(): number {
    return this.parts.stick.getBoundingClientRect().width * REACH_RATIO;
  }

  private aim(tilt: Tilt): void {
    this.parts.pad.tilt(tilt);
    this.parts.knob.style.transform = `translate(${tilt.x * KNOB_TRAVEL_PERCENT}%, ${tilt.y * KNOB_TRAVEL_PERCENT}%)`;
  }
}
