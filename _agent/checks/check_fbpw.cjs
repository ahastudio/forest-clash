#!/usr/bin/env node
/**
 * specs/ 아래의 모든 기능 폴더가 FBPW 템플릿(https://github.com/ahastudio/file-based-planning-workflow 의 templates/)과 같은 틀인지 검사한다.
 * 파일 여섯 개, 제목, 섹션 순서와 하위 제목, Phase 이름, 고정 문구, 표 머리글, 라벨, 날짜 표기를 본다.
 * 사용: node _agent/checks/check_fbpw.cjs
 * 어기면 파일과 이유를 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const SPECS = path.join(__dirname, '..', '..', 'specs');
const FILES = ['README', 'spec', 'plan', 'tasks', 'progress', 'findings'];
const PHASES = ['Requirements & Discovery', 'Planning & Structure', 'Implementation', 'Testing'];
const SECTIONS = {
  README: ['Background', 'Goal', 'How it works', 'Related Documents'],
  spec: ['Overview', 'User Scenarios & Testing (mandatory)', 'Functional Requirements (mandatory)', 'Constraints (mandatory)', 'Success Criteria (mandatory)'],
  plan: ['Summary', 'Requirements', 'Critical Files', 'Architecture', 'Implementation Steps', 'Verification', 'Considerations'],
  tasks: ['Goal', 'Current Phase', 'Phases', 'Notes'],
  findings: ['Requirements', 'Research Findings', 'Resources', 'Technical Decisions', 'Issues Encountered', 'Learnings'],
};
const SUBSECTIONS = {
  plan: {
    'Critical Files': ['New Files', 'Modified Files', 'Reference Files'],
    Architecture: ['User Flow', 'Event Flow', 'Domain Model'],
    Verification: ['Build', 'Test', 'Manual Test'],
  },
  findings: { 'Research Findings': ['코드베이스 구조', '기존 패턴'], Resources: ['코드 참조'] },
};
const RELATED = [
  '- [spec.md](spec.md): 요구사항 및 상세 스펙',
  '- [plan.md](plan.md): 기술 구현 계획',
  '- [tasks.md](tasks.md): 작업 계획 및 추적',
  '- [findings.md](findings.md): 기술적 발견사항 및 결정',
  '- [progress.md](progress.md): 세션별 작업 내역',
];
const NOTES = [
  '- 진행할 때마다 Phase 상태를 업데이트하세요: ⏸️ 대기 → 🔄 진행 중 → ✅ 완료',
  '- 결정 사항은 findings.md의 Technical Decisions에 기록하세요.',
  '- 오류는 findings.md의 Issues Encountered에 기록하세요.',
];
const QUESTIONS = ['1. 현재 어느 단계인가?', '2. 다음에 할 일은?', '3. 목표는?', '4. 지금까지 배운 것?', '5. 완료한 작업은?'];
const TITLES = {
  spec: /^# Feature Specification: \S/,
  plan: /^# Implementation Plan: \S/,
  tasks: /^# Tasks: \S/,
  progress: /^# Progress Log$/,
  findings: /^# Findings & Decisions$/,
  README: /^# \S/,
};
const BLOCKQUOTES = {
  progress: '> **각 단계를 완료하거나 문제가 발생하면 업데이트하세요.**',
  findings: '> **기술적 발견, 중요한 결정이 있을 때마다 이 파일을 즉시 업데이트하세요.**',
};

const problems = [];
const report = (feature, file, message) => problems.push(`${feature}/${file}.md: ${message}`);

// `## ` 제목 목록. 코드 블록 안은 제외한다.
const headings = (text, level) => {
  let inFence = false;
  return text.split('\n').flatMap(line => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }
    return !inFence && line.startsWith(`${'#'.repeat(level)} `) ? [line.slice(level + 1).trim()] : [];
  });
};

// `## section` 아래의 `### ` 제목 목록.
const subheadings = (text, section) => {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === `## ${section}`);
  if (start < 0) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => line.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).filter(line => line.startsWith('### ')).map(line => line.slice(4).trim());
};

const count = (text, pattern) => (text.match(pattern) || []).length;

// 번호가 1부터 빠짐없이 이어지는가.
const contiguous = numbers => numbers.every((number, index) => number === index + 1);
const numbersOf = (text, pattern) => [...text.matchAll(pattern)].map(match => Number(match[1]));
const checkNumbering = (feature, file, text, labels) => {
  for (const [label, pattern] of labels) {
    if (!contiguous(numbersOf(text, pattern))) {
      report(feature, file, `${label} 번호가 1부터 이어지지 않는다: ${numbersOf(text, pattern).join(', ')}`);
    }
  }
};

// progress.md의 Session 제목은 여러 개일 수 있으므로 Session으로 묶어 비교한다.
const progressSections = text => headings(text, 2).map(title => (/^Session \d{4}-\d{2}-\d{2}$/.test(title) ? 'Session' : title));
const collapse = titles => titles.filter((title, index) => index === 0 || title !== titles[index - 1]);

function checkSections(feature, file, text) {
  const wanted = file === 'progress' ? ['Session', 'Test Results', 'Error Log', '5-Question Reboot Check'] : SECTIONS[file];
  const actual = file === 'progress' ? collapse(progressSections(text)) : headings(text, 2);
  const allowed = file === 'spec' ? [...wanted, 'OpenAPI Specification (optional)'] : wanted;
  if (JSON.stringify(actual) !== JSON.stringify(wanted) && JSON.stringify(actual) !== JSON.stringify(allowed)) {
    report(feature, file, `## 제목이 템플릿과 다르다: ${actual.join(' / ')}`);
  }
  for (const [section, titles] of Object.entries(SUBSECTIONS[file] || {})) {
    if (JSON.stringify(subheadings(text, section)) !== JSON.stringify(titles)) {
      report(feature, file, `## ${section}의 ### 제목이 템플릿과 다르다: ${subheadings(text, section).join(' / ')}`);
    }
  }
}

function checkReadme(feature, text) {
  RELATED.filter(line => !text.includes(line)).forEach(line => report(feature, 'README', `관련 문서 줄이 없다: ${line}`));
}

function checkSpec(feature, text) {
  if (count(text, /^### User Story \d+: \S/gm) === 0) {
    report(feature, 'spec', 'User Story가 없다');
  }
  const stories = count(text, /^### User Story/gm);
  for (const [label, pattern] of [['- As:', /^- As: /gm], ['- I:', /^- I: /gm], ['- So:', /^- So: /gm], ['#### Acceptance Scenarios', /^#### Acceptance Scenarios$/gm]]) {
    if (count(text, pattern) !== stories) {
      report(feature, 'spec', `User Story ${stories}개인데 ${label}가 ${count(text, pattern)}개다`);
    }
  }
  const scenarios = count(text, /^Scenario \d+: \*\*.+\*\*$/gm);
  for (const label of ['Given', 'When', 'Then']) {
    if (count(text, new RegExp(`^- ${label}: `, 'gm')) !== scenarios) {
      report(feature, 'spec', `Scenario ${scenarios}개인데 - ${label}:가 ${count(text, new RegExp(`^- ${label}: `, 'gm'))}개다`);
    }
  }
  if (count(text, /^- As: .+\n- I: .+\n- So: .+$/gm) !== stories) {
    report(feature, 'spec', 'User Story의 - As:, - I:, - So:가 한 줄씩 이어지지 않는다');
  }
  checkNumbering(feature, 'spec', text, [
    ['User Story', /^### User Story (\d+): /gm],
    ['FR', /^- FR-(\d+): /gm],
    ['CON', /^- CON-(\d+): /gm],
    ['SC', /^- SC-(\d+): /gm],
  ]);
  for (const story of text.split(/^### User Story /m).slice(1)) {
    const numbers = numbersOf(story.split('\n## ')[0], /^Scenario (\d+): /gm);
    if (!contiguous(numbers)) {
      report(feature, 'spec', `Scenario 번호가 1부터 이어지지 않는다: ${numbers.join(', ')}`);
    }
  }
  for (const prefix of ['FR', 'CON', 'SC']) {
    if (count(text, new RegExp(`^- ${prefix}-\\d+: `, 'gm')) === 0) {
      report(feature, 'spec', `${prefix}-N 항목이 없다`);
    }
  }
}

function checkPlan(feature, text) {
  if (!/## Requirements\n\n1\. /.test(text)) {
    report(feature, 'plan', 'Requirements가 번호 목록이 아니다');
  }
  checkNumbering(feature, 'plan', text, [['Step', /^### Step (\d+): /gm]]);
  const steps = subheadings(text, 'Implementation Steps');
  steps.filter(step => !/^Step \d+: .+ - .+/.test(step)).forEach(step => report(feature, 'plan', `Step 제목이 「Step N: 계층 - 이름」이 아니다: ${step}`));
  const [reds, greens, refactorings] = ['Red', 'Green', 'Refactoring'].map(label => count(text, new RegExp(`^\\*\\*${label}:\\*\\*`, 'gm')));
  if (!(reds === steps.length && greens === steps.length && refactorings === steps.length)) {
    report(feature, 'plan', `Step ${steps.length}개인데 Red ${reds}, Green ${greens}, Refactoring ${refactorings}개다`);
  }
}

function checkTasks(feature, text) {
  const phases = text.split('\n').filter(line => line.startsWith('### Phase '));
  const names = phases.map(line => line.replace(/^### Phase \d+: /, '').replace(/ [✅🔄⏸️]+$/u, ''));
  if (JSON.stringify(names) !== JSON.stringify(PHASES)) {
    report(feature, 'tasks', `Phase가 템플릿의 네 개와 다르다: ${names.join(' / ')}`);
  }
  phases.filter(line => !/ [✅🔄⏸️]+$/u.test(line)).forEach(line => report(feature, 'tasks', `Phase 제목에 상태 표시가 없다: ${line}`));
  if (!/## Current Phase\n\n[✅🔄⏸️]+ Phase \d: (Requirements & Discovery|Planning & Structure|Implementation|Testing)\n/u.test(text)) {
    report(feature, 'tasks', 'Current Phase가 「상태 Phase N: 이름」 한 줄이 아니다(덧붙인 글자가 있으면 안 된다)');
  }
  const notes = text.split('## Notes\n')[1] || '';
  NOTES.filter(line => !notes.includes(line)).forEach(line => report(feature, 'tasks', `Notes에 고정 문구가 없다: ${line}`));
}

function checkProgress(feature, text) {
  const phases = text.split('\n').filter(line => /^### Phase \d: /.test(line));
  phases
    .filter(line => !PHASES.some((name, index) => line.startsWith(`### Phase ${index + 1}: ${name} `)))
    .forEach(line => report(feature, 'progress', `Phase 번호와 이름이 템플릿과 다르다: ${line}`));
  for (const [, status] of text.matchAll(/^### Phase \d: .+ ⏸️\n\n(.*)$/gmu)) {
    if (status !== '아직 시작 안 함') {
      report(feature, 'progress', `⏸️ Phase 아래 문구가 「아직 시작 안 함」이 아니다: ${status}`);
    }
  }
  if (count(text, /^\*\*작업 내역\*\*:$/gm) !== count(text, /^\*\*생성\/수정 파일\*\*:$/gm)) {
    report(feature, 'progress', '**작업 내역**:과 **생성/수정 파일**: 개수가 다르다');
  }
  if (!text.includes('| Test ') || !/\| Test\s+\| Input\s+\| Expected\s+\| Actual\s+\| Status \|/.test(text)) {
    report(feature, 'progress', 'Test Results 표 머리글이 템플릿과 다르다');
  }
  if (!/\| Timestamp\s+\| Error\s+\| Attempt\s+\| Resolution\s+\|/.test(text)) {
    report(feature, 'progress', 'Error Log 표 머리글이 템플릿과 다르다');
  }
  if (!/\| Question\s+\| Answer\s+\|/.test(text)) {
    report(feature, 'progress', '5-Question 표 머리글이 템플릿과 다르다');
  }
  QUESTIONS.filter(question => !text.includes(question)).forEach(question => report(feature, 'progress', `5-Question 항목이 없다: ${question}`));
}

function checkFindings(feature, text) {
  const resources = subheadings(text, 'Resources');
  resources.filter(title => !['문서', '코드 참조', 'API 엔드포인트'].includes(title)).forEach(title => report(feature, 'findings', `Resources의 ### 제목이 템플릿에 없다: ${title}`));
  if (resources.length === 0) {
    report(feature, 'findings', 'Resources에 ### 제목이 없다');
  }
  if (!/\| Decision\s+\| Rationale\s+\|/.test(text)) {
    report(feature, 'findings', 'Technical Decisions 표 머리글이 「Decision | Rationale」이 아니다');
  }
  checkNumbering(feature, 'findings', text, [['Issue', /^### (\d+)\. /gm]]);
  const issues = count(text, /^### \d+\. .+$/gm);
  for (const label of ['문제', '원인', '해결', '결과']) {
    if (count(text, new RegExp(`^\\*\\*${label}\\*\\*:$`, 'gm')) !== issues) {
      report(feature, 'findings', `Issue ${issues}개인데 **${label}**:가 ${count(text, new RegExp(`^\\*\\*${label}\\*\\*:$`, 'gm'))}개다`);
    }
  }
  subheadings(text, 'Learnings')
    .filter(title => !/ \(\d{4}-\d{2}-\d{2}\)$/.test(title))
    .forEach(title => report(feature, 'findings', `Learnings 제목에 날짜(YYYY-MM-DD)가 없다: ${title}`));
}

const CHECKS = { README: checkReadme, spec: checkSpec, plan: checkPlan, tasks: checkTasks, progress: checkProgress, findings: checkFindings };

for (const feature of fs.readdirSync(SPECS).filter(name => fs.statSync(path.join(SPECS, name)).isDirectory()).sort()) {
  for (const file of FILES) {
    const target = path.join(SPECS, feature, `${file}.md`);
    if (!fs.existsSync(target)) {
      report(feature, file, '파일이 없다');
      continue;
    }
    const text = fs.readFileSync(target, 'utf8');
    if (!TITLES[file].test(text.split('\n')[0])) {
      report(feature, file, `첫 줄 제목이 템플릿과 다르다: ${text.split('\n')[0]}`);
    }
    if (BLOCKQUOTES[file] && !text.includes(BLOCKQUOTES[file])) {
      report(feature, file, '고정 안내 문구(> **...**)가 없다');
    }
    if (SECTIONS[file] || file === 'progress') {
      checkSections(feature, file, text);
    }
    CHECKS[file](feature, text);
  }
}

if (problems.length === 0) {
  console.log('FBPW 점검: 위반 0건');
  process.exit(0);
}
problems.forEach(problem => console.log(`위반 ${problem}`));
console.log(`FBPW 점검: 위반 ${problems.length}건`);
process.exit(1);
