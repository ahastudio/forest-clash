import type { OnlineEnvironment } from './online/config';
import type { GoogleApi } from './online/google-login';

/** Vite가 빌드 때 넣어 주는 환경 값. 서버 주소와 구글 클라이언트 아이디를 받는 데 쓴다. */
declare global {
  interface ImportMeta {
    readonly env: OnlineEnvironment;
  }

  /** 구글 로그인 스크립트가 불러와진 뒤에 생긴다. */
  interface Window {
    google?: GoogleApi;
  }
}
