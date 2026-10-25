import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** 화면 구석에 보일 버전: 요청마다 현재 커밋 번호와 미커밋 변경 여부를 읽는다. 어떤 버전을 보고 있는지 눈으로 확인하기 위함이다. */
const version = (): string => {
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deployedCommit) {
    return deployedCommit.slice(0, 7);
  }
  try {
    const cwd = import.meta.dirname;
    const hash = execSync('git rev-parse --short HEAD', { cwd }).toString().trim();
    const dirty = execSync('git status --porcelain -- .', { cwd }).toString().trim() ? '+수정중' : '';
    return hash + dirty;
  } catch {
    return '알 수 없음';
  }
};

/** 환경 값의 서버 주소(예: ws://주소:포트/ws)에서 출처(ws://주소:포트)를 꺼낸다. 값이 없거나 주소가 아니면 빈 글자다. */
const originOf = (serverUrl: string | undefined): string => {
  try {
    return serverUrl ? new URL(serverUrl).origin : '';
  } catch {
    return '';
  }
};

/**
 * 서버 주소(VITE_SERVER_URL)가 있으면 그 출처를 페이지의 보안 정책(CSP) 연결 허용에 더한다.
 * 서버는 게임과 포트가 달라서 같은 출처('self')로는 연결할 수 없기 때문이다.
 */
const serverConnection = (): Plugin => {
  let origin = '';
  return {
    name: 'server-connection',
    configResolved: config => {
      origin = originOf(config.env.VITE_SERVER_URL);
    },
    transformIndexHtml: html => (origin ? html.replace("connect-src 'self'", `connect-src 'self' ${origin}`) : html),
  };
};

/** localhost와 127.0.0.1 어느 쪽으로 접속해도 열리게 한다. */
const serverOptions = { port: 58969, strictPort: true, host: '0.0.0.0' };

export default defineConfig({
  /**
   * 개발 서버만 브라우저가 옛 파일을 쓰지 않게 캐시를 끈다. 빌드 결과를 여는 미리보기는 기본 캐시 규칙을 따른다.
   * 검사를 돌릴 때마다 다시 쓰이는 coverage와 빌드 결과, 서버, 인프라 폴더는 감시하지 않는다. 감시하면 열려 있는 게임 화면이 통째로 새로고침된다.
   */
  server: {
    ...serverOptions,
    headers: { 'Cache-Control': 'no-store' },
    watch: { ignored: ['**/coverage/**', '**/dist/**', '**/server/**', '**/infra/**'] },
  },
  preview: serverOptions,
  plugins: [
    serverConnection(),
    { name: 'game-version', transformIndexHtml: html => html.replace('__GAME_VERSION__', version()) },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/testing/**'],
      reporter: ['text', 'html'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
