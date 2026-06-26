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
      "export function analyze(xs: number[], sink: (value: number[]) => void): number[] {",
      "  xs[0] = 1;",
      "  xs.length = 0;",
      "  const captured = () => xs.length;",
      "  for (const value of xs) {",
      "    sink(xs);",
      "  }",
      "  captured();",
      "  return xs;",
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
  const sinkName = findParameterName(session.ast, sourceFile, "sink");
  assert.notEqual(sinkName, undefined);
  const sinkSymbol = session.checker.getSymbolAtLocation(sinkName, { sourceFile });
  const analyzeName = findFunctionName(session.ast, sourceFile, "analyze");
  assert.notEqual(analyzeName, undefined);
  const analyzeFunction = session.ast.parent(analyzeName);
  assert.notEqual(analyzeFunction, undefined);

  const analysisInput = createFakeBackendInput(session, project);
  const uses = analysisInput.analysis.lazy.usesOf(xsSymbol);
  const argumentFlows = analysisInput.analysis.lazy.argumentFlowOf(xsSymbol);
  const sinkCallsites = analysisInput.analysis.lazy.callsitesOf(sinkSymbol);
  const escapes = analysisInput.analysis.lazy.escapesOf(xsSymbol);
  const captures = analysisInput.analysis.lazy.capturesOf(xsSymbol);
  const summary = analysisInput.analysis.lazy.summaryOf(analyzeFunction);

  assert.equal(analysisInput.analysis.lazy.elementWritesOn(xsSymbol).length, 1);
  assert.deepEqual(
    analysisInput.analysis.lazy.propertyWritesOn(xsSymbol).map((use) => [use.propertyName, use.access]),
    [["length", "write"]],
  );
  assert.ok(uses.some((use) => use.operation === "iteration" && use.access === "read"));
  assert.ok(uses.some((use) => use.operation === "argument" && use.argumentIndex === 0));
  assert.ok(uses.some((use) => use.operation === "return"));
  assert.equal(argumentFlows.length, 1);
  assert.equal(argumentFlows[0].argumentIndex, 0);
  assert.equal(sinkCallsites.length, 1);
  assert.equal(session.ast.text(sinkCallsites[0].callee), "sink");
  assert.ok(escapes.some((escape) => escape.operation === "argument"));
  assert.ok(escapes.some((escape) => escape.operation === "return"));
  assert.equal(captures.length, 1);
  assert.equal(session.ast.kindName(captures[0].functionNode), "KindArrowFunction");
  assert.equal(summary.returns.length, 1);
  assert.equal(summary.calls.length, 2);
  assert.ok(summary.references.length >= uses.length);
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
