import { afterEach, describe, expect, it, vi } from 'vitest';
import { openWebSocket } from './web-socket';

afterEach(() => vi.unstubAllGlobals());

class FakeSocket {
  static last: FakeSocket;
  readonly sent: string[] = [];
  closed = false;
  readonly listeners = new Map<string, (event: { data?: unknown }) => void>();

  constructor(readonly url: string) {
    FakeSocket.last = this;
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    this.listeners.set(type, listener);
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closed = true;
  }
}

describe('웹소켓 연결', () => {
  it('열림, 받은 글자, 닫힘을 받는 쪽에 알리고 보내기와 닫기를 전한다', () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const events: string[] = [];
    const link = openWebSocket('wss://example.test/ws', {
      open: () => events.push('open'),
      message: text => events.push(`message:${text}`),
      close: () => events.push('close'),
    });
    const socket = FakeSocket.last;
    socket.listeners.get('open')?.({});
    socket.listeners.get('message')?.({ data: '안녕' });
    socket.listeners.get('close')?.({});
    link.send('보냄');
    link.close();
    expect(socket.url).toBe('wss://example.test/ws');
    expect(events).toEqual(['open', 'message:안녕', 'close']);
    expect(socket.sent).toEqual(['보냄']);
    expect(socket.closed).toBe(true);
  });
});
