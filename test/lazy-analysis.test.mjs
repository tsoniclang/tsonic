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
    "src/lib.ts": [
      "export class ImportedBox {",
      "  value = 1;",
      "}",
      "export const exportedValue = 41;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { ImportedBox, exportedValue } from \"./lib.js\";",
      "export { exportedValue as renamedValue };",
      "export class LocalBox {",
      "  value = 1;",
      "}",
      "export async function analyze(xs: number[], rhs: number[], obj: { xs: number[] }, sink: (value: number[]) => void, promise: Promise<number[]>): Promise<number[]> {",
      "  const [first] = xs;",
      "  const item = xs[0];",
      "  let assigned = 0;",
      "  [assigned] = rhs;",
      "  const clone = [...xs];",
      "  const objectClone = { ...obj };",
      "  const awaited = await promise;",
      "  const importedBox = new ImportedBox();",
      "  const localBox = new LocalBox();",
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
      "  void importedBox.value;",
      "  void localBox.value;",
      "  void item;",
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
  const libSourceFile = session.sourceFiles.find((candidate) => session.ast.getFileName(candidate).endsWith("src/lib.ts"));
  assert.notEqual(libSourceFile, undefined);
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
  const importedBoxName = findImportBindingName(session.ast, sourceFile, "ImportedBox");
  assert.notEqual(importedBoxName, undefined);
  const importedBoxSymbol = session.checker.getSymbolAtLocation(importedBoxName, { sourceFile });
  const importedValueName = findImportBindingName(session.ast, sourceFile, "exportedValue");
  assert.notEqual(importedValueName, undefined);
  const importedValueSymbol = session.checker.getSymbolAtLocation(importedValueName, { sourceFile });
  const localBoxName = findClassName(session.ast, sourceFile, "LocalBox");
  assert.notEqual(localBoxName, undefined);
  const localBoxSymbol = session.checker.getSymbolAtLocation(localBoxName, { sourceFile });
  const exportedValueName = findVariableName(session.ast, libSourceFile, "exportedValue");
  assert.notEqual(exportedValueName, undefined);
  const exportedValueSymbol = session.checker.getSymbolAtLocation(exportedValueName, { sourceFile: libSourceFile });
  const promiseName = findParameterName(session.ast, sourceFile, "promise");
  assert.notEqual(promiseName, undefined);
  const promiseSymbol = session.checker.getSymbolAtLocation(promiseName, { sourceFile });
  const yieldedName = findParameterName(session.ast, sourceFile, "yielded");
  assert.notEqual(yieldedName, undefined);
  const yieldedSymbol = session.checker.getSymbolAtLocation(yieldedName, { sourceFile });
  const analyzeName = findFunctionName(session.ast, sourceFile, "analyze");
  assert.notEqual(analyzeName, undefined);
  const analyzeFunction = session.ast.parent(analyzeName);
  assert.notEqual(analyzeFunction, undefined);

  const analysisInput = createFakeBackendInput(session, project);
  const uses = analysisInput.analysis.lazy.usesOf(xsSymbol);
  const argumentFlows = analysisInput.analysis.lazy.argumentFlowOf(xsSymbol);
  const sinkCallsites = analysisInput.analysis.lazy.callsitesOf(sinkSymbol);
  const importedConstructSites = analysisInput.analysis.lazy.constructSitesOf(importedBoxSymbol);
  const localConstructSites = analysisInput.analysis.lazy.constructSitesOf(localBoxSymbol);
  const returnFlows = analysisInput.analysis.lazy.returnFlowOf(xsSymbol);
  const escapes = analysisInput.analysis.lazy.escapesOf(xsSymbol);
  const captures = analysisInput.analysis.lazy.capturesOf(xsSymbol);
  const rhsUses = analysisInput.analysis.lazy.usesOf(rhsSymbol);
  const objUses = analysisInput.analysis.lazy.usesOf(objSymbol);
  const promiseUses = analysisInput.analysis.lazy.usesOf(promiseSymbol);
  const yieldedUses = analysisInput.analysis.lazy.usesOf(yieldedSymbol);
  const summary = analysisInput.analysis.lazy.summaryOf(analyzeFunction);
  const importedBoxImports = analysisInput.analysis.lazy.importsOf(importedBoxSymbol);
  const importedValueExports = analysisInput.analysis.lazy.exportsOf(importedValueSymbol);
  const localBoxExports = analysisInput.analysis.lazy.exportsOf(localBoxSymbol);
  const libraryValueExports = analysisInput.analysis.lazy.exportsOf(exportedValueSymbol);

  assert.equal(analysisInput.analysis.lazy.elementReadsOn(xsSymbol).length, 1);
  assert.equal(analysisInput.analysis.lazy.elementWritesOn(xsSymbol).length, 1);
  assert.equal(analysisInput.analysis.lazy.propertyReadsOn(xsSymbol).filter((use) => use.propertyName === "length").length, 1);
  assert.deepEqual(
    analysisInput.analysis.lazy.propertyWritesOn(xsSymbol).map((use) => [use.propertyName, use.access]),
    [["length", "write"]],
  );
  assert.equal(analysisInput.analysis.lazy.writesOf(xsSymbol).filter((use) => use.operation === "property" || use.operation === "element").length, 2);
  assert.ok(analysisInput.analysis.lazy.readsOf(xsSymbol).some((use) => use.operation === "return"));
  assert.ok(uses.some((use) => use.operation === "iteration" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "destructure" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "spread" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "argument" && use.argumentIndex === 0));
  assert.ok(uses.some((use) => use.operation === "return"));
  assert.ok(rhsUses.some((use) => use.operation === "destructure" && use.operator === "="));
  assert.ok(objUses.some((use) => use.operation === "spread" && use.access === "read"));
  assert.ok(promiseUses.some((use) => use.operation === "await" && use.access === "read"));
  assert.ok(yieldedUses.some((use) => use.operation === "yield" && use.access === "read"));
  assert.equal(argumentFlows.length, 1);
  assert.equal(argumentFlows[0].argumentIndex, 0);
  assert.equal(sinkCallsites.length, 1);
  assert.equal(sinkCallsites[0].kind, "call");
  assert.equal(session.ast.text(sinkCallsites[0].callee), "sink");
  assert.equal(importedConstructSites.length, 1);
  assert.equal(importedConstructSites[0].kind, "construct");
  assert.equal(localConstructSites.length, 1);
  assert.equal(returnFlows.length, 1);
  assert.equal(session.ast.kindName(returnFlows[0].functionNode), "KindFunctionDeclaration");
  assert.ok(escapes.some((escape) => escape.operation === "argument"));
  assert.ok(escapes.some((escape) => escape.operation === "return"));
  assert.equal(captures.length, 1);
  assert.equal(session.ast.kindName(captures[0].functionNode), "KindArrowFunction");
  assert.equal(summary.returns.length, 1);
  assert.equal(summary.calls.length, 2);
  assert.equal(summary.constructs.length, 2);
  assert.ok(summary.references.length >= uses.length);
  assert.deepEqual(importedBoxImports.map((record) => [record.importKind, record.isTypeOnly]), [["named", false]]);
  assert.equal(importedValueExports.length, 1);
  assert.equal(importedValueExports[0].exportKind, "named");
  assert.equal(localBoxExports.length, 1);
  assert.equal(localBoxExports[0].exportKind, "declaration");
  assert.equal(libraryValueExports.length, 1);
  assert.equal(libraryValueExports[0].exportKind, "declaration");
  assert.equal(uses.some((use) => "arrayClear" in use || "carrierLane" in use || "targetMember" in use), false);
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

function findFunctionName(ast, sourceFile, name) {
  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (ast.is.IsFunctionDeclaration(node)) {
      const functionName = ast.name(node);
      if (ast.text(functionName) === name) {
        return functionName;
      }
    }
    stack.push(...ast.children(node));
  }
  return undefined;
}

function findClassName(ast, sourceFile, name) {
  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (ast.is.IsClassDeclaration(node)) {
      const className = ast.name(node);
      if (ast.text(className) === name) {
        return className;
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
    if (ast.is.IsImportSpecifier(node)) {
      const importedName = ast.name(node);
      if (ast.text(importedName) === name) {
        return importedName;
      }
    }
    stack.push(...ast.children(node));
  }
  return undefined;
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
