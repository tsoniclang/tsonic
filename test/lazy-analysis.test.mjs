import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  compileTargetFromSemanticSession,
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  parseTsonicProjectConfig,
} from "../packages/host/dist/index.js";

const repoRoot = process.cwd();
const tempRoot = resolve(repoRoot, ".temp/test-runs/lazy-analysis", `${Date.now()}-${process.pid}`);

test("lazy generic source analysis returns structural use records without source-family conclusions", async () => {
  const projectDirectory = resolve(tempRoot, "structural-array-uses");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "export async function analyze(xs: number[], rhs: number[], obj: { xs: number[] }, sink: (value: number[]) => void, promise: Promise<number[]>): Promise<number[]> {",
      "  const [first] = xs;",
      "  let assigned = 0;",
      "  [assigned] = rhs;",
      "  const clone = [...xs];",
      "  const objectClone = { ...obj };",
      "  const awaited = await promise;",
      "  for (const key in obj) {",
      "    void key;",
      "  }",
      "  const elementValue = obj[\"xs\"];",
      "  xs[0] = 1;",
      "  xs.length = 0;",
      "  const captured = () => xs.length;",
      "  for (const value of xs) {",
      "    sink(xs);",
      "  }",
      "  captured();",
      "  void first;",
      "  void assigned;",
      "  void clone;",
      "  void objectClone;",
      "  void awaited;",
      "  void elementValue;",
      "  return xs;",
      "}",
      "export function* generate(yielded: number[]) {",
      "  yield yielded;",
      "}",
      "",
    ].join("\n"),
  });

  const project = parseTsonicProjectConfig(projectConfig);
  const session = createTsonicSemanticSession({
    programOptions: createProgramOptionsForProject({
      project,
      projectFilePath: resolve(projectDirectory, "tsonic.json"),
    }).programOptions,
    project,
    target: project.targets[0],
    targetPack: createFakeTargetPack(),
    selectedSurfaces: [],
  });
  const sourceFile = session.sourceFiles.find((candidate) => session.ast.getFileName(candidate).endsWith("src/index.ts"));
  assert.notEqual(sourceFile, undefined);
  const xsName = findParameterName(session.ast, sourceFile, "xs");
  assert.notEqual(xsName, undefined);
  const xsSymbol = session.checker.getSymbolAtLocation(xsName, { sourceFile });
  const rhsName = findParameterName(session.ast, sourceFile, "rhs");
  assert.notEqual(rhsName, undefined);
  const rhsSymbol = session.checker.getSymbolAtLocation(rhsName, { sourceFile });
  const objName = findParameterName(session.ast, sourceFile, "obj");
  assert.notEqual(objName, undefined);
  const objSymbol = session.checker.getSymbolAtLocation(objName, { sourceFile });
  const sinkName = findParameterName(session.ast, sourceFile, "sink");
  assert.notEqual(sinkName, undefined);
  const sinkSymbol = session.checker.getSymbolAtLocation(sinkName, { sourceFile });
  const promiseName = findParameterName(session.ast, sourceFile, "promise");
  assert.notEqual(promiseName, undefined);
  const promiseSymbol = session.checker.getSymbolAtLocation(promiseName, { sourceFile });
  const yieldedName = findParameterName(session.ast, sourceFile, "yielded");
  assert.notEqual(yieldedName, undefined);
  const yieldedSymbol = session.checker.getSymbolAtLocation(yieldedName, { sourceFile });
  const analysisInput = createFakeBackendInput(session, project);
  const uses = analysisInput.analysis.lazy.usesOf(xsSymbol);
  const sinkCallsites = analysisInput.analysis.lazy.callsitesOf(sinkSymbol);
  const rhsUses = analysisInput.analysis.lazy.usesOf(rhsSymbol);
  const objUses = analysisInput.analysis.lazy.usesOf(objSymbol);
  const promiseUses = analysisInput.analysis.lazy.usesOf(promiseSymbol);
  const yieldedUses = analysisInput.analysis.lazy.usesOf(yieldedSymbol);
  const awaits = analysisInput.analysis.lazy.awaitsOf(promiseSymbol);
  const forInSites = analysisInput.analysis.lazy.forInSitesOf(objSymbol);
  const bindingUses = analysisInput.analysis.lazy.bindingUsesOf(xsSymbol);

  assert.equal(analysisInput.analysis.lazy.elementWritesOn(xsSymbol).length, 1);
  assert.strictEqual(analysisInput.analysis.lazy.readsOf(xsSymbol), analysisInput.analysis.lazy.readsOf(xsSymbol));
  assert.strictEqual(analysisInput.analysis.lazy.writesOf(xsSymbol), analysisInput.analysis.lazy.writesOf(xsSymbol));
  assert.strictEqual(analysisInput.analysis.lazy.mutationsOf(xsSymbol), analysisInput.analysis.lazy.mutationsOf(xsSymbol));
  assert.strictEqual(analysisInput.analysis.lazy.awaitsOf(promiseSymbol), awaits);
  assert.strictEqual(analysisInput.analysis.lazy.forInSitesOf(objSymbol), forInSites);
  assert.strictEqual(analysisInput.analysis.lazy.bindingUsesOf(xsSymbol), bindingUses);
  assert.deepEqual(
    analysisInput.analysis.lazy.propertyWritesOn(xsSymbol).map((use) => [use.propertyName, use.access]),
    [["length", "write"]],
  );
  assert.ok(uses.some((use) => use.operation === "iteration" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "destructure" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "spread" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "argument" && use.argumentIndex === 0));
  assert.ok(uses.some((use) => use.operation === "return"));
  assert.ok(rhsUses.some((use) => use.operation === "destructure" && use.operator === "="));
  assert.ok(objUses.some((use) => use.operation === "spread" && use.access === "read"));
  assert.ok(objUses.some((use) => use.operation === "element" && use.access === "read"));
  assert.equal(forInSites.length, 1);
  assert.equal(forInSites[0].iterationKind, "for-in");
  assert.ok(promiseUses.some((use) => use.operation === "await" && use.access === "read"));
  assert.equal(awaits.length, 1);
  assert.equal(awaits[0].operation, "await");
  assert.ok(yieldedUses.some((use) => use.operation === "yield" && use.access === "read"));
  assert.equal(bindingUses.length, 1);
  assert.equal(bindingUses[0].operation, "destructure");
  assert.equal(sinkCallsites.length, 1);
  assert.equal(session.ast.text(sinkCallsites[0].callee), "sink");
  assert.equal("argumentFlowOf" in analysisInput.analysis.lazy, false);
  assert.equal("returnFlowOf" in analysisInput.analysis.lazy, false);
  assert.equal("escapesOf" in analysisInput.analysis.lazy, false);
  assert.equal("capturesOf" in analysisInput.analysis.lazy, false);
  assert.equal("summaryOf" in analysisInput.analysis.lazy, false);
  assertNoPolicyConclusions([
    ...uses,
    ...rhsUses,
    ...objUses,
    ...promiseUses,
    ...yieldedUses,
    ...awaits,
    ...forInSites,
    ...bindingUses,
    ...sinkCallsites,
  ]);
});

