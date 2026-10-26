import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { MENU_BUTTONS } from './menu';
import { OnlineSession } from './online/session';
import type { LinkHandlers } from './online/web-socket';
import { patch } from './patch';
import { fakeCanvas, fakeSprites } from './testing/canvas';

interface World {
  game: Game;
  session: OnlineSession;
  sent: string[];
  texts: () => string[];
  say: (body: unknown) => void;
  // 핑을 재는 시계를 이만큼(밀리초) 흘려보낸다.
  tick: (milliseconds: number) => void;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(): World {
  const { g, texts } = fakeCanvas();
  const game = new Game(
    { getContext: () => g, style: {} } as unknown as HTMLCanvasElement,
    'v1',
    fakeSprites(true).sprites,
  );
  const sent: string[] = [];
  let handlers: LinkHandlers | null = null;
  let clock = 0;
  const session = new OnlineSession({
    serverUrl: 'wss://example.test/ws',
    signIn: () => Promise.resolve('토큰'),
    open: (_url, given) => {
      handlers = given;
      return { send: text => sent.push(text), close: () => undefined };
    },
    now: () => clock,
    onMatched: () => game.startOnlineMatch(),
  });
  game.online = session;
  return {
    game,
    session,
    sent,
    texts,
    say: body => handlers?.message(JSON.stringify(body)),
    tick: milliseconds => {
      clock += milliseconds;
    },
  };
}

const frames = (game: Game, count: number): void => {
  for (let i = 0; i < count; i++) {
    game.update();
  }
};

// 메뉴의 버튼(0 컴퓨터, 1 둘이서, 2 온라인)을 눌러 한 프레임 진행한다. 버튼 밖은 번호 -1이다.
const press = (game: Game, index: number): void => {
  const rect = MENU_BUTTONS[index]?.rect;
  game.pointerDown(rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 });
  game.update();
};

// 서버를 대신해 보낸 입력을 같은 프레임 번호로 상대 입력인 것처럼 돌려준다.
function echoRemote(world: World, from: number): number {
  const inputs = world.sent
    .slice(from)
    .map(text => JSON.parse(text))
    .filter(message => message.type === 'input');
  for (const { frame } of inputs) {
    world.say({ type: 'input', frame, bits: 0 });
  }
  return world.sent.length;
}

// 한 프레임씩 진행하며 상대가 같은 프레임에 아무것도 누르지 않은 것처럼 돌려준다.
function advance(world: World, count: number): void {
  let from = world.sent.length;
  for (let i = 0; i < count; i++) {
    world.game.update();
    from = echoRemote(world, from);
  }
}

async function startOnline(): Promise<World> {
  const world = setup();
  frames(world.game, 25);
  press(world.game, 2);
  await settle();
  world.say({ type: 'ready', name: '고양이', wins: 2, losses: 1 });
  world.say({ type: 'matched', slot: 0, opponent: { name: '새싹', wins: 5, losses: 0 } });
  return world;
}

describe('타이틀 메뉴로 대전 시작', () => {
  it('둘이서 버튼을 누르면 둘이서 대전을 시작한다', () => {
    const { game } = setup();
    frames(game, 25);
    press(game, 1);
    expect(game.engine.phase).toBe('intro');
    expect(game.engine.mode).toBe('2p');
  });

  it('컴퓨터 대전을 누르면 컴퓨터와 대전한다', () => {
    const { game } = setup();
    frames(game, 25);
    press(game, 0);
    expect(game.engine.mode).toBe('cpu');
  });

  it('메뉴 밖을 누르면 시작하지 않는다', () => {
    const { game } = setup();
    frames(game, 25);
    press(game, -1);
    expect(game.engine.phase).toBe('title');
  });

  it('키보드의 버튼과 방향으로는 대전을 시작하지 않는다', () => {
    const { game } = setup();
    frames(game, 25);
    game.keyboard.press('KeyI');
    game.keyboard.press('ArrowDown');
    frames(game, 3);
    expect(game.engine.phase).toBe('title');
  });

  it('타이틀이 나온 직후에는 버튼을 눌러도 시작하지 않는다', () => {
    const { game } = setup();
    press(game, 0);
    expect(game.engine.phase).toBe('title');
  });

  it('온라인 흐름이 없으면 온라인 대전을 골라도 아무 일도 없다', () => {
    const { game } = setup();
    game.online = null;
    frames(game, 25);
    press(game, 2);
    expect(game.engine.phase).toBe('title');
    game.render(0);
  });
});

