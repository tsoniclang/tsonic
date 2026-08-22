import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";

import {
  createSourceProgramNavigation,
} from "../../packages/target-api/dist/public/source.js";
import {
  createSourceDeclarationReferenceIndex,
} from "../../packages/target-api/dist/source-navigation/reference-index.js";
import {
  checkedSource,
  namedDeclaration,
  namedVariable,
  projectSourceFile,
  requiredNode,
} from "../fixtures/source-navigation.mjs";

test("source reference index preserves exact source selections in both directions", async () => {
  const checked = await checkedSource("source-reference-index-matrix", {
    "src/index.ts": [
      'import { execute } from "./forward.js";',
      'import * as api from "./api.js";',
      'import type { Result as Output } from "./api.js";',
      'import snapshot from "./default.js";',
      "const run = (value: number): number => value - 1;",
      "const direct = execute(1); const local = run(2);",
      "const namespaced = api.run(3);",
      "const output: Output = { value: direct };",
      "const qualified: api.Result = output;",
      "const defaulted = snapshot;",
      "declare const bag: api.Bag;",
      'const selected = bag["item"];',
      "const value = namespaced;",
      "const shorthand = { value };",
      "function shadow(run: (value: number) => number): number {",
      "  return run(selected);",
      "}",
      "void local; void qualified; void defaulted; void shorthand; void shadow;",
      "",
    ].join("\n"),
    "src/api.ts": [
      "export interface Result { value: number; }",
      "export interface Bag { [key: string]: number; }",
      "export const run = (value: number): number => value + 1;",
      "",
    ].join("\n"),
    "src/forward.ts": [
      'export { run as execute } from "./api.js";',
      "",
    ].join("\n"),
    "src/default.ts": [
      "let value = 1;",
      "export default value;",
      "value = 2;",
      "",
    ].join("\n"),
  });
  const { ast } = checked;
  const indexFile = projectSourceFile(checked, "src/index.ts");
  const apiFile = projectSourceFile(checked, "src/api.ts");
  const forwardFile = projectSourceFile(checked, "src/forward.ts");
  const defaultFile = projectSourceFile(checked, "src/default.ts");
  const navigation = createSourceProgramNavigation(checked);
  const apiRun = namedVariable(ast, apiFile, "run");
  const localRun = namedVariable(ast, indexFile, "run");
  const result = namedDeclaration(ast, apiFile, "Result");
  const bag = namedDeclaration(ast, apiFile, "Bag");
  const indexSignature = requiredNode(ast, bag, (node) =>
    ast.is.IsIndexSignatureDeclaration(node));
  const shadowParameter = requiredNode(ast, indexFile, (node) =>
    ast.is.IsParameterDeclaration(node) &&
    ast.text(ast.name(node)) === "run");
  const calls = allNodes(ast, indexFile, (node) => ast.is.IsCallExpression(node));
  const directCall = requiredCall(ast, calls, "execute");
  const localCall = requiredCall(
    ast,
    calls,
    "run",
    (call) => !isWithinNamedFunction(ast, call, "shadow"),
  );
  const shadowCall = requiredCall(
    ast,
    calls,
    "run",
    (call) => isWithinNamedFunction(ast, call, "shadow"),
  );
  const namespaceCall = calls.find((call) => {
    const callee = ast.as.AsCallExpression(call)?.Expression;
    return callee !== undefined &&
      ast.is.IsPropertyAccessExpression(callee) &&
      ast.text(ast.name(callee)) === "run";
  });
  const elementAccess = requiredNode(ast, indexFile, (node) =>
    ast.is.IsElementAccessExpression(node));
  const outputType = requiredNode(ast, indexFile, (node) => {
    if (!ast.is.IsTypeReferenceNode(node)) return false;
    const typeName = ast.as.AsTypeReferenceNode(node)?.TypeName;
    return typeName !== undefined && ast.is.IsIdentifier(typeName) &&
      ast.text(typeName) === "Output";
  });
  const qualifiedType = requiredNode(ast, indexFile, (node) =>
    ast.is.IsQualifiedName(node) &&
    ast.text(ast.as.AsQualifiedName(node)?.Right) === "Result");
  const shorthand = requiredNode(ast, indexFile, (node) =>
    ast.is.IsShorthandPropertyAssignment(node));
  const shorthandReference = ast.name(shorthand);
  const defaultExport = requiredNode(ast, defaultFile, (node) =>
    ast.is.IsExportAssignment(node));
  const defaultImportUse = requiredNode(ast, indexFile, (node) =>
    ast.is.IsIdentifier(node) && ast.text(node) === "snapshot" &&
    !ast.is.IsImportClause(ast.parent(node)));

  assert.notEqual(namespaceCall, undefined);
  assert.notEqual(shorthandReference, undefined);
  assert.equal(
    navigation.sourceReferenceFor(callCallee(ast, directCall))?.declaration === apiRun,
    true,
    "named import alias must select the exported declaration",
  );
  assert.equal(
    navigation.sourceReferenceFor(callCallee(ast, namespaceCall))?.declaration === apiRun,
    true,
    "namespace access must select the exported declaration",
  );
  assert.equal(
    navigation.sourceReferenceFor(callCallee(ast, localCall))?.declaration === localRun,
    true,
    "same-spelled local call must remain local",
  );
  assert.equal(
    navigation.sourceReferenceFor(callCallee(ast, shadowCall))?.declaration === shadowParameter,
    true,
    "shadowed parameter call must remain bound to its parameter",
  );
  assert.equal(
    navigation.sourceReferenceFor(outputType)?.declaration === result,
    true,
    "imported type alias must select the exported type declaration",
  );
  assert.equal(
    navigation.sourceReferenceFor(qualifiedType)?.declaration === result,
    true,
    "qualified type must select the exported type declaration",
  );
  assert.equal(
    navigation.sourceReferenceFor(shorthandReference)?.declaration ===
      namedVariable(ast, indexFile, "value"),
    true,
    "shorthand value must select the value declaration",
  );
  assert.equal(
    navigation.sourceReferenceFor(defaultImportUse)?.declaration === defaultExport,
    true,
    "default import must retain the exported snapshot declaration",
  );
  assert.equal(
    navigation.referenceFor(defaultImportUse)?.declaration === defaultExport,
    true,
    "project-reference projection must retain the default export declaration",
  );

  const elementSelection = navigation.sourceReferenceFor(elementAccess);
  assert.equal(
    elementSelection?.declaration === indexSignature,
    true,
    "element access must retain its exact selected index declaration",
  );
  assert.equal(elementSelection?.symbol === undefined, true);
  assert.equal(elementSelection?.project, true);

  const runReferences = navigation.referencesToDeclaration(apiRun);
  assert.equal(Object.isFrozen(runReferences), true);
  assert.equal(new Set(runReferences).size, runReferences.length);
  assert.equal(
    runReferences.every((reference) =>
      navigation.sourceReferenceFor(reference)?.declaration === apiRun),
    true,
  );
  assert.equal(
    runReferences.some((reference) => ast.getSourceFile(reference) === forwardFile),
    true,
  );
  assert.equal(
    navigation.referencesToDeclaration(indexSignature).includes(elementAccess),
    true,
  );
  assert.equal(
    navigation.referencesToDeclaration(defaultExport).includes(defaultImportUse),
    true,
  );
  assert.throws(() => runReferences.push(directCall), TypeError);
  assert.equal(Object.isFrozen(elementSelection), true);
  assert.equal(Object.isFrozen(navigation.referenceIndexStatistics), true);
  assert.equal(navigation.referenceIndexStatistics.constructionPasses, 1);
  assert.equal(
    Object.hasOwn(navigation.referenceIndexStatistics, "identityStrings"),
    false,
  );
  const projectFiles = [indexFile, apiFile, forwardFile, defaultFile];
  const projectFileSet = new Set(projectFiles);
  assert.throws(
    () => createSourceDeclarationReferenceIndex(
      checked,
      projectFiles,
      (declaration) => projectFileSet.has(ast.getSourceFile(declaration)),
      sourceReferenceLimits({ moduleExportsExamined: 1 }),
    ),
    /exceeds the 1 module exports examined limit/u,
  );
});

