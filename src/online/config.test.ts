import { describe, expect, it } from 'vitest';
import { readOnlineConfig } from './config';

describe('온라인 설정', () => {
  it('서버 주소와 클라이언트 아이디가 모두 있으면 구글 로그인 설정이다', () => {
    expect(
      readOnlineConfig({ VITE_SERVER_URL: 'wss://example.test/ws', VITE_GOOGLE_CLIENT_ID: 'id', DEV: false }),
    ).toEqual({ serverUrl: 'wss://example.test/ws', clientId: 'id' });
  });

  it('빌드한 결과물은 값이 하나라도 없거나 비어 있으면 null이다', () => {
    expect(readOnlineConfig({ VITE_SERVER_URL: 'wss://example.test/ws', DEV: false })).toBeNull();
    expect(readOnlineConfig({ VITE_GOOGLE_CLIENT_ID: 'id', DEV: false })).toBeNull();
    expect(readOnlineConfig({ VITE_SERVER_URL: '', VITE_GOOGLE_CLIENT_ID: 'id', DEV: false })).toBeNull();
    expect(readOnlineConfig({ DEV: false })).toBeNull();
  });

  it('개발 서버에서는 값이 없어도 로컬 서버와 stub 로그인으로 시작한다', () => {
    expect(readOnlineConfig({ DEV: true })).toEqual({ serverUrl: 'ws://localhost:58970/ws', clientId: null });
  });

  it('개발 서버에서도 준 값은 그대로 쓴다', () => {
    expect(readOnlineConfig({ VITE_SERVER_URL: 'ws://other.test/ws', VITE_GOOGLE_CLIENT_ID: 'id', DEV: true })).toEqual(
      {
        serverUrl: 'ws://other.test/ws',
        clientId: 'id',
      },
    );
  });
});