test("lazy generic source analysis records import/export references and construct sites structurally", async () => {
  const projectDirectory = resolve(tempRoot, "structural-module-records");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/lib.ts": [
      "export interface Shape {",
      "  value: number;",
      "}",
      "export const localValue = 41;",
      "export function makeValue(input: number): number {",
      "  return input + 1;",
      "}",
      "export default class Box {",
      "  value: number;",
      "  constructor(value: number) {",
      "    this.value = value;",
      "  }",
      "}",
      "export { localValue as renamedValue };",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import Box, { makeValue, renamedValue, type Shape } from \"./lib.js\";",
      "export { makeValue as exportedMakeValue } from \"./lib.js\";",
      "export const used = makeValue(renamedValue);",
      "export type UsedShape = Shape;",
      "export default new Box(used);",
      "",
    ].join("\n"),
  });

  const project = parseTsonicProjectConfig(projectConfig);
  const session = createTsonicSemanticSession({
    programOptions: createProgramOptionsForProject({
      project,
      projectFilePath: resolve(projectDirectory, "tsonic.json"),
    }).programOptions,
    project,
    target: project.targets[0],
    targetPack: createFakeTargetPack(),
    selectedSurfaces: [],
  });
  const indexFile = session.sourceFiles.find((candidate) => session.ast.getFileName(candidate).endsWith("src/index.ts"));
  const libFile = session.sourceFiles.find((candidate) => session.ast.getFileName(candidate).endsWith("src/lib.ts"));
  assert.notEqual(indexFile, undefined);
  assert.notEqual(libFile, undefined);

  const makeValueImportName = findImportBindingName(session.ast, indexFile, "makeValue");
  const shapeImportName = findImportBindingName(session.ast, indexFile, "Shape");
  const boxImportName = findImportBindingName(session.ast, indexFile, "Box");
  const usedName = findVariableName(session.ast, indexFile, "used");
  assert.notEqual(makeValueImportName, undefined);
  assert.notEqual(shapeImportName, undefined);
  assert.notEqual(boxImportName, undefined);
  assert.notEqual(usedName, undefined);

  const makeValueSymbol = session.checker.getSymbolAtLocation(makeValueImportName, { sourceFile: indexFile });
  const shapeSymbol = session.checker.getSymbolAtLocation(shapeImportName, { sourceFile: indexFile });
  const boxSymbol = session.checker.getSymbolAtLocation(boxImportName, { sourceFile: indexFile });
  const usedSymbol = session.checker.getSymbolAtLocation(usedName, { sourceFile: indexFile });
  assert.notEqual(makeValueSymbol, undefined);
  assert.notEqual(shapeSymbol, undefined);
  assert.notEqual(boxSymbol, undefined);
  assert.notEqual(usedSymbol, undefined);

  const analysis = createFakeBackendInput(session, project).analysis.lazy;
  assert.equal(typeof analysis.referencesOf, "function");
  assert.equal(typeof analysis.usesOf, "function");
  assert.equal(typeof analysis.constructSitesOf, "function");

  const makeValueCalls = analysis.callsitesOf(makeValueSymbol);
  const boxConstructs = analysis.constructSitesOf(boxSymbol);
  const shapeReferences = analysis.referencesOf(shapeSymbol);
  const usedUses = analysis.usesOf(usedSymbol);
  const makeValueReferences = analysis.referencesOf(makeValueSymbol);

  assert.strictEqual(analysis.referencesOf(shapeSymbol), shapeReferences);
  assert.strictEqual(analysis.usesOf(usedSymbol), usedUses);
  assert.strictEqual(analysis.referencesOf(makeValueSymbol), makeValueReferences);

  assert.equal(makeValueCalls.length, 1);
  assert.equal(makeValueCalls[0].kind, "call");
  assert.equal(makeValueCalls[0].arguments.length, 1);
  assert.equal(boxConstructs.length, 1);
  assert.equal(boxConstructs[0].kind, "construct");
  assert.equal(boxConstructs[0].arguments.length, 1);
  assert.ok(makeValueReferences.some((reference) => reference.occurrence === "import"));
  assert.ok(makeValueReferences.some((reference) => reference.occurrence === "value"));
  assert.ok(shapeReferences.some((reference) => reference.occurrence === "import"));
  assert.ok(shapeReferences.some((reference) => reference.occurrence === "type"));
  assert.ok(usedUses.some((use) => use.kind === "construct" || use.kind === "argument"));
  assertNoPolicyConclusions([
    ...makeValueCalls,
    ...boxConstructs,
    ...makeValueReferences,
    ...shapeReferences,
    ...usedUses,
  ]);
});

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function createFakeBackendInput(session, project) {
  let backendInput;
  compileWithInputCapture(session, project, (input) => {
    backendInput = input;
  });
  assert.notEqual(backendInput, undefined);
  return backendInput;
}