test("source reference index rejects exact nodes from another checked program", async () => {
  const files = {
    "src/index.ts": [
      "export const run = (value: number): number => value + 1;",
      "export const result = run(1);",
      "",
    ].join("\n"),
  };
  const selected = await checkedSource("source-reference-index-selected", files);
  const foreign = await checkedSource("source-reference-index-foreign", files);
  const selectedFile = projectSourceFile(selected, "src/index.ts");
  const foreignFile = projectSourceFile(foreign, "src/index.ts");
  const navigation = createSourceProgramNavigation(selected);
  const selectedDeclaration = namedVariable(selected.ast, selectedFile, "run");
  const foreignDeclaration = namedVariable(foreign.ast, foreignFile, "run");
  const foreignCall = requiredNode(foreign.ast, foreignFile, (node) =>
    foreign.ast.is.IsCallExpression(node));

  assert.equal(selectedDeclaration !== foreignDeclaration, true);
  assert.equal(navigation.referencesToDeclaration(foreignDeclaration).length, 0);
  assert.equal(
    navigation.sourceReferenceFor(callCallee(foreign.ast, foreignCall)) === undefined,
    true,
  );
});

test("source reference index fails closed for a missing imported export", async () => {
  const checked = await checkedSource("source-reference-index-missing-export", {
    "src/index.ts": [
      'import { missing } from "./api.js";',
      "export const result = missing;",
      "",
    ].join("\n"),
    "src/api.ts": "export const available = 1;\n",
  });
  const { ast } = checked;
  const indexFile = projectSourceFile(checked, "src/index.ts");
  const missingUse = requiredNode(ast, indexFile, (node) =>
    ast.is.IsIdentifier(node) &&
    ast.text(node) === "missing" &&
    !ast.is.IsImportSpecifier(ast.parent(node)));

  assert.equal(
    checked.diagnostics.some((diagnostic) => diagnostic?.code === 2305),
    true,
    formatDiagnostics(checked.diagnostics),
  );
  const navigation = createSourceProgramNavigation(checked);
  assert.equal(navigation.sourceReferenceFor(missingUse), undefined);
});

