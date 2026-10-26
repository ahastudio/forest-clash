#!/usr/bin/env node
/**
 * 성능 예산 점검: 빌드 결과의 크기와 프레임당 계산 시간을 기준과 비교한다.
 * 먼저 `pnpm run build`와 `vitest bench`(결과 파일 `coverage/bench.json`)를 실행해 둔다.
 * 사용: node _agent/checks/performance_budget.cjs
 * 기준을 넘으면 항목을 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = process.cwd();
const KILOBYTE = 1024;
// 화면은 초당 60번 그리므로 한 프레임은 약 16.7ms다. 계산(엔진과 컴퓨터 상대)은 그 5퍼센트 안에 끝나야 한다.
const FRAME_MILLISECONDS = 1000 / 60;
const MAX_CALCULATION_RATIO = 0.05;
const BENCH_FRAMES = 600;
const BUDGET = {
  scriptGzipKilobytes: 60,
  singleFileKilobytes: 400,
  totalKilobytes: 3072,
  pageKilobytes: 4,
};

const filesUnder = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });

const kilobytes = bytes => bytes / KILOBYTE;

// 항목 하나를 기준과 비교해 출력하고, 넘으면 위반 문구를 돌려준다.
function judge(name, value, limit, unit) {
  const over = value > limit;
  const limitText = `${Number(limit.toFixed(2))}${unit}`;
  console.log(`${over ? '초과' : '통과'} ${name}: ${value.toFixed(2)}${unit} (기준 ${limitText} 이하)`);
  return over ? [`${name} ${value.toFixed(2)}${unit} > ${limitText}`] : [];
}

// 빌드 결과의 크기: 스크립트(압축), 파일 하나, 전체, 첫 페이지.
function sizeViolations() {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist)) {
    return ['dist가 없다: 먼저 pnpm run build를 실행한다'];
  }
  const files = filesUnder(dist);
  const sizeOf = file => fs.statSync(file).size;
  const scripts = files.filter(file => file.endsWith('.js'));
  const scriptGzip = scripts.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file)).length, 0);
  const largest = Math.max(...files.map(sizeOf));
  return [
    ...judge('스크립트 압축 크기', kilobytes(scriptGzip), BUDGET.scriptGzipKilobytes, 'kB'),
    ...judge('가장 큰 파일', kilobytes(largest), BUDGET.singleFileKilobytes, 'kB'),
    ...judge('빌드 결과 전체', kilobytes(files.reduce((sum, file) => sum + sizeOf(file), 0)), BUDGET.totalKilobytes, 'kB'),
    ...judge('첫 페이지(index.html)', kilobytes(sizeOf(path.join(dist, 'index.html'))), BUDGET.pageKilobytes, 'kB'),
  ];
}

// 프레임당 계산 시간: 가장 느린 측정(최댓값)을 프레임 수로 나눈 값이 한 프레임의 5퍼센트 안인가.
function frameViolations() {
  const report = path.join(root, 'coverage', 'bench.json');
  if (!fs.existsSync(report)) {
    return ['coverage/bench.json이 없다: 먼저 pnpm run bench를 실행한다'];
  }
  const benchmarks = JSON.parse(fs.readFileSync(report, 'utf8')).files.flatMap(file => file.groups.flatMap(group => group.benchmarks));
  return benchmarks.flatMap(({ name, max }) =>
    judge(`프레임당 계산(${name})`, max / BENCH_FRAMES, FRAME_MILLISECONDS * MAX_CALCULATION_RATIO, 'ms'),
  );
}

const violations = [...sizeViolations(), ...frameViolations()];
violations.forEach(line => console.error(`위반: ${line}`));
console.log(`성능 예산: 위반 ${violations.length}건`);
process.exit(violations.length === 0 ? 0 : 1);
