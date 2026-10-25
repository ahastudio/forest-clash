#!/usr/bin/env node
/**
 * 서버 배포 파일을 정적으로 점검한다: Dockerfile(hadolint), Ansible 절차(ansible-lint, production 기준),
 * infra/README.md의 nginx 설정(nginx -t).
 * 도구는 설치하지 않고 이미지 다이제스트를 고정해 Docker로 실행한다. Docker가 없으면 위반이다.
 * 사용: node _agent/checks/infra_checks.cjs
 * 하나라도 어기면 이유를 출력하고 종료 코드 1로 끝난다.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HADOLINT = 'hadolint/hadolint@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d';
const ANSIBLE_LINT = 'pipelinecomponents/ansible-lint@sha256:2858d48ce728090626424161dfc96caae15053da7fd2b8541ca105e0e36f5b14';
const NGINX = 'nginx@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10';
/** README의 nginx 설정은 컨테이너 이름으로 업스트림을 적으므로, 검사할 때만 풀 수 있는 주소로 바꾼다. */
const UPSTREAM = 'forest-clash-server:58970';

/** Docker 명령을 실행하고 종료 코드와 출력을 돌려준다. */
const docker = (args, input) => {
  const result = spawnSync('docker', args, { cwd: ROOT, encoding: 'utf8', input });
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
};

/** 실행한 명령의 출력에서 끝의 문제 줄을 보인다. */
const tail = output => output.split('\n').slice(-20).join('\n');

const dockerfile = () => {
  const source = fs.readFileSync(path.join(ROOT, 'server', 'Dockerfile'), 'utf8');
  const result = docker(['run', '--rm', '-i', HADOLINT], source);
  return result.status === 0 ? null : `hadolint 오류\n${tail(result.output)}`;
};

const playbooks = () => {
  const result = docker([
    'run', '--rm', '-v', `${path.join(ROOT, 'infra')}:/infra:ro`, '-w', '/infra', ANSIBLE_LINT, 'ansible-lint', 'deploy.yml', 'status.yml',
  ]);
  return /Passed: 0 failure\(s\), 0 warning\(s\)/.test(result.output) ? null : `ansible-lint 오류\n${tail(result.output)}`;
};

const nginxConfiguration = () => {
  const readme = fs.readFileSync(path.join(ROOT, 'infra', 'README.md'), 'utf8');
  const block = readme.match(/```nginx\n([\s\S]*?)\n```/);
  if (!block) {
    return 'infra/README.md에서 nginx 설정을 찾지 못했다';
  }
  const file = path.join(os.tmpdir(), `forest-clash-nginx-${process.pid}.conf`);
  fs.writeFileSync(file, block[1].replace(UPSTREAM, '127.0.0.1:58970'));
  const result = docker(['run', '--rm', '-v', `${file}:/etc/nginx/conf.d/forest-clash.conf:ro`, NGINX, 'nginx', '-t']);
  fs.rmSync(file, { force: true });
  return /test is successful/.test(result.output) ? null : `nginx -t 오류\n${tail(result.output)}`;
};

const STEPS = [
  ['Dockerfile 정적 분석(hadolint)', dockerfile],
  ['Ansible 정적 분석(ansible-lint production)', playbooks],
  ['nginx 설정 문법(nginx -t)', nginxConfiguration],
];

if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) {
  console.log('위반 Docker를 쓸 수 없다. 이 점검은 Docker가 필요하다');
  process.exit(1);
}

let violations = 0;
for (const [name, step] of STEPS) {
  const problem = step();
  console.log(`${problem ? '위반' : '통과'} ${name}`);
  if (problem) {
    violations++;
    console.log(problem);
  }
}
console.log(`인프라 점검: 위반 ${violations}건`);
process.exit(violations === 0 ? 0 : 1);