test("source reference index construction is transactional and bounded", () => {
  const valid = fakeSourceReferenceProgram();
  const index = createSourceDeclarationReferenceIndex(
    valid.source,
    [valid.sourceFile],
    (declaration) => declaration === valid.declaration,
  );
  const reverse = index.referencesToDeclaration(valid.declaration);

  assert.equal(
    index.sourceReferenceFor(valid.reference)?.declaration === valid.declaration,
    true,
  );
  assert.equal(reverse.length, 1);
  assert.equal(reverse[0] === valid.reference, true);
  assert.equal(index.referencesForSymbol(valid.symbol) === reverse, true);
  assert.equal(Object.isFrozen(reverse), true);
  assert.equal(index.statistics.nodesVisited, 4);
  assert.equal(index.statistics.selectedReferences, 2);
  assert.equal(index.statistics.reverseEdges, 1);

  const duplicate = fakeSourceReferenceProgram({ duplicateReference: true });
  assert.throws(
    () => createSourceDeclarationReferenceIndex(
      duplicate.source,
      [duplicate.sourceFile],
      (declaration) => declaration === duplicate.declaration,
    ),
    /visited more than once/u,
  );
  assert.throws(
    () => createSourceDeclarationReferenceIndex(
      valid.source,
      [valid.sourceFile],
      (declaration) => declaration === valid.declaration,
      sourceReferenceLimits({ nodesVisited: 1 }),
    ),
    /exceeds the 1 visited nodes limit/u,
  );
  assert.throws(
    () => createSourceDeclarationReferenceIndex(
      valid.source,
      [valid.sourceFile],
      (declaration) => declaration === valid.declaration,
      sourceReferenceLimits({ reverseEdges: 0 }),
    ),
    /must be a positive safe integer/u,
  );
});

test("source reference index work scales linearly by deterministic counters", async () => {
  const small = await sourceReferenceScaleStatistics(8);
  const large = await sourceReferenceScaleStatistics(16);

  assert.equal(small.constructionPasses, 1);
  assert.equal(large.constructionPasses, 1);
  assert.equal(small.sourceFiles, 8);
  assert.equal(large.sourceFiles, 16);
  for (const key of [
    "nodesVisited",
    "referenceCandidates",
    "selectedReferences",
    "selectedDeclarations",
    "reverseEdges",
    "indexedSymbols",
  ]) {
    const ratio = large[key] / small[key];
    assert.equal(
      ratio >= 1.75 && ratio <= 2.25,
      true,
      `${key} scaled by ${ratio}, outside the linear envelope`,
    );
  }
});

