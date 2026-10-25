import type { OnlineConfig } from './config';
import type { GoogleApi } from './google-login';
import { createSignIn } from './google-login';
import { OnlineSession } from './session';
import { createStubSignIn } from './stub-login';
import { openWebSocket } from './web-socket';

interface SessionSetup {
  /** 서버 주소와 클라이언트 아이디. 없으면 온라인 대전을 고를 때 설정이 없다고 알린다. */
  config: OnlineConfig | null;
  doc: Document;
  win: { google?: GoogleApi };
  /** 상대가 정해지면 새 판을 시작시킬 게임. */
  game: { startOnlineMatch(): void };
}

const missingConfig = (): Promise<string> => Promise.reject(new Error('온라인 대전 설정이 없습니다'));

/** 설정에 맞는 로그인: 설정이 없으면 알리고, 클라이언트 아이디가 없으면 stub, 있으면 구글이다. */
function signInFor({ config, doc, win }: Pick<SessionSetup, 'config' | 'doc' | 'win'>): () => Promise<string> {
  if (!config) {
    return missingConfig;
  }
  return config.clientId ? createSignIn({ doc, win, clientId: config.clientId }) : createStubSignIn();
}

/** 브라우저의 웹소켓과 로그인을 쓰는 온라인 대전 흐름을 만든다. */
export function createSession({ config, doc, win, game }: SessionSetup): OnlineSession {
  const signIn = signInFor({ config, doc, win });
  return new OnlineSession({
    serverUrl: config?.serverUrl ?? '',
    signIn,
    open: openWebSocket,
    now: performance.now.bind(performance),
    onMatched: game.startOnlineMatch.bind(game),
  });
}
