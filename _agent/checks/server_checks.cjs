#!/usr/bin/env node
/**
 * 온라인 대전 서버(Go, server/)를 점검한다: 서식(gofmt), 정적 분석(go vet, staticcheck),
 * 경쟁 조건 검사를 켠 테스트, 문장(줄) 커버리지 100퍼센트, 분기 커버리지 100퍼센트(gobco).
 * Go는 go.mod의 go 줄 버전으로 mise를 거쳐 실행한다. mise가 없으면 PATH의 go를 쓴다.
 * 사용: node _agent/checks/server_checks.cjs
 * 하나라도 어기면 이유를 출력하고 종료 코드 1로 끝난다.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER_DIRECTORY = path.join(__dirname, '..', '..', 'server');
/** 도구는 설치하지 않고 버전을 고정해 go run으로 실행한다. */
const STATICCHECK = 'honnef.co/go/tools/cmd/staticcheck@v0.8.2';
const GOBCO = 'github.com/rillig/gobco@v1.3.4';

const goVersion = fs.readFileSync(path.join(SERVER_DIRECTORY, 'go.mod'), 'utf8').match(/^go (\S+)/m)[1];
const hasMise = spawnSync('mise', ['--version'], { encoding: 'utf8' }).status === 0;

/** server 폴더에서 Go 도구(go, gofmt)를 실행하고 종료 코드와 출력을 돌려준다. */
const run = (program, args) => {
  const [command, commandArguments] = hasMise ? ['mise', ['exec', `go@${goVersion}`, '--', program, ...args]] : [program, args];
  const result = spawnSync(command, commandArguments, { cwd: SERVER_DIRECTORY, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
};

const go = args => run('go', args);

/** 실행한 명령의 출력에서 끝의 문제 줄을 보인다. */
const tail = output => output.split('\n').slice(-15).join('\n');

const formatting = () => {
  const result = run('gofmt', ['-l', '.']);
  return result.status === 0 && result.output === '' ? null : `gofmt가 고칠 파일이 있다\n${tail(result.output)}`;
};

const vet = () => {
  const result = go(['vet', './...']);
  return result.status === 0 ? null : `go vet 오류\n${tail(result.output)}`;
};

const staticcheck = () => {
  const result = go(['run', STATICCHECK, './...']);
  return result.status === 0 ? null : `staticcheck 오류\n${tail(result.output)}`;
};

const statementCoverage = () => {
  const profile = path.join(os.tmpdir(), `forest-clash-server-${process.pid}.cover`);
  const tests = go(['test', '-race', '-count=1', `-coverprofile=${profile}`, './...']);
  if (tests.status !== 0) {
    return `테스트 실패\n${tail(tests.output)}`;
  }
  const total = go(['tool', 'cover', `-func=${profile}`]).output.split('\n').at(-1);
  fs.rmSync(profile, { force: true });
  return /\s100\.0%$/.test(total) ? null : `문장 커버리지가 100퍼센트가 아니다: ${total}`;
};

const branchCoverage = () => {
  const result = go(['run', GOBCO, '-branch', '.']);
  const match = result.output.match(/Branch coverage: (\d+)\/(\d+)/);
  if (result.status !== 0 || !match) {
    return `분기 커버리지를 재지 못했다\n${tail(result.output)}`;
  }
  return match[1] === match[2] ? null : `분기 커버리지가 100퍼센트가 아니다(${match[1]}/${match[2]})\n${tail(result.output)}`;
};

const STEPS = [
  ['서식(gofmt)', formatting],
  ['정적 분석(go vet)', vet],
  ['정적 분석(staticcheck)', staticcheck],
  ['테스트(-race)와 문장 커버리지 100퍼센트', statementCoverage],
  ['분기 커버리지 100퍼센트(gobco)', branchCoverage],
];

let violations = 0;
for (const [name, step] of STEPS) {
  const problem = step();
  console.log(`${problem ? '위반' : '통과'} ${name}`);
  if (problem) {
    violations++;
    console.log(problem);
  }
}
console.log(`서버 점검: 위반 ${violations}건`);
process.exit(violations === 0 ? 0 : 1);