function allNodes(ast, root, predicate) {
  const selected = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (predicate(node)) selected.push(node);
    pending.push(...ast.children(node));
  }
  return selected;
}

function callCallee(ast, call) {
  const callee = ast.as.AsCallExpression(call)?.Expression;
  assert.notEqual(callee, undefined);
  return callee;
}

function requiredCall(ast, calls, name, predicate = () => true) {
  const matches = calls.filter((call) => {
    const callee = ast.as.AsCallExpression(call)?.Expression;
    return callee !== undefined && ast.is.IsIdentifier(callee) &&
      ast.text(callee) === name && predicate(call);
  });
  const selected = matches[0];
  assert.notEqual(selected, undefined);
  return selected;
}

function isWithinNamedFunction(ast, node, name) {
  let current = ast.parent(node);
  while (current !== undefined) {
    if (
      ast.is.IsFunctionDeclaration(current) &&
      ast.text(ast.name(current)) === name
    ) {
      return true;
    }
    current = ast.parent(current);
  }
  return false;
}

async function sourceReferenceScaleStatistics(fileCount) {
  const files = Object.fromEntries(Array.from(
    { length: fileCount - 1 },
    (_, offset) => {
      const index = offset + 1;
      return [
        `src/module-${index}.ts`,
        [
          `export function transform${index}(value: number): number {`,
          `  const copy${index} = value;`,
          `  return copy${index} + value;`,
          "}",
          "",
        ].join("\n"),
      ];
    },
  ));
  files["src/index.ts"] = [
    ...Array.from(
      { length: fileCount - 1 },
      (_, index) => `import "./module-${index + 1}.js";`,
    ),
    [
      "export function transform0(value: number): number {",
      "  const copy0 = value;",
      "  return copy0 + value;",
      "}",
      "",
    ].join("\n"),
  ].join("\n");
  const checked = await checkedSource(`source-reference-scale-${fileCount}`, files);
  return createSourceProgramNavigation(checked).referenceIndexStatistics;
}

function sourceReferenceLimits(overrides = {}) {
  return {
    sourceFiles: 10_000,
    nodesVisited: 10_000,
    referenceCandidates: 10_000,
    selectedReferences: 10_000,
    selectedDeclarations: 10_000,
    reverseEdges: 10_000,
    indexedSymbols: 10_000,
    moduleExportsExamined: 10_000,
    ...overrides,
  };
}

function fakeSourceReferenceProgram(options = {}) {
  const sourceFile = { kind: "source-file", IsDeclarationFile: false };
  const declaration = { kind: "variable-declaration", parent: sourceFile, sourceFile };
  const declarationName = {
    kind: "identifier",
    parent: declaration,
    sourceFile,
  };
  const reference = { kind: "identifier", parent: sourceFile, sourceFile };
  const symbol = {};
  declaration.name = declarationName;
  declaration.children = [declarationName];
  sourceFile.children = options.duplicateReference === true
    ? [declaration, reference, reference]
    : [declaration, reference];
  const is = new Proxy({}, {
    get: (_target, property) => (node) =>
      property === "IsIdentifier" && node?.kind === "identifier",
  });
  const ast = {
    is,
    as: {},
    children: (node) => node?.children ?? [],
    parent: (node) => node?.parent,
    name: (node) => node?.name,
    getSourceFile: (node) => node?.kind === "source-file" ? node : node?.sourceFile,
  };
  const checker = {
    getSymbolAtLocation: (node) =>
      node === declarationName || node === reference ? symbol : undefined,
    getResolvedSymbol: (node) =>
      node === declarationName || node === reference ? symbol : undefined,
    getSymbolDeclarations: (candidate) =>
      candidate === symbol ? [declaration] : [],
    getPrimarySymbolDeclaration: (candidate) =>
      candidate === symbol ? declaration : undefined,
    getAliasedSymbol: () => undefined,
  };
  return {
    sourceFile,
    declaration,
    reference,
    symbol,
    source: {
      ast,
      getSourceFileQueries: () => ({ checker, typeShape: {} }),
    },
  };
}
