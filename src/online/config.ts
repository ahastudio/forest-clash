/**
 * 온라인 대전에 필요한 설정. clientId가 null이면 구글 대신 stub 로그인을 쓴다.
 */
export interface OnlineConfig {
  serverUrl: string;
  clientId: string | null;
}

/**
 * 빌드 환경 값 중 온라인 설정에 쓰는 것. DEV는 Vite 개발 서버에서만 true다.
 */
export interface OnlineEnvironment {
  VITE_SERVER_URL?: string;
  VITE_GOOGLE_CLIENT_ID?: string;
  DEV: boolean;
}

// 개발 서버에서 서버 주소를 주지 않았을 때 쓰는 로컬 서버 주소(게임 개발 서버 포트에 1을 더한 포트).
const DEV_SERVER_URL = 'ws://localhost:58970/ws';

/**
 * 환경 값에서 설정을 읽는다.
 * 서버 주소는 개발 서버에서만 기본값이 있고, 구글 클라이언트 아이디가 없으면 개발 서버에서만 stub 로그인으로 넘어간다.
 * 빌드한 결과물은 둘 다 값이 있어야 하고, 하나라도 없으면 null이다.
 */
export function readOnlineConfig(env: OnlineEnvironment): OnlineConfig | null {
  const serverUrl = env.VITE_SERVER_URL || (env.DEV ? DEV_SERVER_URL : '');
  const clientId = env.VITE_GOOGLE_CLIENT_ID || null;
  const canLogIn = clientId !== null || env.DEV;
  return serverUrl && canLogIn ? { serverUrl, clientId } : null;
}
