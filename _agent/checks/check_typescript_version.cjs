#!/usr/bin/env node
/**
 * TypeScript 7을 쓰지 않도록 의존성을 검사한다. 의존성을 올린 직후와 `pnpm run check`에서 실행한다.
 * 사용: node _agent/checks/check_typescript_version.cjs
 * 어기면 이유를 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const BANNED_MAJOR = 7;
const BANNED_PACKAGES = ['@typescript/native-preview', '@typescript/typescript7', 'typescript-go'];
const FLOATING_SPECS = ['latest', 'next', 'beta', 'rc', '*', 'x'];
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const majorOf = text => Number((String(text).match(/\d+/) ?? [0])[0]);

/** package.json에 선언된 의존성을 이름과 범위의 쌍으로 모은다. */
function declaredDependencies(manifest) {
  return DEPENDENCY_FIELDS.flatMap(field => Object.entries(manifest[field] ?? {}));
}

/** 선언된 범위가 TypeScript 7 이상이거나 올라갈 수 있는 값인가. */
function isBannedSpec(spec) {
  return FLOATING_SPECS.includes(spec) || majorOf(spec) >= BANNED_MAJOR;
}

/** 설치된 TypeScript의 주 버전. 설치되어 있지 않으면 null. */
function installedMajor(root) {
  const file = path.join(root, 'node_modules', 'typescript', 'package.json');
  return fs.existsSync(file) ? majorOf(readJson(file).version) : null;
}

function findProblems(root) {
  const dependencies = declaredDependencies(readJson(path.join(root, 'package.json')));
  const problems = [];
  for (const [name, spec] of dependencies) {
    if (name === 'typescript' && isBannedSpec(spec)) {
      problems.push(`package.json의 typescript 범위가 ${spec}다. ^5.9.3처럼 5.x로 둔다.`);
    }
    if (BANNED_PACKAGES.includes(name)) {
      problems.push(`${name}은 TypeScript 7 계열이라 쓰지 않는다. 지운다.`);
    }
  }
  const major = installedMajor(root);
  if (major !== null && major >= BANNED_MAJOR) {
    problems.push(`설치된 typescript가 ${major}.x다. 5.x로 내리고 pnpm install을 다시 실행한다.`);
  }
  return problems;
}

function main() {
  const problems = findProblems(process.cwd());
  for (const problem of problems) {
    console.error(`TypeScript 7 금지: ${problem}`);
  }
  console.log(problems.length === 0 ? 'TypeScript 버전 검사: 통과' : `TypeScript 버전 검사: 위반 ${problems.length}건`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

main();
