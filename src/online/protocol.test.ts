import { describe, expect, it } from 'vitest';
import { clientMessage, parseServerMessage } from './protocol';

const parse = (body: unknown) => parseServerMessage(JSON.stringify(body));

describe('서버 메시지 읽기', () => {
  it('종류마다 내용을 읽는다', () => {
    expect(parse({ type: 'ready', name: '고양이', wins: 3, losses: 1 })).toEqual({
      type: 'ready',
      name: '고양이',
      wins: 3,
      losses: 1,
    });
    expect(parse({ type: 'waiting' })).toEqual({ type: 'waiting' });
    expect(parse({ type: 'matched', slot: 1, opponent: { name: '새싹', wins: 0, losses: 2 } })).toEqual({
      type: 'matched',
      slot: 1,
      opponent: { name: '새싹', wins: 0, losses: 2 },
    });
    expect(parse({ type: 'input', frame: 5, bits: 16 })).toEqual({ type: 'input', frame: 5, bits: 16 });
    expect(parse({ type: 'recorded', wins: 4, losses: 1 })).toEqual({ type: 'recorded', wins: 4, losses: 1 });
    expect(parse({ type: 'opponentLeft' })).toEqual({ type: 'opponentLeft' });
    expect(parse({ type: 'pong', sent: 1234.5 })).toEqual({ type: 'pong', sent: 1234.5 });
    expect(parse({ type: 'error', reason: '꽉 찼습니다' })).toEqual({ type: 'error', reason: '꽉 찼습니다' });
  });

  it('내용이 모자라거나 형식이 틀리면 null이다', () => {
    expect(parse({ type: 'ready', name: '고양이', wins: '3', losses: 1 })).toBeNull();
    expect(parse({ type: 'matched', slot: 2, opponent: { name: 'a', wins: 0, losses: 0 } })).toBeNull();
    expect(parse({ type: 'matched', slot: 0, opponent: 'a' })).toBeNull();
    expect(parse({ type: 'input', frame: 1 })).toBeNull();
    expect(parse({ type: 'recorded', wins: 1 })).toBeNull();
    expect(parse({ type: 'error', reason: 3 })).toBeNull();
    expect(parse({ type: 'pong', sent: '1' })).toBeNull();
    expect(parse({ type: 'pong' })).toBeNull();
  });

  it('모르는 종류와 글자가 아닌 종류, 객체가 아닌 값, 깨진 글자는 null이다', () => {
    expect(parse({ type: 'unknown' })).toBeNull();
    expect(parse({ type: 'constructor' })).toBeNull();
    expect(parse({ type: 3 })).toBeNull();
    expect(parse(7)).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parseServerMessage('{')).toBeNull();
  });
});

describe('클라이언트 메시지 만들기', () => {
  it('서버가 읽는 형식의 글자를 만든다', () => {
    expect(JSON.parse(clientMessage.hello('토큰'))).toEqual({ type: 'hello', token: '토큰' });
    expect(JSON.parse(clientMessage.queue())).toEqual({ type: 'queue' });
    expect(JSON.parse(clientMessage.cancel())).toEqual({ type: 'cancel' });
    expect(JSON.parse(clientMessage.input({ frame: 4, bits: 9 }))).toEqual({ type: 'input', frame: 4, bits: 9 });
    expect(JSON.parse(clientMessage.result(1))).toEqual({ type: 'result', winner: 1 });
    expect(JSON.parse(clientMessage.leave())).toEqual({ type: 'leave' });
    expect(JSON.parse(clientMessage.ping(77.25))).toEqual({ type: 'ping', sent: 77.25 });
  });
});
