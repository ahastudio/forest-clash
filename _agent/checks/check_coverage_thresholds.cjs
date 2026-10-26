#!/usr/bin/env node
/**
 * 커버리지 기준이 낮춰지지 않았는지 검사한다: 줄, 분기, 문장, 함수의 임계값이 모두 100이어야 하고,
 * 측정에서 빠진 파일은 테스트 파일과 테스트 도우미 폴더뿐이어야 한다.
 * 사용: node _agent/checks/check_coverage_thresholds.cjs
 * 어기면 이유를 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_METRICS = ['statements', 'branches', 'functions', 'lines'];
const ALLOWED_EXCLUDES = ['src/**/*.test.ts', 'src/testing/**'];

const config = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf8');

// 임계값 객체에서 지표 하나의 값을 읽는다. 없으면 null.
const thresholdOf = metric => {
  const match = config.match(new RegExp(`thresholds:\\s*{[^}]*\\b${metric}:\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
};

// 측정에서 뺀 경로 목록을 읽는다.
const excludes = () => [...((config.match(/exclude:\s*\[([^\]]*)\]/) ?? [])[1] ?? '').matchAll(/'([^']+)'/g)].map(match => match[1]);

const problems = [
  ...REQUIRED_METRICS.filter(metric => thresholdOf(metric) !== 100).map(metric => `${metric} 임계값이 100이 아니다(${thresholdOf(metric)})`),
  ...excludes()
    .filter(pattern => !ALLOWED_EXCLUDES.includes(pattern))
    .map(pattern => `측정에서 빠진 경로가 허용 목록 밖이다(${pattern})`),
];
problems.forEach(line => console.error(`위반: ${line}`));
console.log(`커버리지 기준 검사: ${problems.length === 0 ? '통과' : `위반 ${problems.length}건`}`);
process.exit(problems.length === 0 ? 0 : 1);