describe('온라인 대전', () => {
  it('온라인을 고르면 로그인을 시작하고, 상황이 타이틀에 보이며, 화면을 누르면 취소한다', async () => {
    const world = setup();
    frames(world.game, 25);
    press(world.game, 2);
    expect(world.session.state).toBe('signingIn');
    world.game.render(0);
    expect(world.texts()).toContain('로그인하는 중');
    press(world.game, -1);
    expect(world.session.state).toBe('idle');
    frames(world.game, 2);
    await settle();
    expect(world.session.state).toBe('idle');
  });

  it('아무것도 누르지 않으면 접속 중에도 기다린다', async () => {
    const world = setup();
    frames(world.game, 25);
    press(world.game, 2);
    frames(world.game, 3);
    await settle();
    expect(world.session.busy).toBe(true);
    expect(world.game.engine.phase).toBe('title');
  });

  it('상대가 정해지면 새 판이 시작되고 입력은 지연 프레임을 지나 보낸다', async () => {
    const world = await startOnline();
    expect(world.game.engine.phase).toBe('intro');
    expect(world.game.engine.mode).toBe('2p');
    frames(world.game, 4);
    const inputs = world.sent.map(text => JSON.parse(text)).filter(message => message.type === 'input');
    expect(inputs.map(message => message.frame)).toEqual([6, 7, 8, 9]);
  });

  it('대전 중에는 1초마다 ping을 보내고, 돌아온 왕복 시간을 화면 오른쪽 아래에 보인다', async () => {
    const world = await startOnline();
    const pingsSent = () => world.sent.map(text => JSON.parse(text)).filter(message => message.type === 'ping');
    frames(world.game, 3);
    expect(pingsSent()).toEqual([{ type: 'ping', sent: 0 }]);
    world.tick(40);
    world.say({ type: 'pong', sent: 0 });
    world.game.render(0);
    expect(world.texts()).toContain('Ping 40ms');
    world.tick(960);
    frames(world.game, 1);
    expect(pingsSent()).toHaveLength(2);
  });

  it('대전 중이 아니면 ping을 보내지 않고 핑도 보이지 않는다', () => {
    const world = setup();
    frames(world.game, 3);
    world.game.render(0);
    expect(world.sent).toEqual([]);
    expect(world.texts().some(text => text.startsWith('Ping'))).toBe(false);
  });

  it('상대 입력이 오지 않으면 진행하지 않고 글자는 띄우지 않는다', async () => {
    const world = await startOnline();
    frames(world.game, 6);
    const before = world.game.engine.frame;
    frames(world.game, 4);
    expect(world.game.update()).toBe(false);
    expect(world.game.engine.frame).toBe(before);
    world.game.render(0);
    expect(world.texts()).not.toContain('상대를 기다리는 중');
    echoRemote(world, 0);
    expect(world.game.update()).toBe(true);
    expect(world.game.engine.frame).toBe(before + 1);
  });

  it('상대 입력이 계속 오면 두 쪽이 같은 프레임을 진행한다', async () => {
    const world = await startOnline();
    let from = 0;
    for (let i = 0; i < 20; i++) {
      world.game.update();
      from = echoRemote(world, from);
    }
    expect(world.game.engine.frame).toBeGreaterThan(10);
  });

  it('판이 끝나면 이긴 쪽을 한 번 알리고, 타이틀로 돌아오면 온라인 흐름을 마친다', async () => {
    const world = await startOnline();
    advance(world, 6);
    patch(world.game.engine, { phase: 'over', matchWinner: 1 });
    advance(world, 2);
    expect(world.sent.map(text => JSON.parse(text)).filter(message => message.type === 'result')).toEqual([
      { type: 'result', winner: 1 },
    ]);
    patch(world.game.engine, { phase: 'title' });
    advance(world, 1);
    expect(world.session.state).toBe('idle');
  });

  it('결과가 나지 않은 단계에서는 알리지 않는다', async () => {
    const world = await startOnline();
    advance(world, 6);
    patch(world.game.engine, { phase: 'over', matchWinner: null });
    advance(world, 1);
    expect(world.sent.map(text => JSON.parse(text)).some(message => message.type === 'result')).toBe(false);
  });

  it('상대가 나가면 판을 끝내고 타이틀로 돌아가 이유를 보인다', async () => {
    const world = await startOnline();
    frames(world.game, 4);
    world.say({ type: 'opponentLeft' });
    world.game.update();
    expect(world.game.engine.phase).toBe('title');
    world.game.render(0);
    expect(world.texts()).toContain('상대가 나갔습니다');
  });

  it('온라인 대전 중에는 일시정지가 되지 않는다', async () => {
    const world = await startOnline();
    world.game.togglePause();
    expect(world.game.paused).toBe(false);
    patch(world.game.engine, { phase: 'fight' });
    world.game.pauseIfFighting();
    expect(world.game.paused).toBe(false);
  });

  it('온라인이 끝난 뒤 컴퓨터와 하는 판은 타이틀로 돌아가지 않는다', async () => {
    const world = await startOnline();
    world.say({ type: 'error', reason: '끊김' });
    world.game.update();
    frames(world.game, 25);
    press(world.game, 0);
    expect(world.game.engine.phase).toBe('intro');
    frames(world.game, 5);
    expect(world.game.engine.phase).toBe('intro');
  });
});
