import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createSourceNavigationInput, createSourceProgramNavigation,
  createHostSourceProgram,
  sourceBindingWriteAtReference,
} from "../../packages/target-api/dist/public/host.js";
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
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts });
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
  // Selected heritage type arguments are Host descriptors of the object facts (B3 D8, objects.heritage).
  const typeArgumentText = (argument) => argument.kind === "declared"
    ? source.ast.text(source.ast.name(argument.declaration)) : sourceTypeKind(argument);
  const middleEdges = source.facts.objects.heritage(middle);
  assert.equal(Array.isArray(middleEdges), true);

  assert.equal(middleHeritage.kind, "resolved");
  assert.deepEqual(
    middleHeritage.edges.map((edge, index) => ({
      kind: edge.kind,
      target: source.ast.text(source.ast.name(edge.target.declaration)),
      typeArguments: edge.typeArguments.map((argument) =>
        source.ast.kindName(argument)),
      selectedTypeArgumentCount: middleEdges[index].typeArguments.length,
      selectedTypeArguments: middleEdges[index].typeArguments.map(typeArgumentText),
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
  // A defaulted type parameter is applied by the Host heritage fact (T = string).
  const defaultEdges = source.facts.objects.heritage(defaultDerived);
  assert.equal(Array.isArray(defaultEdges), true);
  assert.equal(defaultEdges[0].typeArguments.length, 1);
  assert.equal(sourceTypeKind(defaultEdges[0].typeArguments[0]), "string");
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

test("shared constructors retain checked mandatory arity independently of defaults and rest syntax", async () => {
  const checked = await checkedSource("constructor-omission-identity", {
    "src/base.ts": `export class Base {
      constructor(value: unknown = "default", required: number) { void value; void required; }
    }`,
    "src/index.ts": `
      import { Base } from "./base.js";
      export class Derived extends Base {}
      export class Optional { constructor(value: number, label: string = "default") { void value; void label; } }
      export class TupleRest { constructor(...input: [first: number, second?: string]) { void input; } }
      export class EmptyRest { constructor(...input: []) { void input; } }
      new Derived(undefined, 7); new Optional(1); new TupleRest(1); new EmptyRest();
    `,
  });
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts });
  const file = projectSourceFile(source, "src/index.ts");
  const expected = new Map([["Derived", [false, false]], ["Optional", [false, true]],
    ["TupleRest", [false]], ["EmptyRest", [true]]]);
  for (const [name, omission] of expected) {
    const declaration = namedDeclaration(source.ast, file, name);
    const constructors = source.navigation.classConstructors(declaration);
    assert.equal(constructors.kind, "resolved", name);
    assert.deepEqual(constructors.signatures[0].parameters.map(parameter => parameter.acceptsOmission), omission, name);
    assert.equal(Object.isFrozen(constructors.signatures[0].parameters), true, name);
  }
  const visit = node => {
    if (source.ast.is.IsNewExpression(node)) {
      const call = source.navigation.call(node);
      const name = source.ast.text(call.callee);
      assert.deepEqual(call.parameters.map(parameter => parameter.acceptsOmission), expected.get(name), name);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
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
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts });
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const constructors = (name) => {
    const declaration = namedDeclaration(source.ast, sourceFile, name);
    const result = source.navigation.classConstructors(declaration);
    assert.equal(result.kind, "resolved");
    return result;
  };

  const derived = constructors("Derived");
  // Parameter types are Host descriptors of the construction facts (instantiated for the derived class).
  const construction = source.facts.objects.construction(namedDeclaration(source.ast, sourceFile, "Derived"));
  assert.equal(construction.kind === "refused", false);
  assert.equal(derived.implicit, true);
  assert.deepEqual(
    derived.signatures.map((signature) => ({
      declarationOwner: source.ast.text(
        source.ast.name(source.ast.parent(signature.declaration)),
      ),
      parameters: signature.parameters.map((parameter, index) => ({
        name: parameter.parameterName,
        type: sourceTypeKind(construction.signatures[0].parameters[index].type),
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

// A Host descriptor as a short text: string, number, number | undefined (optional or union with absence).
function sourceTypeKind(type) {
  if (type.kind === "string") return "string";
  if (type.kind === "primitive" && type.primitive === "float64") return "number";
  const arms = type.kind === "optional" ? [type.value, { kind: "intrinsic", intrinsic: "absence" }]
    : type.kind === "union" ? type.types : [];
  if (arms.some((arm) => sourceTypeKind(arm) === "number") &&
    arms.some((arm) => arm.kind === "intrinsic" && arm.intrinsic === "absence")) {
    return "number | undefined";
  }
  return undefined;
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
  const used = namedVariable(ast, sourceFile, "used");
  const unused = namedVariable(ast, sourceFile, "unused");
  const neverUsed = namedVariable(ast, sourceFile, "neverUsed");
  // Navigation is keyed by declaration (B3 D1): the entity is the declaration and its merged declarations.
  assert.equal(navigation.hasReferenceOutside(used, used), true);
  assert.equal(navigation.hasReferenceOutside(unused, unused), true);
  assert.equal(navigation.hasReferenceOutside(neverUsed, neverUsed), false);
  assert.equal(navigation.hasReferenceOutside(used, sourceFile), false);
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
  const references = navigation.referencesWithin(parameter, sourceFile);
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
  const writesFor = (name) => navigation.bindingWritesWithin(namedVariable(ast, sourceFile, name), sourceFile);

  assert.deepEqual(writesFor("direct").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("compound").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("incremented").map((write) => write.kind), ["update"]);
  assert.deepEqual(writesFor("destructured").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("iterated").map((write) => write.kind), ["iteration"]);
  assert.deepEqual(writesFor("propertyTarget"), []);
  assert.deepEqual(writesFor("untouched"), []);
});

test("source write occurrences retain original nested defaults and iteration projections without classifying initialization as mutation", async () => {
  const checked = await checkedSource("write-original-pattern-values", {
    "src/index.ts": `export function run(source: { nested?: { value?: number } }, outer: { value?: number },
      inner: number, rows: [number?][]) {
      let { nested: { value = inner } = outer } = source;
      ({ nested: { value = inner } = outer } = source);
      for (const [iterated = inner] of rows) void iterated;
      for ([value = inner] of rows) void value;
      return value;
    }`,
  });
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts });
  const { ast } = source;
  const file = projectSourceFile(source, "src/index.ts");
  const selected = requiredNode(ast, file, node => ast.is.IsBindingElement(node) &&
    ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "value");
  const initialization = sourceBindingWriteAtReference(ast, ast.name(selected));
  assert.equal(initialization?.kind === "initialization", true, "the declaration's exact original write is retained separately");
  assert.deepEqual(initialization.values.map(value => ast.text(value.expression)), ["source", "outer", "inner"]);
  assert.deepEqual(initialization.values.map(value => value.projection.length), [2, 1, 0]);
  const writes = source.navigation.bindingWritesWithin(selected, file);
  assert.deepEqual(writes.map(write => write.kind), ["assignment", "iteration"]);
  assert.deepEqual(writes[0].values.map(value => ast.text(value.expression)), ["source", "outer", "inner"]);
  assert.deepEqual(writes[0].values.map(value => value.projection.length), [2, 1, 0]);
  assert.deepEqual(writes[1].values.map(value => [value.kind, ast.text(value.expression), value.projection.length]),
    [["iteration-value", "rows", 2], ["value", "inner", 0]]);
  const iterated = requiredNode(ast, file, node => ast.is.IsBindingElement(node) &&
    ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "iterated");
  const iteration = sourceBindingWriteAtReference(ast, ast.name(iterated));
  const declaration = iteration.values[0].projection[0];
  assert.equal(iteration.kind === "iteration" && ast.is.IsVariableDeclaration(declaration), true,
    "iteration retains its actual initializer declaration, not the whole collection as a binding value");
  assert.equal(iteration.values[0].projection[1] === iterated, true, "the exact tuple projection survives");
  for (const write of [initialization, ...writes, iteration]) {
    assert.equal(Object.isFrozen(write) && Object.isFrozen(write.values) && write.values.every(value =>
      Object.isFrozen(value) && Object.isFrozen(value.projection)), true, "published write evidence is immutable");
  }
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
    createSourceProgramNavigation(createSourceNavigationInput(source)).referenceFor(reference)?.declaration,
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
  const dependencies = createSourceProgramNavigation(createSourceNavigationInput(source))
    .moduleDependencies(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));

  assert.deepEqual(
    dependencies,
    cases.filter((entry) => entry.runtime).map((entry) => `${entry.id}.ts`),
  );
  const references = createSourceProgramNavigation(createSourceNavigationInput(source))
    .moduleReferences(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));
  assert.deepEqual(
    references,
    cases.map((entry) => `${entry.id}.ts`),
  );
});

test("shared source navigation resolves exact authored project-module literals", async () => {
  const source = await checkedSource("authored-module-literal", {
    "src/index.ts": [
      "declare function startWorker(path: string): void;",
      "startWorker('./worker.js');",
      "startWorker('./missing.js');",
      "",
    ].join("\n"),
    "src/worker.ts": "export const workerValue = 1;\n",
  }, { rootFiles: ["index.ts", "worker.ts"] });
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
  const entry = projectSourceFile(source, "src/index.ts");
  const worker = projectSourceFile(source, "src/worker.ts");
  const literals = [];
  const visit = (node) => {
    if (source.ast.is.IsStringLiteral(node)) {
      literals.push(node);
    }
    source.ast.forEachChild(node, (child) => {
      if (child !== undefined) visit(child);
    });
  };
  visit(entry);
  const workerSpecifier = literals.find((literal) =>
    source.ast.text(literal) === "./worker.js");
  const missingSpecifier = literals.find((literal) =>
    source.ast.text(literal) === "./missing.js");
  assert.ok(workerSpecifier !== undefined);
  assert.ok(missingSpecifier !== undefined);

  const resolution = navigation.moduleSpecifierResolution(workerSpecifier);
  assert.equal(resolution.kind, "project");
  assert.ok(resolution.sourceFile === worker);
  assert.equal(
    navigation.moduleSpecifierResolution(missingSpecifier).kind,
    "unresolved",
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
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
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
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
  const sourceFiles = [projectFile, providerFile];
  const source = {
    sourceFiles,
    containsSourceFile: (sourceFile) => sourceFiles.includes(sourceFile),
    ast: {
      getFileName: (sourceFile) => sourceFile.FileName,
      getPath: (sourceFile) => sourceFile.Path,
      getSourceFile: (node) => node?.SourceFile,
      kind: (node) => node?.Kind,
      pos: (node) => node?.Pos,
      end: (node) => node?.End,
      children: () => [],
      parent: () => undefined,
      statements: () => [],
      forEachChild: () => undefined,
      is: new Proxy({}, { get: () => () => false }),
    },
    getSourceFileQueries() {
      queryCount += 1;
      throw new Error("Provider declaration files are not project query roots.");
    },
  };
  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));

  assert.equal(navigation.referenceFor(providerDeclaration), undefined);
  assert.equal(navigation.declarationFor(providerDeclaration), undefined);
  assert.equal(navigation.isProjectDeclaration(providerDeclaration), false);
  assert.equal(queryCount, 0);
  assert.equal(navigation.nodes.length, 1, "the default inventory contains only the project file");
  assert.equal(navigation.nodes[0] === projectFile, true, "the project inventory retains its original file identity");
  assert.equal(navigation.nodesForFiles([projectFile]) === navigation.nodes, true,
    "the default inventory preserves its published array identity");
  const providerNodes = navigation.nodesForFiles([providerFile]);
  assert.equal(providerNodes.length, 1, "an explicit checked provider file remains available outside the default inventory");
  assert.equal(providerNodes[0] === providerFile, true, "explicit provider inventory retains checked file identity");
  assert.throws(() => navigation.nodesForFiles([projectFile, projectFile]),
    /Source node inventories require distinct source files\./u);
  assert.throws(() => navigation.nodesForFiles([{ ...projectFile }]),
    /Source node inventories require exact checked source-file ownership\./u);
  assert.equal(queryCount, 0, "inventory ownership checks never query declaration-provider semantics");
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

  const navigation = createSourceProgramNavigation(createSourceNavigationInput(source));
  const reference = navigation.sourceReferenceFor(initializer);
  assert.equal(ast.is.IsClassDeclaration(reference?.declaration), true);
  assert.equal(ast.text(ast.name(reference?.declaration)), "Environment");
  assert.match(ast.getFileName(reference?.sourceFile), /src\/provider\.d\.ts$/u);
  assert.equal(reference?.project, false);
  assert.equal(navigation.referenceFor(initializer), undefined);
  assert.equal(navigation.isProjectDeclaration(reference?.declaration), false);
});
