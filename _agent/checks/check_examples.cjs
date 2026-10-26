#!/usr/bin/env node
/**
 * 양식 파일(*.example)과 원본이 값만 빼고 똑같은지 검사한다: 줄 수, 순서, 주석, 이름이 같아야 하고 값만 달라도 된다.
 * 원본은 비밀값이나 서버 주소가 들어 있어 저장소에 없을 수 있으므로, 원본이 없으면 그 쌍은 건너뛴다.
 * 양식 파일이 아래 짝 목록에 없어도 위반이다. 새 양식을 만들면 목록에 짝을 더한다.
 * 사용: node _agent/checks/check_examples.cjs
 * 어기면 어긋난 줄을 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
// [양식 파일, 원본]. 경로는 저장소 루트 기준이다.
const PAIRS = [
  ['.env.example', '.env.local'],
  ['infra/vars.yml.example', 'infra/vars.yml'],
  ['infra/inventory.ini.example', 'infra/inventory.ini'],
];
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite']);

// 줄에서 값을 지워 이름만 남기는 방법. 주석과 빈 줄은 그대로 둔다.
const MASKS = {
  '.env': line => line.replace(/^([A-Za-z_][A-Za-z0-9_]*)=.*$/, '$1='),
  '.yml': line => line.replace(/^(\s*[A-Za-z_][\w-]*:)\s+\S.*$/, '$1'),
  '.ini': line => line.replace(/([A-Za-z_][\w-]*)=('[^']*'|"[^"]*"|\S*)/g, '$1='),
};

// 양식 파일은 원본 이름 끝에 .example이 붙은 것이므로, 그것을 떼고 형식을 가른다.
const kindOf = file => {
  const name = file.replace(/\.example$/, '');
  return name.endsWith('.yml') ? '.yml' : name.endsWith('.ini') ? '.ini' : '.env';
};

const maskFor = file => {
  const mask = MASKS[kindOf(file)];
  return line => (line.trimStart().startsWith('#') || line.trim() === '' ? line : mask(line));
};

// 저장소 안의 양식 파일을 모두 찾는다.
const findExamples = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : findExamples(full);
    }
    return entry.name.endsWith('.example') ? [path.relative(ROOT, full)] : [];
  });

// 파일을 줄로 읽어 값을 지운다. 끝의 빈 줄은 무시한다.
const maskedLines = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\n+$/, '').split('\n').map(maskFor(file));

// 양식의 주석은 원본에도 그대로 들어가므로, 양식 파일이라는 사실이나 복사를 말하면 원본에서 말이 안 된다.
const SELF_REFERENCE = /복사|양식|이 파일|(yml|ini|env)\.example/;

const problems = [];
for (const example of findExamples(ROOT)) {
  if (!PAIRS.some(([listed]) => listed === example)) {
    problems.push(`${example}: 짝 목록(PAIRS)에 없는 양식 파일이다`);
  }
  fs.readFileSync(path.join(ROOT, example), 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.trimStart().startsWith('#') && SELF_REFERENCE.test(line)) {
        problems.push(`${example}:${index + 1}: 주석이 양식 파일이나 복사를 말한다(원본에도 그대로 들어가는 주석이다): ${line.trim()}`);
      }
    });
}
for (const [example, original] of PAIRS) {
  if (!fs.existsSync(path.join(ROOT, original))) {
    console.log(`건너뜀 ${original}(원본 없음)`);
    continue;
  }
  const expected = maskedLines(example);
  const actual = maskedLines(original);
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index++) {
    if (expected[index] !== actual[index]) {
      problems.push(`${original}:${index + 1}: 양식(${example})과 값 말고 다르다\n  양식: ${expected[index] ?? '(줄 없음)'}\n  원본: ${actual[index] ?? '(줄 없음)'}`);
      break;
    }
  }
}

if (problems.length === 0) {
  console.log('양식 점검: 위반 0건');
  process.exit(0);
}
problems.forEach(problem => console.log(`위반 ${problem}`));
console.log(`양식 점검: 위반 ${problems.length}건`);
process.exit(1);
