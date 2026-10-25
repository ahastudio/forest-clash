import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './game';
import { patch } from './patch';
import { fakeCanvas, fakeSprites } from './testing/canvas';

afterEach(() => vi.restoreAllMocks());

function setup(loaded = true) {
  const { g, texts } = fakeCanvas();
  const canvas = { getContext: () => g, style: { cursor: '' } };
  const game = new Game(canvas as unknown as HTMLCanvasElement, 'v1', fakeSprites(loaded).sprites);
  return { game, g, texts, canvas };
}

const startMatch = (game: Game): void => {
  game.engine.newMatch('cpu');
  for (let i = 0; i < 130; i++) {
    game.engine.step([{}, {}]);
  }
  game.engine.consume();
};

describe('게임', () => {
  it('타이틀에서 시작한다', () => {
    const { game } = setup();
    expect(game.engine.phase).toBe('title');
    expect(game.paused).toBe(false);
    expect(game.showBoxes).toBe(false);
  });

  it('일시정지를 켜고 끈다', () => {
    const { game } = setup();
    game.togglePause();
    expect(game.paused).toBe(true);
    game.togglePause();
    expect(game.paused).toBe(false);
  });

  it('입력 장치에 맞는 안내 문구로 그린다', () => {
    const { game, texts } = setup();
    game.render(0);
    expect(texts().join('')).toContain('Space: 조작법');
    expect(texts().join('')).not.toContain('⏸');
    game.inputKind = 'touch';
    game.render(0);
    expect(texts().join('')).toContain('⏸: 조작법');
  });

  it('그릴 수 있는 캔버스가 아니면 알린다', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => new Game(canvas, 'v1', fakeSprites(true).sprites)).toThrow('2D 캔버스');
  });

  it('그림 만드는 방법을 주지 않으면 브라우저의 Image를 쓴다', () => {
    class StubImage {
      src = '';
      complete = false;
      naturalWidth = 0;
    }
    const original = globalThis.Image;
    globalThis.Image = StubImage as unknown as typeof Image;
    try {
      const { g } = fakeCanvas();
      expect(new Game({ getContext: () => g } as unknown as HTMLCanvasElement, 'v1').engine.phase).toBe('title');
    } finally {
      globalThis.Image = original;
    }
  });

  it('타이틀의 메뉴를 눌러 대전을 시작한다', () => {
    const { game } = setup();
    for (let i = 0; i < 25; i++) {
      game.update();
    }
    game.pointerDown({ x: 276, y: 400 });
    game.update();
    expect(game.engine.phase).toBe('intro');
    expect(game.engine.mode).toBe('cpu');
  });

  it('컴퓨터와 대전 중이면 2P 자리는 컴퓨터가 입력한다', () => {
    const { game } = setup();
    startMatch(game);
    game.engine.fighters[0].x = 600;
    game.engine.fighters[1].x = 450;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    game.update();
    expect(game.engine.fighters[1].input.r).toBe(true);
  });

  it('둘이서 대전이면 2P 키로 움직인다', () => {
    const { game } = setup();
    game.engine.newMatch('2p');
    for (let i = 0; i < 130; i++) {
      game.engine.step([{}, {}]);
    }
    game.keyboard.press('KeyD');
    game.update();
    expect(game.engine.fighters[1].input.r).toBe(true);
  });

  it('일시정지 중에는 진행하지 않는다', () => {
    const { game } = setup();
    game.paused = true;
    game.update();
    expect(game.engine.frame).toBe(0);
  });

  it('효과 알갱이는 단계마다 다르게 움직인다', () => {
    const { game } = setup();
    const { effects } = game.scene;
    const particle = () => ({ x: 0, y: 0, velocityX: 1, velocityY: 0, life: 5, color: '#fff' });
    effects.particles = [particle()];
    game.advanceEffects();
    expect(effects.particles[0]?.velocityY).toBeCloseTo(0.25);
    startMatch(game);
    effects.particles = [particle()];
    game.advanceEffects();
    expect(effects.particles[0]?.velocityY).toBeCloseTo(0.25);
    patch(game.engine, { phase: 'over' });
    effects.particles = [particle()];
    game.advanceEffects();
    expect(effects.particles[0]?.velocityY).toBeCloseTo(0.15);
  });

  it('대전 중에 창을 벗어나면 일시정지하고, 그 밖의 단계에서는 하지 않는다', () => {
    const { game } = setup();
    game.pauseIfFighting();
    expect(game.paused).toBe(false);
    startMatch(game);
    game.pauseIfFighting();
    expect(game.paused).toBe(true);
  });

  it('타이틀 장면을 그리면 대전 방식 메뉴가 나온다', () => {
    const { game, texts } = setup();
    game.render(0);
    expect(texts()).toEqual(
      expect.arrayContaining(['혼자서', '컴퓨터와', '같은 컴퓨터에서', '둘이서', '온라인', '대전']),
    );
  });

  it('엔진 사건이 화면 효과로 이어진다', () => {
    const { game } = setup();
    startMatch(game);
    game.engine.events.push({ type: 'ko', id: 0, x: 400 });
    game.update();
    expect(game.scene.effects.bursts.length).toBeGreaterThan(0);
  });

  it('타이틀이 나와 있는 동안에는 배경의 대전이 진행되고, 대전이 시작되면 멈춘다', () => {
    const { game } = setup();
    game.update();
    const frame = game.demo.engine.frame;
    expect(frame).toBeGreaterThan(0);
    startMatch(game);
    game.update();
    expect(game.demo.engine.frame).toBe(frame);
  });

  it('타이틀에서 마우스가 버튼 위에 있을 때만 커서가 손가락 모양이다', () => {
    const { game, canvas } = setup();
    game.render(0);
    expect(canvas.style.cursor).toBe('default');
    game.menu.hover({ x: 276, y: 400 });
    game.render(0);
    expect(canvas.style.cursor).toBe('pointer');
    game.menu.hover({ x: 0, y: 0 });
    game.render(0);
    expect(canvas.style.cursor).toBe('default');
  });

  it('타이틀이 아니면 마우스가 버튼 자리에 있어도 커서는 기본 모양이다', () => {
    const { game, canvas } = setup();
    game.menu.hover({ x: 276, y: 400 });
    startMatch(game);
    game.render(0);
    expect(canvas.style.cursor).toBe('default');
  });
});
