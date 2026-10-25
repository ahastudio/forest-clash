import { describe, expect, it, vi } from 'vitest';
import type { PlayerId } from '../engine';
import { OnlineSession } from './session';
import type { LinkHandlers } from './web-socket';

interface Setup {
  session: OnlineSession;
  sent: string[];
  matched: PlayerId[];
  handlers: () => LinkHandlers;
  closed: () => number;
  signIn: ReturnType<typeof vi.fn>;
  opened: () => number;
  say: (body: unknown) => void;
  /** 핑을 재는 시계를 이만큼(밀리초) 흘려보낸다. */
  tick: (milliseconds: number) => void;
}

function setup(signIn: () => Promise<string> = () => Promise.resolve('토큰')): Setup {
  const sent: string[] = [];
  const matched: PlayerId[] = [];
  let latest: LinkHandlers | null = null;
  let closeCount = 0;
  let openCount = 0;
  let clock = 0;
  const signInSpy = vi.fn(signIn);
  const session = new OnlineSession({
    serverUrl: 'wss://example.test/ws',
    signIn: signInSpy,
    open: (_url, handlers) => {
      latest = handlers;
      openCount++;
      return { send: text => sent.push(text), close: () => closeCount++ };
    },
    now: () => clock,
    onMatched: slot => matched.push(slot),
  });
  const handlers = (): LinkHandlers => {
    if (!latest) {
      throw new Error('아직 연결하지 않았습니다');
    }
    return latest;
  };
  return {
    session,
    sent,
    matched,
    handlers,
    closed: () => closeCount,
    signIn: signInSpy,
    opened: () => openCount,
    say: body => handlers().message(JSON.stringify(body)),
    tick: milliseconds => {
      clock += milliseconds;
    },
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const types = (sent: string[]) => sent.map(text => JSON.parse(text).type);

async function connected(): Promise<Setup> {
  const world = setup();
  world.session.start();
  await settle();
  world.handlers().open();
  return world;
}

async function waiting(): Promise<Setup> {
  const world = await connected();
  world.say({ type: 'ready', name: '고양이', wins: 2, losses: 1 });
  return world;
}

async function playing(slot: PlayerId = 0): Promise<Setup> {
  const world = await waiting();
  world.say({ type: 'matched', slot, opponent: { name: '새싹', wins: 5, losses: 0 } });
  return world;
}

describe('온라인 흐름', () => {
  it('로그인하고 접속해 인사를 보낸 뒤 선수 정보를 받으면 대기열에 들어간다', async () => {
    const world = setup();
    world.session.start();
    expect(world.session.state).toBe('signingIn');
    expect(world.session.status).toContain('로그인');
    await settle();
    expect(world.session.state).toBe('connecting');
    world.handlers().open();
    expect(JSON.parse(world.sent[0] ?? '')).toEqual({ type: 'hello', token: '토큰' });
    world.say({ type: 'ready', name: '고양이', wins: 2, losses: 1 });
    expect(world.session.state).toBe('waiting');
    expect(world.session.busy).toBe(true);
    expect(world.session.status).toBe('고양이 2승 1패 · 상대를 찾는 중');
    expect(types(world.sent)).toEqual(['hello', 'queue']);
  });

  it('로그인에 실패하면 이유를 보이고 멈춘다', async () => {
    const world = setup(() => Promise.reject(new Error('로그인을 닫았습니다')));
    world.session.start();
    await settle();
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('로그인을 닫았습니다');
  });

  it('오류 객체가 아닌 실패에는 기본 문구를 보인다', async () => {
    const world = setup(() => Promise.reject('실패'));
    world.session.start();
    await settle();
    expect(world.session.status).toBe('로그인하지 못했습니다');
  });

  it('로그인하는 사이에 취소하면 접속하지 않는다', async () => {
    const world = setup();
    world.session.start();
    world.session.cancel();
    await settle();
    expect(world.session.state).toBe('idle');
    expect(world.opened()).toBe(0);
  });

  it('한 번 로그인했으면 다시 시작할 때 로그인을 묻지 않는다', async () => {
    const world = await playing();
    world.session.finish();
    world.session.start();
    expect(world.signIn).toHaveBeenCalledTimes(1);
    expect(world.opened()).toBe(2);
  });

  it('로그인한 토큰이 만료되었으면 다시 시작할 때 로그인부터 다시 한다', async () => {
    const expired = `머리.${btoa(JSON.stringify({ exp: 1 }))}.서명`;
    const world = setup(() => Promise.resolve(expired));
    world.session.start();
    await settle();
    world.handlers().open();
    world.session.cancel();
    world.session.start();
    expect(world.session.state).toBe('signingIn');
    expect(world.signIn).toHaveBeenCalledTimes(2);
  });

  it('진행 중에는 다시 시작해도 아무 일도 없다', async () => {
    const world = await waiting();
    world.session.start();
    expect(world.opened()).toBe(1);
    const fighting = await playing();
    fighting.session.start();
    expect(fighting.opened()).toBe(1);
  });

  it('상대를 찾는 중에 취소하면 연결을 닫고 처음으로 돌아간다', async () => {
    const world = await waiting();
    world.session.cancel();
    expect(world.session.state).toBe('idle');
    expect(world.session.status).toBe('');
    expect(world.closed()).toBe(1);
    expect(types(world.sent)).toContain('cancel');
  });

  it('진행 중이 아니면 취소해도 아무 일도 없다', () => {
    const world = setup();
    world.session.cancel();
    expect(world.session.state).toBe('idle');
  });
});

describe('대전', () => {
  it('상대가 정해지면 슬롯을 알리고 상대 정보를 보인다', async () => {
    const world = await playing(1);
    expect(world.session.playing).toBe(true);
    expect(world.matched).toEqual([1]);
    expect(world.session.status).toBe('새싹 5승 0패와 대전');
  });

  it('입력을 지연 프레임 번호로 보내고 상대 입력이 오면 진행한다', async () => {
    const world = await playing();
    expect(world.session.nextInputs()).not.toBeNull();
    world.session.submit(16);
    expect(JSON.parse(world.sent.at(-1) ?? '')).toEqual({ type: 'input', frame: 6, bits: 16 });
    world.say({ type: 'input', frame: 6, bits: 0 });
    for (let frame = 1; frame < 6; frame++) {
      world.session.nextInputs();
    }
    expect(world.session.nextInputs()?.[0].A).toBe(1);
  });

  it('대전 중이 아니면 입력이 없고 보내지도 않는다', () => {
    const world = setup();
    world.session.submit(1);
    expect(world.session.nextInputs()).toBeNull();
    expect(world.sent).toEqual([]);
  });

  it('결과는 한 판에 한 번만 보고한다', async () => {
    const world = await playing();
    world.session.reportResult(1);
    world.session.reportResult(1);
    expect(types(world.sent).filter(type => type === 'result')).toHaveLength(1);
    world.say({ type: 'matched', slot: 0, opponent: { name: '새싹', wins: 5, losses: 0 } });
    world.session.reportResult(0);
    expect(types(world.sent).filter(type => type === 'result')).toHaveLength(2);
  });

  it('상대가 나간 뒤 다시 시작하면 남은 연결을 닫고 새로 접속한다', async () => {
    const world = await playing();
    world.say({ type: 'opponentLeft' });
    expect(world.closed()).toBe(0);
    world.session.start();
    expect(world.closed()).toBe(1);
    expect(world.opened()).toBe(2);
    expect(world.session.state).toBe('connecting');
    world.handlers().open();
    world.say({ type: 'ready', name: '고양이', wins: 2, losses: 1 });
    expect(world.session.state).toBe('waiting');
    expect(types(world.sent).slice(-2)).toEqual(['hello', 'queue']);
  });

  it('찾는 중에 취소한 뒤 다시 시작해도 낡은 연결의 닫힘 알림에 끊기지 않는다', async () => {
    const world = await waiting();
    const stale = world.handlers();
    world.session.cancel();
    world.session.start();
    stale.close();
    expect(world.session.state).toBe('connecting');
    expect(world.opened()).toBe(2);
  });

  it('닫은 낡은 연결의 닫힘 알림이 늦게 와도 새 접속은 끊기지 않는다', async () => {
    const world = await playing();
    world.say({ type: 'opponentLeft' });
    const stale = world.handlers();
    world.session.start();
    stale.close();
    expect(world.session.state).toBe('connecting');
  });

  it('대전 중에 ping을 보내고 pong이 오면 왕복 시간을 알린다', async () => {
    const world = await playing();
    expect(world.session.pingMilliseconds).toBeNull();
    world.session.measurePing();
    expect(JSON.parse(world.sent.at(-1) ?? '')).toEqual({ type: 'ping', sent: 0 });
    world.tick(30);
    world.say({ type: 'pong', sent: 0 });
    expect(world.session.pingMilliseconds).toBe(30);
  });

  it('ping은 간격이 지나야 다시 보내고, 여러 번 잰 값은 평균으로 흔들림을 줄인다', async () => {
    const world = await playing();
    world.session.measurePing();
    world.tick(30);
    world.say({ type: 'pong', sent: 0 });
    const sentBefore = world.sent.length;
    world.tick(500);
    world.session.measurePing();
    expect(world.sent).toHaveLength(sentBefore);
    world.tick(500);
    world.session.measurePing();
    expect(JSON.parse(world.sent.at(-1) ?? '')).toEqual({ type: 'ping', sent: 1030 });
    world.tick(50);
    world.say({ type: 'pong', sent: 1030 });
    expect(world.session.pingMilliseconds).toBe(36);
  });

  it('대전 중이 아니면 ping을 보내지 않고 핑도 알리지 않는다', async () => {
    const world = await waiting();
    const sentBefore = world.sent.length;
    world.session.measurePing();
    expect(world.sent).toHaveLength(sentBefore);
    world.say({ type: 'pong', sent: 0 });
    expect(world.session.pingMilliseconds).toBeNull();
  });

  it('새 판이 시작되면 이전 판의 핑을 지운다', async () => {
    const world = await playing();
    world.session.measurePing();
    world.tick(30);
    world.say({ type: 'pong', sent: 0 });
    world.say({ type: 'matched', slot: 1, opponent: { name: '새싹', wins: 5, losses: 0 } });
    expect(world.session.pingMilliseconds).toBeNull();
  });

  it('기록되면 내 승패를 보인다', async () => {
    const world = await playing();
    world.say({ type: 'recorded', wins: 3, losses: 1 });
    expect(world.session.status).toBe('내 기록 3승 1패');
  });

  it('상대가 나가면 끝내고, 이어서 오는 기록은 받는다', async () => {
    const world = await playing();
    world.say({ type: 'opponentLeft' });
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('상대가 나갔습니다');
    world.say({ type: 'recorded', wins: 3, losses: 1 });
    expect(world.session.status).toBe('내 기록 3승 1패');
  });

  it('기록된 뒤에 상대가 나가는 것은 판이 끝난 뒤의 정리라서 알리지 않는다', async () => {
    const world = await playing();
    world.say({ type: 'recorded', wins: 3, losses: 1 });
    world.say({ type: 'opponentLeft' });
    expect(world.session.state).toBe('playing');
    expect(world.session.status).toBe('내 기록 3승 1패');
  });

  it('서버가 오류를 알리면 이유를 보이고 연결을 닫으며, 다음에는 다시 로그인한다', async () => {
    const world = await waiting();
    world.say({ type: 'error', reason: '이미 접속 중입니다' });
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('이미 접속 중입니다');
    expect(world.closed()).toBe(1);
    world.session.start();
    expect(world.signIn).toHaveBeenCalledTimes(2);
  });

  it('연결이 갑자기 닫히면 연결이 끊어졌다고 알린다', async () => {
    const world = await playing();
    world.handlers().close();
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('서버와 연결이 끊어졌습니다');
  });

  it('상대가 나가 멈춘 뒤 서버가 연결을 닫아도 멈춘 이유를 그대로 둔다', async () => {
    const world = await playing();
    world.say({ type: 'opponentLeft' });
    world.handlers().close();
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('상대가 나갔습니다');
  });

  it('끝난 뒤나 우리가 닫은 뒤의 닫힘 알림은 무시한다', async () => {
    const world = await playing();
    world.session.finish();
    world.handlers().close();
    expect(world.session.state).toBe('idle');
    world.say({ type: 'opponentLeft' });
    world.handlers().close();
    expect(world.session.state).toBe('stopped');
    expect(world.session.status).toBe('상대가 나갔습니다');
  });

  it('알아볼 수 없거나 지금 필요 없는 메시지는 무시한다', async () => {
    const world = await waiting();
    world.handlers().message('깨진 글자');
    world.say({ type: 'waiting' });
    world.say({ type: 'input', frame: 1, bits: 0 });
    expect(world.session.state).toBe('waiting');
  });

  it('끝내면 연결을 닫고 기록 문구는 남긴다', async () => {
    const world = await playing();
    world.say({ type: 'recorded', wins: 3, losses: 1 });
    world.session.finish();
    expect(world.session.state).toBe('idle');
    expect(world.closed()).toBe(1);
    expect(world.session.status).toBe('내 기록 3승 1패');
  });
});
