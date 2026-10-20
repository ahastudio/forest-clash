#!/usr/bin/env node
/**
 * 정적 보안 점검: 위험한 API, 외부 주소, 비밀값, 보안 정책(CSP)과 배포 헤더를 확인한다.
 * 의존성 취약점은 `pnpm audit`가 맡는다. 사용: node _agent/checks/security_scan.cjs
 * 어기면 위반 목록을 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const SOURCE_DIRECTORIES = ['src'];
const DANGEROUS_API = /\b(eval|Function)\s*\(|\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML/;
const NETWORK_API = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\b|navigator\.sendBeacon|postMessage/;
const EXTERNAL_URL = /https?:\/\/(?!www\.w3\.org\/|openapi\.vercel\.sh\/)/;
const SECRET = /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api|secret|access)[_-]?(key|token)\s*[:=]\s*['"][^'"]{8,}/i;
const REQUIRED_HEADERS = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security'];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

/** 폴더 아래의 파일을 모두 모은다. */
function filesUnder(directory) {
  if (!exists(directory)) {
    return [];
  }
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

const isGameSource = file => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.includes(`${path.sep}testing${path.sep}`);

/** 파일의 줄마다 패턴을 찾아 「경로:줄 설명」 목록으로 돌려준다. */
function findLines(file, pattern, label) {
  return read(file)
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1} ${label}`] : []));
}

/** 게임 코드에 위험한 API, 네트워크 API가 없는지 본다. */
function sourceViolations() {
  const files = SOURCE_DIRECTORIES.flatMap(filesUnder).filter(isGameSource);
  return files.flatMap(file => [
    ...findLines(file, DANGEROUS_API, '코드를 실행하거나 HTML을 주입하는 API'),
    ...findLines(file, NETWORK_API, '네트워크 또는 창 사이 통신 API(이 게임은 쓰지 않는다)'),
  ]);
}

/** 코드, 페이지, 그림에 외부 주소와 비밀값이 없는지 본다. */
function contentViolations() {
  const files = [...SOURCE_DIRECTORIES.flatMap(filesUnder), 'index.html', 'vercel.json', ...filesUnder('public')].filter(file => /\.(ts|html|json|svg)$/.test(file));
  return files.flatMap(file => [...findLines(file, EXTERNAL_URL, '외부 주소'), ...findLines(file, SECRET, '비밀값으로 보이는 문자열')]);
}

/** 페이지의 보안 정책(CSP) 메타가 스크립트를 같은 출처로 한정하는지 본다. */
function policyViolations() {
  const policy = (read('index.html').match(/Content-Security-Policy"\s+content="([^"]*)"/) ?? [])[1];
  if (!policy) {
    return ['index.html: 보안 정책(CSP) 메타가 없다'];
  }
  const scriptSource = (policy.match(/script-src ([^;]*)/) ?? [])[1] ?? '';
  const problems = [];
  if (scriptSource.trim() !== "'self'") {
    problems.push(`index.html: script-src가 'self'만이 아니다(${scriptSource.trim()})`);
  }
  if (/unsafe-eval/.test(policy)) {
    problems.push('index.html: unsafe-eval을 허용한다');
  }
  return problems;
}

/** 배포 설정에 보안 헤더가 모두 있고 다른 사이트에 끼워 넣을 수 없는지 본다. */
function headerViolations() {
  if (!exists('vercel.json')) {
    return ['vercel.json: 없다'];
  }
  const rules = JSON.parse(read('vercel.json')).headers ?? [];
  const headers = Object.fromEntries(rules.flatMap(rule => rule.headers.map(({ key, value }) => [key.toLowerCase(), value])));
  const missing = REQUIRED_HEADERS.filter(key => !headers[key]).map(key => `vercel.json: ${key} 헤더가 없다`);
  const framing = /frame-ancestors 'none'/.test(headers['content-security-policy'] ?? '') ? [] : ["vercel.json: CSP에 frame-ancestors 'none'이 없다"];
  return [...missing, ...framing];
}

/** 비밀값 파일이 저장소에 올라가지 않게 막혀 있는지, 빌드 결과에 인라인 스크립트와 소스맵이 없는지 본다. */
function repositoryViolations() {
  const ignoresEnvironment = /^\.env$/m.test(read('.gitignore'));
  const builtFiles = filesUnder('dist');
  const inline = builtFiles.filter(file => file.endsWith('.html') && /<script(?![^>]*\bsrc=)[^>]*>/.test(read(file)));
  return [
    ...(ignoresEnvironment ? [] : ['.gitignore: .env가 제외 목록에 없다']),
    ...inline.map(file => `${file}: 인라인 스크립트가 있다`),
    ...builtFiles.filter(file => file.endsWith('.map')).map(file => `${file}: 소스맵이 배포 결과에 들어 있다`),
  ];
}

const violations = [...sourceViolations(), ...contentViolations(), ...policyViolations(), ...headerViolations(), ...repositoryViolations()];
violations.forEach(line => console.error(`위반: ${line}`));
console.log(`보안 점검: 위반 ${violations.length}건`);
process.exit(violations.length === 0 ? 0 : 1);
