#!/usr/bin/env node
/**
 * JSDoc 표기를 점검한다. 규칙은 `_agent/rules/coding-style.md`의 「주석과 JSDoc」이다.
 *
 * - JSDoc(`/** ... *\/`)은 문서화하는 것에만 쓴다. export한 선언과 그 공개 멤버(`private`이 아닌 것)다.
 * - 그 밖의 설명(내부 선언, 함수 본문, 시험, 검사 스크립트의 내부 함수)은 `//` 일반 주석으로 쓴다.
 * - JSDoc은 한 줄로 쓰지 않는다. 항상 `/**`, ` * 내용`, ` *\/` 세 줄 이상이다.
 * - 파일 맨 위의 설명 블록은 파일을 소개하는 문서이므로 JSDoc으로 둔다.
 *
 * 사용: node _agent/checks/check_jsdoc.cjs [--fix]
 * `--fix`는 JSDoc이 아닌 자리의 JSDoc을 `//` 주석으로, 한 줄 JSDoc을 여러 줄로 고친다.
 * 위반이 남으면 목록을 출력하고 종료 코드 1로 끝난다.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..');
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.git', '.vite', 'public', 'server', 'infra', 'specs']);
const EXTENSIONS = new Set(['.ts', '.cjs', '.mjs', '.js']);
// 형식 검사 도구가 읽는 태그가 든 블록은 JSDoc 자리에서 옮기지 않는다.
const TOOL_TAGS = /@(type|typedef|satisfies|import|ts-)/;

const { SyntaxKind } = ts;
const MEMBER_KINDS = new Set([
  SyntaxKind.PropertyDeclaration,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
  SyntaxKind.PropertySignature,
  SyntaxKind.MethodSignature,
  SyntaxKind.EnumMember,
]);
const CONTAINER_KINDS = new Set([
  SyntaxKind.ClassDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.TypeLiteral,
]);

const walk = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walk(full);
    }
    return EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });

const hasModifier = (node, kind) => (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some(m => m.kind === kind);

// `export { a, b as c }`로 내보내는 이 파일 안의 이름들.
const exportedNamesOf = sourceFile => {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        names.add((element.propertyName ?? element.name).text);
      }
    }
  }
  return names;
};

const declaredNames = node => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map(d => d.name.getText());
  }
  return node.name ? [node.name.getText()] : [];
};

const isHiddenMember = node =>
  hasModifier(node, SyntaxKind.PrivateKeyword) ||
  hasModifier(node, SyntaxKind.ProtectedKeyword) ||
  (node.name && ts.isPrivateIdentifier(node.name));

// 이 선언이 문서화할 대상(export한 선언과 그 공개 멤버)인가.
const isDocumented = (node, exportedNames) => {
  if (!node || ts.isSourceFile(node)) {
    return false;
  }
  if (hasModifier(node, SyntaxKind.ExportKeyword)) {
    return true;
  }
  if (node.parent && ts.isSourceFile(node.parent)) {
    return declaredNames(node).some(name => exportedNames.has(name));
  }
  if (MEMBER_KINDS.has(node.kind)) {
    return !isHiddenMember(node) && isDocumented(node.parent, exportedNames);
  }
  return CONTAINER_KINDS.has(node.kind) && isDocumented(node.parent, exportedNames);
};

const isFileHeader = (text, position) => text.slice(0, position).replace(/^#!.*\n/, '').trim() === '';

// 파일의 모든 JSDoc 블록과, 그 블록이 붙은 선언. 붙은 선언이 없으면 node는 null이다.
const collectBlocks = sourceFile => {
  const { text } = sourceFile;
  const blocks = new Map();
  const visit = node => {
    for (const range of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      if (range.kind === SyntaxKind.MultiLineCommentTrivia && text.startsWith('/**', range.pos) && !blocks.has(range.pos)) {
        blocks.set(range.pos, { pos: range.pos, end: range.end, node });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const match of text.matchAll(/\/\*\*/g)) {
    if (!blocks.has(match.index)) {
      const end = text.indexOf('*/', match.index) + 2;
      blocks.set(match.index, { pos: match.index, end, node: null });
    }
  }
  return [...blocks.values()].sort((a, b) => a.pos - b.pos);
};

const lineOf = (text, position) => text.slice(0, position).split('\n').length;

const startsLine = (text, position) => /^[ \t]*$/.test(text.slice(text.lastIndexOf('\n', position - 1) + 1, position));

const isOneLine = (text, block) => !text.slice(block.pos, block.end).includes('\n');

// JSDoc 블록의 글을 줄 목록으로 꺼낸다.
const bodyLines = raw => {
  const lines = raw
    .replace(/^\/\*\*+/, '')
    .replace(/\*+\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*?[ \t]?/, '').trimEnd());
  while (lines.length && lines[0] === '') {
    lines.shift();
  }
  while (lines.length && lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
};

const asLineComment = (raw, indent) => bodyLines(raw).map(line => `${indent}// ${line}`.trimEnd()).join('\n');

const asBlockComment = (raw, indent) => [`${indent}/**`, ...bodyLines(raw).map(line => `${indent} * ${line}`.trimEnd()), `${indent} */`].join('\n');

const indentOf = (text, position) => text.slice(text.lastIndexOf('\n', position - 1) + 1, position);

// 한 파일을 점검해 위반 목록과 고친 글을 돌려준다.
const inspect = file => {
  const text = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const exportedNames = exportedNamesOf(sourceFile);
  const problems = [];
  const edits = [];
  for (const block of collectBlocks(sourceFile)) {
    const raw = text.slice(block.pos, block.end);
    const where = `${path.relative(ROOT, file)}:${lineOf(text, block.pos)}`;
    if (isFileHeader(text, block.pos) || TOOL_TAGS.test(raw) || !startsLine(text, block.pos)) {
      continue;
    }
    const indent = indentOf(text, block.pos);
    if (!isDocumented(block.node, exportedNames)) {
      problems.push(`${where} 문서화 대상이 아닌 곳의 JSDoc이다. // 주석으로 쓴다`);
      edits.push({ ...block, replacement: asLineComment(raw, indent) });
    } else if (isOneLine(text, block)) {
      problems.push(`${where} 한 줄 JSDoc이다. 세 줄로 쓴다`);
      edits.push({ ...block, replacement: asBlockComment(raw, indent) });
    }
  }
  return { text, problems, edits };
};

const apply = (text, edits) => [...edits].reverse().reduce((result, edit) => result.slice(0, edit.pos - indentOf(text, edit.pos).length) + edit.replacement + result.slice(edit.end), text);

const main = () => {
  const fix = process.argv.includes('--fix');
  const targets = [...walk(ROOT)];
  const remaining = [];
  let fixed = 0;
  for (const file of targets) {
    const { text, problems, edits } = inspect(file);
    if (problems.length === 0) {
      continue;
    }
    if (fix) {
      fs.writeFileSync(file, apply(text, edits));
      fixed += edits.length;
    } else {
      remaining.push(...problems);
    }
  }
  if (fix) {
    console.log(`JSDoc 표기: ${fixed}건 고침`);
    return;
  }
  console.log(remaining.length === 0 ? 'JSDoc 점검: 위반 0건' : `JSDoc 점검: 위반 ${remaining.length}건\n${remaining.join('\n')}`);
  process.exitCode = remaining.length === 0 ? 0 : 1;
};

main();
