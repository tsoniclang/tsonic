import { createHash } from "node:crypto";

/** @type {import("./contracts.d.mts").CheckCoverage} */
export function checkCoverage(deps, productFiles, rawV8) {
  const canonicalFiles = productFiles.map(path => { try { return deps.canonical(path); } catch { return null; } });
  if (new Set(canonicalFiles.filter(path => path !== null)).size !== canonicalFiles.filter(path => path !== null).length)
    throw new Error("Coverage requires a distinct complete product source inventory.");
  const findings = [];
  const reports = [];
  for (const [index, path] of productFiles.entries()) {
    const canonical = canonicalFiles[index] ?? path;
    let text;
    try { text = deps.readText(canonical); } catch { text = null; }
    if (canonicalFiles[index] === null || text === null || text.trim().length === 0) {
      findings.push(Object.freeze({ code: "coverage-empty", path: canonical, line: 1, column: 1 }));
      reports.push(Object.freeze({ path: canonical, sourceHash: "", status: "missing", lines: 0, branches: 0, functions: 0 }));
      continue;
    }
    const hash = createHash("sha256").update(text).digest("hex");
    const source = deps.parse(new Map([["source.mjs", text]]));
    const ast = source.ast;
    const file = source.sourceFiles.find(candidate => candidate !== undefined && ast.getFileName(candidate) === "/host-gate/source.mjs");
    if (file === undefined) throw new Error("Coverage requires the actual parsed original source.");
    const executable = ast.statements(file).some(node => {
      if (ast.is.IsInterfaceDeclaration(node) || ast.is.IsTypeAliasDeclaration(node) || ast.hasModifierKind(node, "ambient")) return false;
      if (ast.is.IsImportDeclaration(node)) return !ast.isTypeOnlyImportDeclaration(node);
      if (ast.is.IsExportDeclaration(node)) return !ast.as.AsExportDeclaration(node).IsTypeOnly;
      return !ast.is.IsFunctionDeclaration(node) || ast.body(node) !== undefined;
    });
    if (!executable) {
      reports.push(Object.freeze({ path: canonical, sourceHash: hash, status: "not-applicable", lines: null, branches: null, functions: null }));
      continue;
    }
    const add = (code, offset = 0) => {
      const before = text.slice(0, offset).split("\n");
      const finding = { code, path: canonical, line: before.length, column: before[before.length - 1].length + 1 };
      if (!findings.some(previous => previous.code === code && previous.path === canonical && previous.line === finding.line && previous.column === finding.column))
        findings.push(Object.freeze(finding));
    };
    const functions = [];
    const statements = [];
    const visit = node => {
      if (["KindVariableStatement", "KindExpressionStatement", "KindReturnStatement", "KindThrowStatement", "KindIfStatement",
        "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindWhileStatement", "KindDoStatement", "KindSwitchStatement",
        "KindBreakStatement", "KindContinueStatement", "KindTryStatement", "KindDebuggerStatement"].includes(ast.kindName(node))) {
        const range = ast.authoredRange(node);
        if (range.kind === "authored") statements.push(range);
      }
      if ((ast.is.IsFunctionDeclaration(node) || ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) ||
        ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node)) && ast.body(node) !== undefined) {
        const range = ast.authoredRange(node);
        if (range.kind === "authored") functions.push(range);
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    const projected = rawV8.flatMap(capture => capture.result.flatMap(script => {
      const identity = capture.sources.find(entry => entry.scriptId === script.scriptId && entry.url === script.url);
      if (identity === undefined) return [];
      const projection = deps.project(script.url, identity.text);
      if (projection === null || deps.canonical(projection.path) !== canonical) return [];
      if (projection.text !== text || createHash("sha256").update(projection.text).digest("hex") !== hash) return [];
      return [Object.freeze({ script, projection })];
    }));
    const valid = projected.length > 0 && projected.every(({ script, projection }) => script.functions.length > 0 &&
      script.functions.every(fn => fn.ranges.length > 0 && (fn.isBlockCoverage || fn.ranges[0].count === 0) && fn.ranges.every(range =>
        Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) && Number.isSafeInteger(range.count) &&
        range.count >= 0 && range.startOffset >= 0 && range.endOffset > range.startOffset && range.endOffset <= projection.text.length)));
    if (!valid || functions.some(fn => !projected.some(({ script }) => script.functions.some(actual => actual.ranges[0].endOffset === fn.end)))) {
      add("coverage-empty");
      reports.push(Object.freeze({ path: canonical, sourceHash: hash, status: "missing", lines: 0, branches: 0, functions: 0 }));
      continue;
    }
    const executedAt = offset => projected.some(({ script }) => {
      const containing = script.functions.flatMap(fn => fn.ranges).filter(range => range.startOffset <= offset && range.endOffset > offset)
        .sort((left, right) => left.endOffset - left.startOffset - (right.endOffset - right.startOffset));
      return containing.length > 0 && containing[0].count > 0;
    });
    const branches = new Map();
    const endpoints = new Set();
    for (const { script } of projected) for (const fn of script.functions) {
      for (const range of fn.ranges) { endpoints.add(range.startOffset); endpoints.add(range.endOffset); }
      for (const range of fn.ranges.slice(1)) branches.set(`${range.startOffset}:${range.endOffset}`, range);
    }
    let missingBranches = 0;
    for (const range of branches.values()) if ([...endpoints].some(offset => offset >= range.startOffset && offset < range.endOffset && !executedAt(offset))) {
      missingBranches += 1;
      add("coverage-branch", range.startOffset);
    }
    const lines = new Set();
    const missingLines = new Set();
    for (const statement of statements) {
      const line = text.slice(0, statement.start).split("\n").length;
      lines.add(line);
      if (!executedAt(statement.start)) { missingLines.add(line); add("coverage-line", statement.start); }
    }
    let missingFunctions = 0;
    for (const fn of functions) {
      const entries = projected.flatMap(({ script }) => script.functions.filter(actual => actual.ranges[0].endOffset === fn.end));
      if (!entries.some(entry => entry.ranges[0].count > 0)) { missingFunctions += 1; add("coverage-function", fn.start); }
    }
    const own = findings.filter(finding => finding.path === canonical);
    reports.push(Object.freeze({ path: canonical, sourceHash: hash, status: own.length === 0 ? "covered" : "uncovered",
      lines: lines.size === 0 ? 100 : 100 * (lines.size - missingLines.size) / lines.size,
      branches: branches.size === 0 ? 100 : 100 * (branches.size - missingBranches) / branches.size,
      functions: functions.length === 0 ? 100 : 100 * (functions.length - missingFunctions) / functions.length }));
  }
  if (productFiles.length === 0) findings.push(Object.freeze({ code: "coverage-empty", path: "", line: 1, column: 1 }));
  return Object.freeze({ status: findings.length === 0 ? "passed" : "failed", files: Object.freeze(reports),
    findings: Object.freeze(findings), rawV8 });
}
