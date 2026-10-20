import type { Engine } from '../engine';
import { createEngine } from '../engine';
import type { Ctx } from '../render/layout';
import { Sprites } from '../render/sprites';
import type { View } from '../render/view';

/** 호출 한 번의 기록: 이름과 인자. 속성을 바꾼 것은 `set 속성이름`으로 적는다. */
type Call = readonly [name: string, ...args: unknown[]];

interface FakeCanvas {
  g: Ctx;
  calls: Call[];
  /** 이름이 name인 호출들의 인자 목록. */
  of(name: string): unknown[][];
  /** 글자를 쓴 호출(fillText)에서 쓴 글자만 모은다. */
  texts(): string[];
  /** 속성을 마지막으로 바꾼 값. */
  last(property: string): unknown;
}

class FakeGradient {
  readonly stops: [number, string][] = [];

  addColorStop(at: number, color: string): void {
    this.stops.push([at, color]);
  }
}

/** 그린 것을 기록만 하는 가짜 캔버스 그리기 도구. */
export function fakeCanvas(): FakeCanvas {
  const calls: Call[] = [];
  const values = new Map<string, unknown>();
  const special: Record<string, (...args: unknown[]) => unknown> = {
    createLinearGradient: () => new FakeGradient(),
    createRadialGradient: () => new FakeGradient(),
    measureText: text => ({ width: String(text).length * 8 }),
  };
  const g = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (values.has(property)) {
          return values.get(property);
        }
        return (...args: unknown[]) => {
          calls.push([property, ...args]);
          return special[property]?.(...args);
        };
      },
      set(_target, property: string, value: unknown) {
        values.set(property, value);
        calls.push([`set ${property}`, value]);
        return true;
      },
    },
  ) as Ctx;
  return {
    g,
    calls,
    of: name => calls.filter(c => c[0] === name).map(c => c.slice(1)),
    texts: () => calls.filter(c => c[0] === 'fillText').map(c => String(c[1])),
    last: property => [...calls].reverse().find(c => c[0] === `set ${property}`)?.[1],
  };
}

/** 불러오기가 끝났는지를 정할 수 있는 가짜 그림. */
interface FakeImage {
  src: string;
  complete: boolean;
  naturalWidth: number;
  width: number;
  height: number;
}

export function fakeSprites(loaded: boolean): { sprites: Sprites; images: FakeImage[] } {
  const images: FakeImage[] = [];
  const sprites = new Sprites(() => {
    const image = { src: '', complete: loaded, naturalWidth: loaded ? 400 : 0, width: 400, height: 300 };
    images.push(image);
    return image as unknown as HTMLImageElement;
  });
  return { sprites, images };
}

interface TestView {
  view: View;
  canvas: FakeCanvas;
  engine: Engine;
}

/** 그리기 테스트용 View. 엔진은 진짜이고, 그림은 모두 불러온 것으로 본다. */
export function makeView(options: { loaded?: boolean; now?: number } = {}): TestView {
  const canvas = fakeCanvas();
  const engine = createEngine();
  const { sprites } = fakeSprites(options.loaded ?? true);
  return { view: { g: canvas.g, engine, sprites, now: options.now ?? 0 }, canvas, engine };
}