function compileWithInputCapture(session, project, capture) {
  const targetPack = createFakeTargetPack(capture);
  compileTargetFromSemanticSession(session, project, project.targets[0], targetPack, {
    projectFilePath: resolve(tempRoot, "unused/tsonic.json"),
    projectRoot: resolve(tempRoot, "unused"),
    outputRoot: resolve(tempRoot, "unused/out"),
    targetOutputRoot: resolve(tempRoot, "unused/out/demo"),
  });
}

function findParameterName(ast, sourceFile, name) {
  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (ast.is.IsParameterDeclaration(node)) {
      const parameterName = ast.name(node);
      if (ast.text(parameterName) === name) {
        return parameterName;
      }
    }
    stack.push(...ast.children(node));
  }
  return undefined;
}

function findVariableName(ast, sourceFile, name) {
  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (ast.is.IsVariableDeclaration(node)) {
      const variableName = ast.name(node);
      if (ast.text(variableName) === name) {
        return variableName;
      }
    }
    stack.push(...ast.children(node));
  }
  return undefined;
}

function findImportBindingName(ast, sourceFile, name) {
  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (ast.is.IsImportClause(node) || ast.is.IsImportSpecifier(node) || ast.is.IsNamespaceImport(node)) {
      const importName = ast.name(node);
      if (ast.text(importName) === name) {
        return importName;
      }
    }
    stack.push(...ast.children(node));
  }
  return undefined;
}

function assertNoPolicyConclusions(records) {
  const forbiddenKeys = new Set([
    "arrayClear",
    "carrierLane",
    "targetCarrier",
    "targetMember",
    "runtimeHelper",
    "surfacePolicy",
  ]);
  const forbiddenValues = [
    "array-clear",
    "Dictionary.Keys",
    "JSArray",
    "List<",
    "Map.get",
    "Node fs",
    "Buffer",
    "Date",
    "Map",
    "Promise",
    "Set",
    "C#",
    "runtime-helper",
    "carrier",
  ];
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      assert.equal(forbiddenKeys.has(key), false, `analysis record exposed policy key ${key}`);
      if (typeof value === "string") {
        assert.equal(
          forbiddenValues.some((forbidden) => value.includes(forbidden)),
          false,
          `analysis record exposed policy value ${value}`,
        );
      }
    }
  }
}

function createFakeTargetPack(capture) {
  return {
    id: "demo",
    displayName: "Demo Target",
    provider: {
      id: "demo-provider",
      displayName: "Demo Provider",
      createExtensions() {
        return [];
      },
    },
    createBackend() {
      return {
        compile(input) {
          capture?.(input);
          return { artifacts: [], diagnostics: [] };
        },
      };
    },
    createToolchain() {
      return {
        prepare() {
          return { diagnostics: [], producedArtifacts: [] };
        },
      };
    },
  };
}
