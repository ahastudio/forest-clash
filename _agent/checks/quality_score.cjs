#!/usr/bin/env node
/**
 * TypeScript 코드의 설계와 품질을 0~100점으로 계산한다.
 * 사용: node _agent/checks/quality_score.cjs <소스 폴더> [--min 점수] [--verbose] [--json]
 * 테스트 파일(*.test.ts)과 testing/ 폴더는 점수에서 뺀다. 종료 코드는 점수가 --min보다 낮으면 1이다.
 */
const fs = require('fs');
const path = require('path');

// 프로젝트에 설치된 TypeScript를 불러온다. 이 도구는 TypeScript 5.x의 구문 트리 API를 쓴다(7은 쓰지 않는다).
function loadTypeScript() {
  const candidate = require(require.resolve('typescript', { paths: [process.cwd()] }));
  if (!candidate.ScriptTarget) {
    throw new Error('TypeScript 5.x가 필요하다: pnpm add -D typescript@^5.9.3 (7은 쓰지 않는다)');
  }
  return candidate;
}

const ts = loadTypeScript();

const MAX_STATEMENTS = 5;
const MAX_PARAMS = 3;
const MAX_FILE_LINES = 300;
const MAX_CONDITION_COLUMNS = 80;
const MAX_LOGICAL_OPERATORS = 2;
const PRIMITIVES = new Set(['number', 'string', 'boolean']);
const COORDINATE_NAMES = new Set(['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 'from', 'to', 'min', 'max', 't', 'u', 'angle', 'distance', 'width', 'height']);
const LOOPS = [ts.isForStatement, ts.isForOfStatement, ts.isForInStatement, ts.isWhileStatement, ts.isDoStatement];

// 명령줄 인자를 읽는다.
function parseArgs(argv) {
  const min = argv.indexOf('--min');
  return {
    root: argv.find(arg => !arg.startsWith('--') && arg !== argv[min + 1]) ?? 'src',
    min: min >= 0 ? Number(argv[min + 1]) : 0,
    verbose: argv.includes('--verbose'),
    json: argv.includes('--json'),
  };
}

// 폴더 아래의 .ts 파일을 모두 모은다.
function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(full);
    }
    return full.endsWith('.ts') ? [full] : [];
  });
}

const isTestPath = file => file.endsWith('.test.ts') || file.includes(`${path.sep}testing${path.sep}`);

// 파일을 읽어 구문 트리와 줄 수를 갖춘 기록으로 만든다.
function loadFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
  return { file, text, source, lines: text.split('\n').length - 1, isTest: isTestPath(file) };
}

// 구문 트리를 깊이 우선으로 돌며 방문 함수를 부른다.
function visitAll(node, visit) {
  visit(node);
  ts.forEachChild(node, child => visitAll(child, visit));
}

const isFunctionLike = node =>
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isConstructorDeclaration(node);

const locationOf = (record, node) => {
  const line = record.source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  return `${record.file}:${line}`;
};

// 본문이 있는 함수와 그 위치를 모은다.
function functionsOf(records) {
  const found = [];
  for (const record of records) {
    visitAll(record.source, node => {
      if (isFunctionLike(node) && node.body) {
        found.push({ node, record, where: locationOf(record, node) });
      }
    });
  }
  return found;
}

// 블록 안의 문장 수. 제어문의 머리는 1개로 세고 안쪽 문장은 따로 센다.
function countStatements(block) {
  let count = 0;
  const visit = statement => {
    if (ts.isBlock(statement)) {
      statement.statements.forEach(visit);
      return;
    }
    count++;
    descend(statement, visit, () => count++);
  };
  block.statements.forEach(visit);
  return count;
}

// 문장 안쪽의 문장들을 방문한다.
function descend(statement, visit, countClause) {
  if (ts.isIfStatement(statement)) {
    visit(statement.thenStatement);
    if (statement.elseStatement) {
      visit(statement.elseStatement);
    }
  } else if (LOOPS.some(isLoop => isLoop(statement)) || ts.isLabeledStatement(statement)) {
    visit(statement.statement);
  } else if (ts.isTryStatement(statement)) {
    visit(statement.tryBlock);
    if (statement.catchClause) {
      countClause();
      visit(statement.catchClause.block);
    }
    if (statement.finallyBlock) {
      visit(statement.finallyBlock);
    }
  } else if (ts.isSwitchStatement(statement)) {
    statement.caseBlock.clauses.forEach(clause => {
      countClause();
      clause.statements.forEach(visit);
    });
  }
}

const primitiveOf = param => (param.type && PRIMITIVES.has(param.type.getText()) ? param.type.getText() : null);
const isCoordinatePair = (a, b) => COORDINATE_NAMES.has(a.name.getText()) && COORDINATE_NAMES.has(b.name.getText());

