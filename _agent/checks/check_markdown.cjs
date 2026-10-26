#!/usr/bin/env node
/**
 * 마크다운 문서의 표기 규칙을 검사한다.
 * 1. 굵은 글씨로 소제목을 대신하지 않는다(문장이 아니라 이름만 굵게 쓴 한 줄).
 *    예외는 FBPW 템플릿이 정한 라벨(작업 내역, 생성/수정 파일, 문제, 원인, 해결, 결과)이다.
 * 2. 주소(URL)는 <...>로 감싼다. 코드 블록, 인라인 코드, [글자](주소)의 대상은 예외다.
 * 3. 제목 줄 앞에는 빈 줄이 있다(코드 블록 안은 제외).
 * 사용: node _agent/checks/check_markdown.cjs
 * 어기면 파일과 줄 번호를 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite', '.vercel']);
// 굵은 글씨만 있는 한 줄. 문장(마침표, 물음표, 따옴표로 끝남)이면 강조이므로 소제목이 아니다.
const BOLD_ONLY_LINE = /^\*\*([^*]+)\*\*:?\s*$/;
const SENTENCE_END = /[.?!"'”」)]$/;
// FBPW 템플릿(progress.md, findings.md)이 굵은 글씨 라벨로 정한 이름. 템플릿 그대로 쓴다.
const FBPW_LABELS = new Set(['작업 내역', '생성/수정 파일', '문제', '원인', '해결', '결과']);

// 저장소의 마크다운 파일을 모두 찾는다.
const findMarkdown = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : findMarkdown(full);
    }
    return entry.name.endsWith('.md') ? [full] : [];
  });

// 코드 블록 밖의 줄만 [번호, 줄]로 돌려준다.
const proseLines = text => {
  let inFence = false;
  return text.split('\n').flatMap((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return [];
    }
    return inFence ? [] : [[index + 1, line]];
  });
};

// 인라인 코드, 링크의 대상, <...>로 감싼 주소를 지운 줄. 남은 주소가 맨 주소다.
const withoutAllowedUrls = line => line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/<[^>]*>/g, '');

const problems = [];
for (const file of findMarkdown(ROOT)) {
  const name = path.relative(ROOT, file);
  const lines = proseLines(fs.readFileSync(file, 'utf8'));
  let previous = '';
  for (const [number, line] of lines) {
    const bold = line.match(BOLD_ONLY_LINE);
    if (bold && !SENTENCE_END.test(bold[1].trim()) && !FBPW_LABELS.has(bold[1].trim())) {
      problems.push(`${name}:${number}: 굵은 글씨로 소제목을 대신했다(#### 헤딩을 쓴다): ${line}`);
    }
    if (/https?:\/\//.test(withoutAllowedUrls(line))) {
      problems.push(`${name}:${number}: 주소를 <...>로 감싸지 않았다: ${line.trim()}`);
    }
    if (/^#{1,6} /.test(line) && previous.trim() !== '' && number > 1) {
      problems.push(`${name}:${number}: 제목 앞에 빈 줄이 없다: ${line}`);
    }
    previous = line;
  }
}

if (problems.length === 0) {
  console.log('마크다운 점검: 위반 0건');
  process.exit(0);
}
problems.forEach(problem => console.log(`위반 ${problem}`));
console.log(`마크다운 점검: 위반 ${problems.length}건`);
process.exit(1);
