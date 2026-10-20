# 의존성

## TypeScript 7은 쓰지 않는다

- `typescript`는 5.x다(`package.json`에 `^5.9.3`). 7은 안정화되기 전까지 이 프로젝트에서 쓰지 않는다.
  안정화되었으니 옮기자고 사용자가 말했을 때만 7로 옮긴다.
- `@typescript/native-preview`, `@typescript/typescript7`, `typescript-go` 같은 7 계열 패키지도 설치하지 않는다.

## 의존성을 올릴 때

- `pnpm update`, `pnpm add typescript@latest`, `pnpm add typescript@next`, `pnpm update --latest`처럼 TypeScript의 버전을 흘러가게 하는 명령을 쓰지 않는다.
  `pnpm outdated`가 TypeScript 7을 보여도 올리지 않는다.
- 일괄 업그레이드 도구를 쓸 때는 `typescript`를 제외한다.
- 다른 패키지를 올릴 때 TypeScript 7을 요구하면 그 패키지의 업그레이드를 멈추고 사용자에게 알린다. TypeScript를 올려서 맞추지 않는다.
- 의존성을 바꾼 직후 `pnpm run guard`를 실행한다. `pnpm run check`도 맨 앞에서 같은 검사를 한다.
  위반이 나오면 다른 작업보다 먼저 `typescript`를 `^5.9.3`으로 되돌리고 `pnpm install`을 다시 실행한다.
- `pnpm-lock.yaml`은 `package.json`과 함께 커밋한다.
  잠금 파일에 `typescript` 7이 들어 있지 않은지 `pnpm ls typescript`로 확인한다.