// 호출하는 자리에서 뜻이 드러나지 않는 매개변수 목록인가: 불리언 플래그, 같은 타입의 이웃한 숫자·문자열.
function hasAmbiguousParams(fn) {
  const params = fn.parameters;
  if (params.some(param => primitiveOf(param) === 'boolean')) {
    return true;
  }
  return params.some((param, i) => {
    const kind = primitiveOf(param);
    return i > 0 && kind !== null && kind === primitiveOf(params[i - 1]) && !isCoordinatePair(param, params[i - 1]);
  });
}

// 조건식이 한 줄에 들어가는 짧은 식인가.
function conditionProblem(record, condition) {
  const { source } = record;
  const start = source.getLineAndCharacterOfPosition(condition.getStart()).line;
  const end = source.getLineAndCharacterOfPosition(condition.getEnd()).line;
  const operators = [];
  visitAll(condition, node => {
    if (ts.isBinaryExpression(node)) {
      operators.push(node.operatorToken.kind);
    }
  });
  const logical = operators.filter(kind => [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(kind));
  const mixed = new Set(logical).size > 1;
  const tooMany = logical.length > MAX_LOGICAL_OPERATORS;
  return start !== end || mixed || tooMany || condition.getText().length > MAX_CONDITION_COLUMNS;
}

const ratioResult = (total, violations) => ({
  total,
  violations,
  score: total === 0 ? 100 : (100 * (total - violations.length)) / total,
});
const penaltyResult = (total, violations, perViolation) => ({
  total,
  violations,
  score: Math.max(0, 100 - perViolation * violations.length),
});

function measureStatements(records) {
  const targets = functionsOf(records).filter(fn => ts.isBlock(fn.node.body));
  const violations = targets
    .map(fn => ({ fn, count: countStatements(fn.node.body) }))
    .filter(item => item.count > MAX_STATEMENTS)
    .map(item => `${item.count}문장 ${item.fn.where}`);
  return ratioResult(targets.length, violations);
}

function measureParamCount(records) {
  const targets = functionsOf(records);
  const violations = targets.filter(fn => fn.node.parameters.length > MAX_PARAMS).map(fn => `${fn.node.parameters.length}개 ${fn.where}`);
  return ratioResult(targets.length, violations);
}

function measureReadableParams(records) {
  const targets = functionsOf(records).filter(fn => fn.node.parameters.length > 0);
  const violations = targets.filter(fn => hasAmbiguousParams(fn.node)).map(fn => fn.where);
  return ratioResult(targets.length, violations);
}

// 조건문이나 반복문의 위치와 종류를 모은다.
function collect(records, pick) {
  const found = [];
  for (const record of records) {
    visitAll(record.source, node => {
      const item = pick(node);
      if (item) {
        found.push({ record, node, item });
      }
    });
  }
  return found;
}

function measureElseIf(records) {
  const ifs = collect(records, node => (ts.isIfStatement(node) ? node : null));
  const violations = ifs.filter(({ node }) => node.elseStatement && ts.isIfStatement(node.elseStatement)).map(({ record, node }) => locationOf(record, node));
  return penaltyResult(ifs.length, violations, 20);
}

function measureBraces(records) {
  const bodies = collect(records, node => {
    if (ts.isIfStatement(node)) {
      return [node.thenStatement, node.elseStatement && !ts.isIfStatement(node.elseStatement) ? node.elseStatement : null];
    }
    return LOOPS.some(isLoop => isLoop(node)) ? [node.statement] : null;
  });
  const flat = bodies.flatMap(({ record, item }) => item.filter(Boolean).map(body => ({ record, body })));
  const violations = flat.filter(({ body }) => !ts.isBlock(body)).map(({ record, body }) => locationOf(record, body));
  return ratioResult(flat.length, violations);
}

function measureConditions(records) {
  const conditions = collect(records, node => {
    if (ts.isIfStatement(node) || ts.isWhileStatement(node)) {
      return node.expression;
    }
    return ts.isConditionalExpression(node) ? node.condition : null;
  });
  const violations = conditions.filter(({ record, item }) => conditionProblem(record, item)).map(({ record, item }) => locationOf(record, item));
  return ratioResult(conditions.length, violations);
}

function measureFileSize(records) {
  const violations = records.filter(record => record.lines > MAX_FILE_LINES).map(record => `${record.lines}줄 ${record.file}`);
  return ratioResult(records.length, violations);
}

// 값으로 가져오는 상대 경로 import의 대상 파일을 찾는다(타입만 가져오는 import는 제외한다).
function importTargets(record, byPath) {
  const targets = [];
  for (const statement of record.source.statements) {
    const clause = statement.importClause;
    const specifier = statement.moduleSpecifier;
    const isValue = ts.isImportDeclaration(statement) ? clause && !clause.isTypeOnly : ts.isExportDeclaration(statement) && !statement.isTypeOnly && specifier;
    if (isValue && specifier.text.startsWith('.')) {
      const base = path.resolve(path.dirname(record.file), specifier.text);
      targets.push(...[`${base}.ts`, path.join(base, 'index.ts')].filter(candidate => byPath.has(candidate)));
    }
  }
  return targets;
}

// 서로를 부르는 파일 묶음(강연결 요소)을 찾는다.
function findCycles(graph) {
  const index = new Map();
  const low = new Map();
  const stack = [];
  const cycles = [];
  const connect = node => {
    index.set(node, index.size);
    low.set(node, index.get(node));
    stack.push(node);
    for (const next of graph.get(node)) {
      if (!index.has(next)) {
        connect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (stack.includes(next)) {
        low.set(node, Math.min(low.get(node), index.get(next)));
      }
    }
    if (low.get(node) === index.get(node)) {
      const group = stack.splice(stack.indexOf(node));
      if (group.length > 1) {
        cycles.push(group.join(' ↔ '));
      }
    }
  };
  for (const node of graph.keys()) {
    if (!index.has(node)) {
      connect(node);
    }
  }
  return cycles;
}

function measureCycles(records) {
  const byPath = new Map(records.map(record => [record.file, record]));
  const graph = new Map(records.map(record => [record.file, importTargets(record, byPath)]));
  return penaltyResult(records.length, findCycles(graph), 25);
}

const isExported = node => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;

// 파일이 밖으로 내보내는 이름들과 그 선언.
function exportsOf(record) {
  return record.source.statements.filter(isExported).flatMap(statement => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map(declaration => ({ name: declaration.name.getText(), statement, declaration }));
    }
    return statement.name ? [{ name: statement.name.getText(), statement, declaration: null }] : [];
  });
}

