import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  parseTsonicProjectConfig,
} from "../packages/host/dist/index.js";
import {
  createSourceProgramNavigation,
} from "../packages/target-api/dist/index.js";

const tempRoot = resolve(
  process.cwd(),
  ".temp/test-runs/source-navigation",
  `${Date.now()}-${process.pid}`,
);

test("source navigation resolves project references, shapes, constructors, and dispatch", async () => {
  const source = await checkedSource("project-navigation", {
    "src/index.ts": [
      "export class Base {",
      "  read(): number { return 1; }",
      "}",
      "export class Derived extends Base {",
      "  read(): number { return 2; }",
      "}",
      "export class OptionalConstructor {",
      "  constructor(value: number = 1) { void value; }",
      "}",
      "export class RequiredConstructor {",
      "  constructor(value: number) { void value; }",
      "}",
      "export interface Shape { value: number; }",
      "export const derived = new Derived();",
      "export const optional = new OptionalConstructor();",
      "export const required = new RequiredConstructor(1);",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const baseClass = namedDeclaration(ast, sourceFile, "Base");
  const derivedClass = namedDeclaration(ast, sourceFile, "Derived");
  const baseRead = namedMember(ast, baseClass, "read");
  const derivedRead = namedMember(ast, derivedClass, "read");
  const derivedBase = heritageBaseReference(ast, derivedClass);
  const derivedReference = constructorReference(ast, sourceFile, "Derived");
  const optionalReference = constructorReference(
    ast,
    sourceFile,
    "OptionalConstructor",
  );
  const requiredReference = constructorReference(
    ast,
    sourceFile,
    "RequiredConstructor",
  );
  const shape = namedDeclaration(ast, sourceFile, "Shape");

  assert.strictEqual(
    navigation.referenceFor(derivedReference)?.declaration,
    derivedClass,
  );
  assert.strictEqual(navigation.referenceFor(derivedBase)?.declaration, baseClass);
  assert.strictEqual(navigation.declarationFor(derivedReference), derivedClass);
  assert.equal(navigation.isProjectDeclaration(derivedClass), true);
  assert.equal(navigation.isProjectShape(derivedReference), true);
  assert.equal(navigation.isProjectShape(ast.name(shape)), true);
  assert.equal(navigation.isProjectConstructibleObject(derivedReference), true);
  assert.equal(navigation.isProjectConstructibleObject(optionalReference), true);
  assert.equal(navigation.isProjectConstructibleObject(requiredReference), false);
  assert.deepEqual(navigation.memberDispatch(baseRead), {
    overridesBase: false,
    hasDerivedOverride: true,
  });
  assert.deepEqual(navigation.memberDispatch(derivedRead), {
    overridesBase: true,
    hasDerivedOverride: false,
  });
});

test("source navigation proves references outside an exact excluded subtree", async () => {
  const source = await checkedSource("reference-usage", {
    "src/index.ts": [
      "export function read(): number {",
      "  const used = 1;",
      "  const unused = 2;",
      "  const neverUsed = 3;",
      "  void unused;",
      "  return used;",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const used = namedVariable(ast, sourceFile, "used");
  const unused = namedVariable(ast, sourceFile, "unused");
  const neverUsed = namedVariable(ast, sourceFile, "neverUsed");
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const usedName = ast.name(used);
  const unusedName = ast.name(unused);
  const neverUsedName = ast.name(neverUsed);
  const usedSymbol = checker.getSymbolAtLocation(usedName, { sourceFile });
  const unusedSymbol = checker.getSymbolAtLocation(unusedName, { sourceFile });
  const neverUsedSymbol = checker.getSymbolAtLocation(neverUsedName, {
    sourceFile,
  });

  assert.notEqual(usedSymbol, undefined);
  assert.notEqual(unusedSymbol, undefined);
  assert.notEqual(neverUsedSymbol, undefined);
  assert.equal(navigation.hasReferenceOutside(usedSymbol, used), true);
  assert.equal(navigation.hasReferenceOutside(unusedSymbol, unused), true);
  assert.equal(navigation.hasReferenceOutside(neverUsedSymbol, neverUsed), false);
  assert.equal(navigation.hasReferenceOutside(usedSymbol, sourceFile), false);
});

test("source navigation resolves shorthand values through the checker-selected value symbol", async () => {
  const source = await checkedSource("shorthand-value-reference", {
    "src/index.ts": [
      "export function make(value: number) {",
      "  return { value };",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const parameter = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsParameterDeclaration(node) &&
    ast.text(ast.name(node)) === "value");
  const shorthand = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsShorthandPropertyAssignment(node));
  const reference = ast.name(shorthand);

  assert.notEqual(reference, undefined);
  assert.strictEqual(
    createSourceProgramNavigation(source).referenceFor(reference)?.declaration,
    parameter,
  );
});

test("source navigation classifies runtime import and export dependencies exactly", async () => {
  const cases = [
    moduleCase("side-effect", true, (path) => `import "${path}";`),
    moduleCase("type-import", false, (path, index) => `import type { Shape as Shape${index} } from "${path}";`),
    moduleCase("inline-type-import", false, (path, index) => `import { type Shape as Shape${index} } from "${path}";`),
    moduleCase("mixed-import", true, (path, index) => `import { type Shape as Shape${index}, value as value${index} } from "${path}";`),
    moduleCase("default-and-type", true, (path, index) => `import defaultValue${index}, { type Shape as Shape${index} } from "${path}";`),
    moduleCase("namespace-import", true, (path, index) => `import * as values${index} from "${path}";`),
    moduleCase("type-namespace-import", false, (path, index) => `import type * as values${index} from "${path}";`),
    moduleCase("empty-import", true, (path) => `import {} from "${path}";`),
    moduleCase("type-export", false, (path) => `export type { Shape } from "${path}";`),
    moduleCase("inline-type-export", false, (path) => `export { type Shape } from "${path}";`),
    moduleCase("mixed-export", true, (path) => `export { type Shape, value } from "${path}";`),
    moduleCase("export-star", true, (path) => `export * from "${path}";`),
    moduleCase("namespace-export", true, (path) => `export * as values from "${path}";`),
    moduleCase("type-namespace-export", false, (path) => `export type * as values from "${path}";`),
    moduleCase("empty-export", true, (path) => `export {} from "${path}";`),
  ];
  const files = {
    "src/index.ts": cases
      .map((entry, index) => entry.render(`./${entry.id}.js`, index))
      .join("\n") + "\n",
  };
  for (const entry of cases) {
    files[`src/${entry.id}.ts`] = [
      "export interface Shape { value: number; }",
      "export const value = 1;",
      "export default value;",
      "",
    ].join("\n");
  }
  const source = await checkedSource("module-dependencies", files);
  const entry = projectSourceFile(source, "src/index.ts");
  const dependencies = createSourceProgramNavigation(source)
    .moduleDependencies(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));

  assert.deepEqual(
    dependencies,
    cases.filter((entry) => entry.runtime).map((entry) => `${entry.id}.ts`),
  );
});

async function checkedSource(name, files) {
  const projectDirectory = resolve(tempRoot, name);
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    ...files,
  });
  const project = parseTsonicProjectConfig(projectConfig);
  const options = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
  });
  return createTsonicSemanticSession({
    programOptions: options.programOptions,
    project,
    projectDirectory,
    target: project.targets[0],
    targetPack: fakeTargetPack,
    selectedSurfaces: [],
  }).source;
}

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function projectSourceFile(source, suffix) {
  const result = source.sourceFiles.find((sourceFile) =>
    sourceFile !== undefined &&
    source.ast.getFileName(sourceFile).endsWith(suffix));
  assert.notEqual(result, undefined);
  return result;
}

function namedDeclaration(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    (
      ast.is.IsClassDeclaration(node) ||
      ast.is.IsInterfaceDeclaration(node)
    ) &&
    ast.text(ast.name(node)) === name);
}

function namedMember(ast, declaration, name) {
  const result = ast.members(declaration).find((member) =>
    member !== undefined && ast.text(ast.name(member)) === name);
  assert.notEqual(result, undefined);
  return result;
}

function namedVariable(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === name);
}

function constructorReference(ast, sourceFile, name) {
  const expression = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node)?.Expression) === name);
  const reference = ast.as.AsNewExpression(expression)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

function heritageBaseReference(ast, declaration) {
  const heritage = ast.extendsHeritageElements(declaration)[0];
  assert.notEqual(heritage, undefined);
  assert.equal(ast.is.IsExpressionWithTypeArguments(heritage), true);
  const reference = ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

function requiredNode(ast, root, predicate) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (predicate(node)) {
      return node;
    }
    stack.push(...ast.children(node));
  }
  assert.fail("Expected source node was not found.");
}

function moduleCase(id, runtime, render) {
  return { id, runtime, render };
}

const fakeTargetPack = {
  id: "demo",
  displayName: "Demo Target",
  provider: {
    id: "demo-provider",
    displayName: "Demo Provider",
    sourceCompilerContributions() {
      return {};
    },
  },
  createBackend() {
    return {
      compile() {
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
