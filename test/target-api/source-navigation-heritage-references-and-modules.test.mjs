import assert from "node:assert/strict";
import test from "node:test";

import {
  createSourceProgramNavigation,
  createTargetSourceProgram,
} from "../../packages/target-api/dist/public/source.js";
import {
  checkedSource,
  constructorReference,
  heritageBaseReference,
  moduleCase,
  namedDeclaration,
  namedMember,
  namedVariable,
  projectSourceFile,
  requiredNode,
} from "../fixtures/source-navigation.mjs";

test("shared source navigation resolves exact generic and transitive declared heritage", async () => {
  const checked = await checkedSource("declared-heritage", {
    "src/index.ts": [
      "export interface Named<T> { value: T; }",
      "export class Base<T> { value!: T; }",
      "export class Middle<T> extends Base<T> implements Named<T> {}",
      "export class Derived extends Middle<string> {}",
      "export class DefaultBase<T = string> {}",
      "export class DefaultDerived extends DefaultBase {}",
      "export class SameShape { value!: string; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const base = namedDeclaration(source.ast, sourceFile, "Base");
  const named = namedDeclaration(source.ast, sourceFile, "Named");
  const middle = namedDeclaration(source.ast, sourceFile, "Middle");
  const derived = namedDeclaration(source.ast, sourceFile, "Derived");
  const defaultDerived = namedDeclaration(
    source.ast,
    sourceFile,
    "DefaultDerived",
  );
  const sameShape = namedDeclaration(source.ast, sourceFile, "SameShape");
  const middleHeritage = source.navigation.declaredHeritage(middle);
  const semantics = source.semantics.forFile(sourceFile);

  assert.equal(middleHeritage.kind, "resolved");
  assert.deepEqual(
    middleHeritage.edges.map((edge) => ({
      kind: edge.kind,
      target: source.ast.text(source.ast.name(edge.target.declaration)),
      typeArguments: edge.typeArguments.map((argument) =>
        source.ast.kindName(argument)),
      selectedTypeArgumentCount: edge.selectedTypeArguments.length,
      selectedTypeArguments: edge.selectedTypeArguments.map((argument) =>
        sourceTypeKind(semantics, argument)),
    })),
    [
      {
        kind: "extends",
        target: "Base",
        typeArguments: ["KindTypeReference"],
        selectedTypeArgumentCount: 1,
        selectedTypeArguments: ["T"],
      },
      {
        kind: "implements",
        target: "Named",
        typeArguments: ["KindTypeReference"],
        selectedTypeArgumentCount: 1,
        selectedTypeArguments: ["T"],
      },
    ],
  );
  const defaultHeritage = source.navigation.declaredHeritage(defaultDerived);
  assert.equal(defaultHeritage.kind, "resolved");
  assert.equal(defaultHeritage.edges.length, 1);
  assert.deepEqual(defaultHeritage.edges[0].typeArguments, []);
  assert.equal(defaultHeritage.edges[0].selectedTypeArguments.length, 1);
  assert.equal(
    semantics.types.isStringLike(
      defaultHeritage.edges[0].selectedTypeArguments[0],
    ),
    true,
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(derived, base).kind,
    "related",
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(derived, named).kind,
    "related",
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(sameShape, named),
    { kind: "unrelated" },
  );
});

test("shared source navigation exposes exact effective class constructors", async () => {
  const checked = await checkedSource("effective-constructors", {
    "src/index.ts": [
      "export class Base<T> { constructor(value: T, count?: number) { void value; void count; } }",
      "export class Derived extends Base<string> {}",
      "export class Explicit extends Base<string> { constructor(value: string) { super(value); } }",
      "export class Empty {}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const constructors = (name) => {
    const declaration = namedDeclaration(source.ast, sourceFile, name);
    const result = source.navigation.classConstructors(declaration);
    assert.equal(result.kind, "resolved");
    return result;
  };

  const derived = constructors("Derived");
  assert.equal(derived.implicit, true);
  assert.deepEqual(
    derived.signatures.map((signature) => ({
      declarationOwner: source.ast.text(
        source.ast.name(source.ast.parent(signature.declaration)),
      ),
      parameters: signature.parameters.map((parameter) => ({
        name: parameter.parameterName,
        type: sourceTypeKind(semantics, parameter.selectedType),
        omission: parameter.acceptsOmission,
        rest: parameter.rest,
      })),
    })),
    [{
      declarationOwner: "Base",
      parameters: [
        { name: "value", type: "string", omission: false, rest: false },
        {
          name: "count",
          type: "number | undefined",
          omission: true,
          rest: false,
        },
      ],
    }],
  );
  assert.equal(constructors("Explicit").implicit, false);
  const empty = constructors("Empty");
  assert.equal(empty.implicit, true);
  assert.equal(empty.signatures.length, 1);
  assert.equal(empty.signatures[0].declaration, undefined);
  assert.deepEqual(empty.signatures[0].parameters, []);
});

function sourceTypeKind(semantics, type) {
  if (semantics.types.isStringLike(type)) {
    return "string";
  }
  if (semantics.types.isNumberLike(type)) {
    return "number";
  }
  if (semantics.types.isUnion(type)) {
    const members = semantics.types.unionOrIntersectionTypes(type);
    if (
      members.some((member) => semantics.types.isNumberLike(member)) &&
      members.some((member) => semantics.types.isNullish(member))
    ) {
      return "number | undefined";
    }
  }
  const symbol = semantics.declarations.typeAliasSymbol(type) ??
    semantics.declarations.typeSymbol(type);
  return symbol === undefined
    ? undefined
    : semantics.declarations.symbolName(symbol);
}

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

test("shared source navigation enumerates exact symbol references within a subtree", async () => {
  const source = await checkedSource("references-within", {
    "src/index.ts": [
      "export function read(value: number): number {",
      "  const copy = value;",
      "  {",
      "    const value = 2;",
      "    void value;",
      "  }",
      "  return (() => value + copy)();",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const parameter = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value");
  const symbol = source.getSourceFileQueries(sourceFile).checker
    .getSymbolAtLocation(ast.name(parameter), { sourceFile });

  assert.notEqual(symbol, undefined);
  const navigation = createSourceProgramNavigation(source);
  const references = navigation.referencesWithin(symbol, sourceFile);
  assert.equal(references.length, 2);
  assert.equal(new Set(references).size, 2);
  assert.equal(
    references.every((reference) =>
      navigation.sourceReferenceFor(reference)?.declaration === parameter),
    true,
  );
});

test("shared source navigation indexes exact references to one declaration across modules", async () => {
  const source = await checkedSource("references-to-declaration", {
    "src/index.ts": [
      'import "./direct.js";',
      'import "./namespace.js";',
      "",
    ].join("\n"),
    "src/api.ts": [
      "export const transform = (value: number): number => value + 1;",
      "",
    ].join("\n"),
    "src/direct.ts": [
      'import { transform as apply } from "./api.js";',
      "export const direct = apply(1);",
      "export const retained = apply;",
      "",
    ].join("\n"),
    "src/namespace.ts": [
      'import * as api from "./api.js";',
      "export const namespaced = api.transform(2);",
      "function local(transform: (value: number) => number): number {",
      "  return transform(3);",
      "}",
      "void local;",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const apiFile = projectSourceFile(source, "src/api.ts");
  const declaration = namedVariable(ast, apiFile, "transform");
  const navigation = createSourceProgramNavigation(source);
  const references = navigation.referencesToDeclaration(declaration);

  assert.equal(references.length, 5);
  assert.equal(new Set(references).size, references.length);
  assert.equal(
    references.every((reference) =>
      navigation.sourceReferenceFor(reference)?.declaration === declaration),
    true,
  );
  assert.equal(
    references.filter((reference) => ast.is.IsPropertyAccessExpression(reference)).length,
    1,
  );
  assert.equal(references.some((reference) =>
    ast.is.IsPropertyAccessExpression(reference) &&
    ast.getFileName(ast.getSourceFile(reference)).endsWith("namespace.ts")), true);
});

test("shared source navigation classifies exact binding writes without treating object mutation as rebinding", async () => {
  const source = await checkedSource("binding-writes", {
    "src/index.ts": [
      "export function update(values: number[]): void {",
      "  let direct = 0;",
      "  direct = 1;",
      "  let compound = 0;",
      "  compound += 1;",
      "  let incremented = 0;",
      "  incremented++;",
      "  let destructured = 0;",
      "  [destructured] = values;",
      "  let propertyTarget = { value: 0 };",
      "  propertyTarget.value = 1;",
      "  let iterated = 0;",
      "  for (iterated of values) void iterated;",
      "  let untouched = 0;",
      "  void untouched;",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const writesFor = (name) => {
    const declaration = namedVariable(ast, sourceFile, name);
    const symbol = checker.getSymbolAtLocation(ast.name(declaration), {
      sourceFile,
    });
    assert.notEqual(symbol, undefined);
    return navigation.bindingWritesWithin(symbol, sourceFile);
  };

  assert.deepEqual(writesFor("direct").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("compound").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("incremented").map((write) => write.kind), ["update"]);
  assert.deepEqual(writesFor("destructured").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("iterated").map((write) => write.kind), ["iteration"]);
  assert.deepEqual(writesFor("propertyTarget"), []);
  assert.deepEqual(writesFor("untouched"), []);
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
  const references = createSourceProgramNavigation(source)
    .moduleReferences(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));
  assert.deepEqual(
    references,
    cases.map((entry) => `${entry.id}.ts`),
  );
});

test("source navigation classifies top-level await without entering function bodies", async () => {
  const source = await checkedSource("module-top-level-await", {
    "src/entry.ts": [
      "interface Promise<T> {}",
      "declare function ready(): Promise<void>;",
      "export async function nested(): Promise<void> {",
      "  await ready();",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { nested } from \"./entry.js\";",
      "await nested();",
      "",
    ].join("\n"),
  });
  const navigation = createSourceProgramNavigation(source);
  const entry = projectSourceFile(source, "src/entry.ts");
  const index = projectSourceFile(source, "src/index.ts");

  assert.equal(navigation.moduleHasTopLevelAwait(entry), false);
  assert.equal(navigation.moduleHasTopLevelAwait(index), true);
  assert.equal(navigation.moduleHasTopLevelAwait(index), true);
});

test("source navigation classifies top-level await using without entering functions", async () => {
  const source = await checkedSource("module-top-level-await-using", {
    "src/entry.ts": [
      "export async function nested(): Promise<void> {",
      "  await using nestedResource = null;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { nested } from \"./entry.js\";",
      "await using topLevelResource = null;",
      "void nested;",
      "",
    ].join("\n"),
  });
  const navigation = createSourceProgramNavigation(source);
  const entry = projectSourceFile(source, "src/entry.ts");
  const index = projectSourceFile(source, "src/index.ts");

  assert.equal(navigation.moduleHasTopLevelAwait(entry), false);
  assert.equal(navigation.moduleHasTopLevelAwait(index), true);
});

test("source navigation never queries declaration-provider files as project source", () => {
  const projectFile = {
    FileName: "/project/index.ts",
    Path: "/project/index.ts",
    IsDeclarationFile: false,
  };
  const providerFile = {
    FileName: "tsts-provider://canonical/System.js.d.ts",
    Path: "tsts-provider://canonical/System.js.d.ts",
    IsDeclarationFile: true,
  };
  const providerDeclaration = {
    Kind: 264,
    Pos: 0,
    End: 20,
    SourceFile: providerFile,
  };
  let queryCount = 0;
  const source = {
    sourceFiles: [projectFile, providerFile],
    ast: {
      getFileName: (sourceFile) => sourceFile.FileName,
      getPath: (sourceFile) => sourceFile.Path,
      getSourceFile: (node) => node?.SourceFile,
      kind: (node) => node?.Kind,
      pos: (node) => node?.Pos,
      end: (node) => node?.End,
      statements: () => [],
      forEachChild: () => undefined,
      is: new Proxy({}, { get: () => () => false }),
    },
    getSourceFileQueries() {
      queryCount += 1;
      throw new Error("Provider declaration files are not project query roots.");
    },
  };
  const navigation = createSourceProgramNavigation(source);

  assert.equal(navigation.referenceFor(providerDeclaration), undefined);
  assert.equal(navigation.declarationFor(providerDeclaration), undefined);
  assert.equal(navigation.isProjectDeclaration(providerDeclaration), false);
  assert.equal(queryCount, 0);
});

test("source navigation resolves imported declaration references without treating them as project source", async () => {
  const source = await checkedSource("external-declaration-reference", {
    "src/provider.d.ts": [
      "export declare class Environment {}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Environment } from \"./provider.js\";",
      "export const captured = Environment;",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const captured = namedVariable(ast, sourceFile, "captured");
  const initializer = ast.as.AsVariableDeclaration(captured)?.Initializer;
  assert.notEqual(initializer, undefined);

  const navigation = createSourceProgramNavigation(source);
  const reference = navigation.sourceReferenceFor(initializer);
  assert.equal(ast.is.IsClassDeclaration(reference?.declaration), true);
  assert.equal(ast.text(ast.name(reference?.declaration)), "Environment");
  assert.match(ast.getFileName(reference?.sourceFile), /src\/provider\.d\.ts$/u);
  assert.equal(reference?.project, false);
  assert.equal(navigation.referenceFor(initializer), undefined);
  assert.equal(navigation.isProjectDeclaration(reference?.declaration), false);
});