function measureExportsUsed(records, everyRecord) {
  const all = records.flatMap(record => exportsOf(record).map(item => ({ record, ...item })));
  const unused = all.filter(({ record, name }) => !everyRecord.some(other => other.file !== record.file && new RegExp(`\\b${name}\\b`).test(other.text)));
  return ratioResult(all.length, unused.map(({ record, name }) => `${record.file} ${name}`));
}

const isFunctionValue = declaration => declaration && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer));

function measureDocs(records) {
  const functions = records.flatMap(record => exportsOf(record).map(item => ({ record, ...item }))).filter(({ statement, declaration }) => ts.isFunctionDeclaration(statement) || isFunctionValue(declaration));
  const missing = functions.filter(({ statement }) => !(statement.jsDoc && statement.jsDoc.length > 0));
  return ratioResult(functions.length, missing.map(({ record, name }) => `${record.file} ${name}`));
}

function measureDuplicates(records) {
  const groups = new Map();
  for (const fn of functionsOf(records).filter(item => ts.isBlock(item.node.body) && item.node.body.statements.length >= 3)) {
    const key = fn.node.body.getText().replace(/\s+/g, ' ');
    groups.set(key, [...(groups.get(key) ?? []), fn.where]);
  }
  const duplicated = [...groups.values()].filter(group => group.length > 1).map(group => group.join(' = '));
  return penaltyResult(groups.size, duplicated, 25);
}

const ITEMS = [
  ['함수 길이(문장 5개 이하)', 15, measureStatements],
  ['인자 개수(3개 이하)', 5, measureParamCount],
  ['읽히는 인자(플래그·이웃한 같은 타입 없음)', 10, measureReadableParams],
  ['else if 없음', 5, measureElseIf],
  ['제어문 중괄호', 5, measureBraces],
  ['조건식(한 줄, 짧게)', 10, measureConditions],
  ['파일 크기(300줄 이하)', 10, measureFileSize],
  ['순환 의존 없음', 10, measureCycles],
  ['밖에서 쓰이는 export', 10, measureExportsUsed],
  ['export 함수의 JSDoc', 10, measureDocs],
  ['중복 함수 본문 없음', 10, measureDuplicates],
];

// 항목마다 점수를 계산하고 가중 합을 낸다.
function scoreAll(records, everyRecord) {
  const items = ITEMS.map(([label, weight, measure]) => ({ label, weight, ...measure(records, everyRecord) }));
  const total = items.reduce((sum, item) => sum + (item.weight * item.score) / 100, 0);
  return { items, total };
}

function printReport({ items, total }, verbose) {
  for (const item of items) {
    const points = ((item.weight * item.score) / 100).toFixed(1);
    console.log(`${item.label.padEnd(36)} ${item.score.toFixed(1).padStart(6)}점 × ${String(item.weight).padStart(2)}% = ${points.padStart(5)}  (대상 ${item.total}, 위반 ${item.violations.length})`);
    for (const violation of verbose ? item.violations : item.violations.slice(0, 3)) {
      console.log(`    - ${violation}`);
    }
  }
  console.log(`\n총점 ${total.toFixed(1)} / 100`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const everyRecord = listFiles(options.root).map(loadFile);
  const result = scoreAll(everyRecord.filter(record => !record.isTest), everyRecord);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, options.verbose);
  }
  process.exitCode = result.total < options.min ? 1 : 0;
}

main();
