import { execSync } from 'node:child_process';
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

/** localhost와 127.0.0.1 어느 쪽으로 접속해도 열리게 한다. */
const serverOptions = { port: 58969, strictPort: true, host: '0.0.0.0' };

export default defineConfig({
  /** 개발 서버만 브라우저가 옛 파일을 쓰지 않게 캐시를 끈다. 빌드 결과를 여는 미리보기는 기본 캐시 규칙을 따른다. */
  server: { ...serverOptions, headers: { 'Cache-Control': 'no-store' } },
  preview: serverOptions,
  plugins: [{ name: 'game-version', transformIndexHtml: html => html.replace('__GAME_VERSION__', version()) }],
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
