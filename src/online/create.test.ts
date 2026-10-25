import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './create';

const doc = {} as unknown as Document;

afterEach(() => vi.unstubAllGlobals());

describe('온라인 흐름 만들기', () => {
  it('설정이 없으면 시작할 때 설정이 없다고 알린다', async () => {
    const session = createSession({ config: null, doc, win: {}, game: { startOnlineMatch: () => undefined } });
    session.start();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(session.state).toBe('stopped');
    expect(session.status).toBe('온라인 대전 설정이 없습니다');
  });

  it('클라이언트 아이디가 없으면 stub 로그인으로 바로 접속을 시작한다', async () => {
    let opened = '';
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url: string) {
          opened = url;
        }
        addEventListener = () => undefined;
      },
    );
    const session = createSession({
      config: { serverUrl: 'ws://localhost:58970/ws', clientId: null },
      doc,
      win: {},
      game: { startOnlineMatch: () => undefined },
    });
    session.start();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(session.state).toBe('connecting');
    expect(opened).toBe('ws://localhost:58970/ws');
  });

  it('설정이 있으면 로그인하는 상태로 시작한다', () => {
    const session = createSession({
      config: { serverUrl: 'wss://example.test/ws', clientId: 'id' },
      doc: { head: { append: () => undefined }, createElement: () => ({}) } as unknown as Document,
      win: {},
      game: { startOnlineMatch: () => undefined },
    });
    session.start();
    expect(session.state).toBe('signingIn');
  });
});
