import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createInlineTstsTestProgram,
  createTstsTestProgramFromFiles,
} from "../testing/tsts-test-program.js";
import { runLoweringPipeline } from "./pipeline.js";
import type {
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringPipelineResult,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
} from "./types.js";

const lowerProgram = (sourceText: string): LoweringPipelineResult => {
  const program = createInlineTstsTestProgram(sourceText);
  try {
    const result = runLoweringPipeline(program, {
      sourceRoot: program.options.sourceRoot,
      rootNamespace: program.options.rootNamespace,
      backendTargetId: "native",
    });
    if (!result.ok) {
      throw new Error(
        result.error
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join("\n")
      );
    }
    return result.value;
  } finally {
    program.cleanup();
  }
};

const lowerFiles = (
  files: Readonly<Record<string, string>>,
  entryRelativePath: string
): LoweringPipelineResult => {
  const program = createTstsTestProgramFromFiles(files, entryRelativePath);
  try {
    const result = runLoweringPipeline(program, {
      sourceRoot: program.options.sourceRoot,
      rootNamespace: program.options.rootNamespace,
      backendTargetId: "native",
    });
    if (!result.ok) {
      throw new Error(
        result.error
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join("\n")
      );
    }
    return result.value;
  } finally {
    program.cleanup();
  }
};

const firstExpression = (
  result: LoweringPipelineResult,
  predicate: (expression: LoweringExpressionPlan) => boolean
): LoweringExpressionPlan => {
  const match = result.modules
    .flatMap((module) => [
      ...module.declarations.flatMap(collectDeclarationExpressions),
      ...module.topLevelStatements.flatMap(collectStatementExpressions),
    ])
    .find(predicate);
  if (match) return match;
  throw new Error("Expected lowering expression was not found.");
};

const collectExpressionExpressions = (
  expression: LoweringExpressionPlan | undefined
): readonly LoweringExpressionPlan[] => {
  if (!expression) return [];
  const directChildren = [
    expression.expression,
    expression.left,
    expression.right,
    expression.condition,
    expression.whenTrue,
    expression.whenFalse,
    ...expression.arguments,
    ...expression.elements,
    ...expression.properties.map((property) => property.expression),
    ...expression.templateParts
      .map((part) => part.expression)
      .filter((part): part is LoweringExpressionPlan => part !== undefined),
  ];
  return [
    expression,
    ...directChildren.flatMap((child) => collectExpressionExpressions(child)),
    ...expression.parameters.flatMap((parameter) =>
      collectExpressionExpressions(parameter.initializer)
    ),
    ...collectStatementExpressions(expression.body),
  ];
};

const collectStatementExpressions = (
  statement: LoweringStatementPlan | undefined
): readonly LoweringExpressionPlan[] => {
  if (!statement) return [];
  return [
    ...collectExpressionExpressions(statement.expression),
    ...collectExpressionExpressions(statement.condition),
    ...collectExpressionExpressions(statement.incrementor),
    ...collectExpressionExpressions(statement.iterable),
    ...collectStatementExpressions(statement.thenStatement),
    ...collectStatementExpressions(statement.elseStatement),
    ...collectStatementExpressions(statement.body),
    ...collectStatementExpressions(statement.tryBlock),
    ...collectStatementExpressions(statement.catchBlock),
    ...collectStatementExpressions(statement.finallyBlock),
    ...statement.statements.flatMap(collectStatementExpressions),
    ...statement.declarations.flatMap((declaration) =>
      collectExpressionExpressions(declaration.initializer)
    ),
    ...statement.cases.flatMap((switchCase) => [
      ...collectExpressionExpressions(switchCase.expression),
      ...switchCase.statements.flatMap(collectStatementExpressions),
    ]),
  ];
};

const collectDeclarationExpressions = (
  declaration: LoweringDeclarationPlan
): readonly LoweringExpressionPlan[] => [
  ...collectExpressionExpressions(declaration.initializer),
  ...declaration.parameters.flatMap((parameter) =>
    collectExpressionExpressions(parameter.initializer)
  ),
  ...declaration.attributes.flatMap((attribute) => [
    ...collectExpressionExpressions(attribute.attributeType),
    ...attribute.arguments.flatMap(collectExpressionExpressions),
  ]),
  ...declaration.constructorAttributes.flatMap((attribute) => [
    ...collectExpressionExpressions(attribute.attributeType),
    ...attribute.arguments.flatMap(collectExpressionExpressions),
  ]),
  ...collectStatementExpressions(declaration.body),
  ...declaration.members.flatMap(collectDeclarationExpressions),
  ...declaration.enumMembers.flatMap((member) =>
    collectExpressionExpressions(member.initializer)
  ),
];

const expectSourcePrimitive = (
  type: LoweringTypeRefPlan | undefined,
  kind: string
): void => {
  expect(type?.kind).to.equal("source-primitive");
  if (type?.kind === "source-primitive") {
    expect(type.fact.kind).to.equal(kind);
  }
};

describe("TSTS-backed lowering plan builders", () => {
  it("preserves explicit source primitive facts at expression use-sites", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      export function read(value: int): int {
        const copy: int = value;
        return copy;
      }
    `);

    const valueUse = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "identifier" &&
        expression.literalText === "value" &&
        expression.type?.kind === "source-primitive"
    );
    const copyUse = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "identifier" &&
        expression.literalText === "copy" &&
        expression.type?.kind === "source-primitive"
    );

    expectSourcePrimitive(valueUse.type, "int32");
    expectSourcePrimitive(copyUse.type, "int32");
  });

  it("pushes char expected type into binary string literals and arrays", () => {
    const result = lowerProgram(`
      import type { char } from "@tsonic/core/types.js";

      export function read(letter: char): char[] {
        const same = letter === "A";
        return ["x", letter];
      }
    `);

    const comparisonLiteral = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "literal" &&
        expression.literalKind === "string" &&
        expression.literalText === "A"
    );
    const arrayLiteral = firstExpression(
      result,
      (expression) => expression.expressionKind === "array-literal"
    );
    const arrayStringLiteral = arrayLiteral.elements.find(
      (expression) =>
        expression.expressionKind === "literal" &&
        expression.literalKind === "string" &&
        expression.literalText === "x"
    );

    expectSourcePrimitive(comparisonLiteral.contextualTypePlan, "char");
    expectSourcePrimitive(arrayStringLiteral?.contextualTypePlan, "char");
  });

  it("does not force multi-character string arguments through char-compatible overloads", () => {
    const result = lowerProgram(`
      import type { char } from "@tsonic/core/types.js";

      declare function write(value: char): void;
      declare function write(value: string | null): void;

      export function run(): void {
        write("WRITE");
        write("A");
      }
    `);

    const wordLiteral = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "literal" &&
        expression.literalKind === "string" &&
        expression.literalText === "WRITE"
    );
    const charLiteral = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "literal" &&
        expression.literalKind === "string" &&
        expression.literalText === "A"
    );

    expect(wordLiteral.contextualTypePlan?.kind).to.not.equal(
      "source-primitive"
    );
    expectSourcePrimitive(charLiteral.contextualTypePlan, "char");
  });

  it("uses TSTS contextual callable types for arrows inside aliased arrays", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      type Op = (value: int) => int;
      export const ops: Op[] = [(value) => value];
    `);

    const arrow = firstExpression(
      result,
      (expression) => expression.expressionKind === "arrow-function"
    );

    expect(arrow.parameters).to.have.length(1);
    expectSourcePrimitive(arrow.parameters[0]?.type, "int32");
    expectSourcePrimitive(arrow.returnType, "int32");
  });

  it("uses TSTS callable-interface projections for contextual arrows", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      interface Op { (value: int): int; }
      export const ops: Op[] = [(value) => value];
    `);

    const arrow = firstExpression(
      result,
      (expression) => expression.expressionKind === "arrow-function"
    );

    expect(arrow.parameters).to.have.length(1);
    expectSourcePrimitive(arrow.parameters[0]?.type, "int32");
    expectSourcePrimitive(arrow.returnType, "int32");
  });

  it("expands recursive aliases without recursively expanding the same target", () => {
    const result = lowerProgram(`
      type Node = { next?: Node };
      export const root: Node = {};
    `);

    const [module] = result.modules;
    const [statement] = module?.topLevelStatements ?? [];
    const [declaration] = statement?.declarations ?? [];
    const type = declaration?.type;

    expect(type?.kind).to.equal("named");
    expect(
      type?.kind === "named" ? type.aliasTarget?.kind : undefined
    ).to.equal("object");
    const nextMember =
      type?.kind === "named" && type.aliasTarget?.kind === "object"
        ? type.aliasTarget.members.find(
            (member) =>
              member.kind !== "index-signature" && member.name === "next"
          )
        : undefined;

    expect(nextMember?.kind).to.equal("property");
    if (nextMember?.kind === "property") {
      expect(nextMember.type?.kind).to.equal("named");
      expect(
        nextMember.type?.kind === "named"
          ? nextMember.type.aliasTarget
          : undefined
      ).to.equal(undefined);
    }
  });

  it("excludes ECMAScript private fields from structural shape targets", () => {
    const result = lowerProgram(`
      class Response {
        #header = "";
        append_one(field: string, value: string): void {
          this.#header = field + ":" + value;
        }
      }

      export const response: Response = new Response();
    `);

    const variable = result.modules
      .flatMap((module) => module.topLevelStatements)
      .flatMap((statement) => statement.declarations)
      .find((declaration) => declaration.name === "response");
    const members =
      variable?.type?.kind === "named" && variable.type.aliasTarget?.kind === "object"
        ? variable.type.aliasTarget.members
        : [];

    expect(
      members.some(
        (member) => member.kind === "property" && member.name === "__private_header"
      )
    ).to.equal(false);
    expect(
      members.some((member) => member.kind === "method" && member.name === "append_one")
    ).to.equal(true);
  });

  it("keeps source-runtime iterator declarations named instead of expanding recursive members", () => {
    const result = lowerFiles(
      {
        "node_modules/@tsonic/js/package.json": JSON.stringify({
          name: "@tsonic/js",
          version: "0.0.0-test",
          type: "module",
        }),
        "node_modules/@tsonic/js/tsonic.package.json": JSON.stringify({
          kind: "tsonic-source-package",
          source: {
            namespace: "js",
            exports: {
              "./iter.js": "./iter.ts",
            },
          },
        }),
        "node_modules/@tsonic/js/iter.ts": [
          "export interface Iterator<T> {",
          "  next(): IteratorResult<T>;",
          "}",
          "export interface IteratorResult<T> {",
          "  value: T;",
          "  done: boolean;",
          "}",
          "export interface IterableIterator<T> extends Iterator<T> {",
          "  self(): IterableIterator<T>;",
          "}",
          "",
        ].join("\n"),
        "index.ts": [
          'import type { IterableIterator } from "@tsonic/js/iter.js";',
          "export function read(value: IterableIterator<string>): IterableIterator<string> {",
          "  return value;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );

    const declaration = result.modules
      .flatMap((module) => module.declarations)
      .find(
        (candidate) =>
          candidate.declarationKind === "function" && candidate.name === "read"
      );
    const returnType = declaration?.returnType;

    expect(returnType?.kind).to.equal("named");
    if (returnType?.kind === "named") {
      expect(returnType.name).to.equal("IterableIterator");
      expect(returnType.runtimeVisibility).to.equal("opaque");
      expect(returnType.aliasTarget).to.equal(undefined);
      expect(returnType.sourceQualifiedName).to.deep.equal({
        namespace: "js._",
        name: "IterableIterator",
      });
    }
  });

  it("treats standard NonNullable as compile-time-only during type planning", () => {
    const result = lowerProgram(`
      export const text: NonNullable<string | null | undefined> = "x";
    `);

    const [module] = result.modules;
    const [statement] = module?.topLevelStatements ?? [];
    const [declaration] = statement?.declarations ?? [];
    const type = declaration?.type;

    expect(type?.kind).to.equal("intrinsic");
    if (type?.kind === "intrinsic") {
      expect(type.name).to.equal("string");
    }
  });

  it("erases conditional and mapped aliases to TSTS-projected storage types", () => {
    const result = lowerProgram(`
      type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
      type NullableProps<T> = { [K in keyof T]: T[K] | undefined };
      interface Person { name: string; age: number; }

      export const value: UnwrapPromise<Promise<number>> = 42;
      export const person: NullableProps<Person> = { name: "Alice", age: 30 };
    `);

    const [module] = result.modules;
    const [valueDeclaration, personDeclaration] =
      module?.topLevelStatements.flatMap((statement) => statement.declarations) ??
      [];

    expect(valueDeclaration?.type).to.deep.include({
      kind: "intrinsic",
      name: "number",
    });
    expect(personDeclaration?.type?.kind).to.equal("object");
    if (personDeclaration?.type?.kind === "object") {
      expect(
        personDeclaration.type.members
          .filter((member) => member.kind === "property")
          .map((member) => member.name)
      ).to.deep.equal(["name", "age"]);
    }
  });

  it("uses TSTS alias bindings instead of source-file text scans", () => {
    const result = lowerFiles(
      {
        "lib.ts": `
          import type { int } from "@tsonic/core/types.js";
          export type Box = { actual: int };
        `,
        "index.ts": `
          import type { Box } from "./lib.js";

          export function read(value: Box): Box {
            type Box = { wrong: string };
            return value;
          }
        `,
      },
      "index.ts"
    );

    const read = result.modules.flatMap((module) => module.declarations).find(
      (declaration) => declaration.name === "read"
    );
    const parameterType = read?.parameters[0]?.type;
    const aliasTarget =
      parameterType?.kind === "named" ? parameterType.aliasTarget : parameterType;
    const members = aliasTarget?.kind === "object" ? aliasTarget.members : [];
    const actualMember = members.find(
      (member) => member.kind === "property" && member.name === "actual"
    );
    const wrongMember = members.find(
      (member) => member.kind === "property" && member.name === "wrong"
    );

    expect(aliasTarget?.kind).to.equal("object");
    expect(wrongMember).to.equal(undefined);
    expect(actualMember?.kind).to.equal("property");
    if (actualMember?.kind === "property") {
      expectSourcePrimitive(actualMember.type, "int32");
    }
  });

  it("resolves source primitive return types across module signatures", () => {
    const result = lowerFiles(
      {
        "math.ts": `
          import type { int } from "@tsonic/core/types.js";
          export function identity(value: int): int { return value; }
        `,
        "index.ts": `
          import { identity } from "./math.js";
          export const answer = identity(42);
        `,
      },
      "index.ts"
    );

    const call = firstExpression(
      result,
      (expression) => expression.expressionKind === "call"
    );

    expectSourcePrimitive(call.type, "int32");
  });

  it("projects opaque runtime visibility from source facts", () => {
    const result = lowerFiles(
      {
        "index.ts": `
          import type { JsValue } from "@tsonic/core/types.js";

          export function use(value: JsValue): void {
            void value;
          }
        `,
      },
      "index.ts"
    );

    const declaration = result.modules
      .flatMap((module) => module.declarations)
      .find((entry) => entry.name === "use");
    const parameterType = declaration?.parameters[0]?.type;

    expect(parameterType?.kind).to.equal("named");
    expect(
      parameterType?.kind === "named"
        ? {
            name: parameterType.name,
            visibility: parameterType.runtimeVisibility,
          }
        : undefined
    ).to.deep.equal({ name: "JsValue", visibility: "opaque" });
  });

  it("projects ambient Record references into dictionary type plans", () => {
    const result = lowerFiles(
      {
        "local.ts": `
          type Record<K, T> = { readonly local: T };
          export const localTable: Record<string, number> = { local: 1 };
        `,
        "index.ts": `
          import { localTable } from "./local.js";
          export const table: Record<string, number> = { count: 1 };
          export const local = localTable;
        `,
      },
      "index.ts"
    );

    const indexModule = result.modules.find((module) =>
      module.sourceFile.FileName().endsWith("/index.ts")
    );
    const localModule = result.modules.find((module) =>
      module.sourceFile.FileName().endsWith("/local.ts")
    );
    const tableType = indexModule?.topLevelStatements[0]?.declarations[0]?.type;
    const localTableType =
      localModule?.topLevelStatements[0]?.declarations[0]?.type;

    expect(tableType?.kind).to.equal("record");
    if (tableType?.kind === "record") {
      expect(tableType.keyType).to.deep.include({
        kind: "intrinsic",
        name: "string",
      });
      expect(tableType.valueType).to.deep.include({
        kind: "intrinsic",
        name: "number",
      });
    }
    expect(localTableType?.kind).to.equal("named");
  });

  it("does not pick an arbitrary first union arm for destructured binding types", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      type Same = { value: int } | { value: int };
      type Different = { value: int } | { value: string };

      export function readSame(input: Same): int {
        const { value } = input;
        return value;
      }

      export function readDifferent(input: Different): void {
        const { value } = input;
        void value;
      }
    `);

    const readSame = result.modules
      .flatMap((module) => module.declarations)
      .find((declaration) => declaration.name === "readSame");
    const readDifferent = result.modules
      .flatMap((module) => module.declarations)
      .find((declaration) => declaration.name === "readDifferent");
    const sameValue =
      readSame?.body?.statements[0]?.declarations[0]?.bindingElements[0];
    const differentValue =
      readDifferent?.body?.statements[0]?.declarations[0]?.bindingElements[0];

    expectSourcePrimitive(sameValue?.type, "int32");
    expect(differentValue?.type?.kind).to.equal("union");
    if (differentValue?.type?.kind === "union") {
      const [numberArm, stringArm] = differentValue.type.types;
      expectSourcePrimitive(numberArm, "int32");
      expect(stringArm).to.deep.include({
        kind: "intrinsic",
        name: "string",
      });
    }
  });

  it("uses the exact tuple index for element-access storage", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      export function read(pair: [int, string]): void {
        const first = pair[0];
        const second = pair[1];
        void first;
        void second;
      }
    `);

    const firstAccess = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "element-access" &&
        expression.arguments[0]?.literalText === "0"
    );
    const secondAccess = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "element-access" &&
        expression.arguments[0]?.literalText === "1"
    );

    expectSourcePrimitive(firstAccess.storageTypePlan, "int32");
    expect(secondAccess.storageTypePlan).to.deep.include({
      kind: "intrinsic",
      name: "string",
    });
  });

  it("lowers TSTS-proven generic function use-site type arguments", () => {
    const result = lowerProgram(`
      import type { int } from "@tsonic/core/types.js";

      function id<T>(value: T): T {
        return value;
      }

      export const monomorphic: (value: int) => int = id;
    `);

    const idUse = firstExpression(
      result,
      (expression) =>
        expression.expressionKind === "identifier" &&
        expression.literalText === "id" &&
        expression.genericFunctionUseSiteTypeArguments !== undefined
    );

    expectSourcePrimitive(
      idUse.genericFunctionUseSiteTypeArguments?.[0],
      "int32"
    );
  });

  it("projects marker source facts into declaration and parameter plans", () => {
    const result = lowerProgram(`
      import type { int, struct } from "@tsonic/core/types.js";
      import type { field, Interface, thisarg } from "@tsonic/core/lang.js";

      export interface Point extends struct {
        x: field<int>;
        y: int;
      }

      export interface Contract {}
      export class Service implements Interface<Contract> {}
      export function inc(value: thisarg<int>): int {
        return value;
      }
    `);

    const [module] = result.modules;
    const point = module?.declarations.find(
      (declaration) => declaration.name === "Point"
    );
    const service = module?.declarations.find(
      (declaration) => declaration.name === "Service"
    );
    const inc = module?.declarations.find(
      (declaration) => declaration.name === "inc"
    );

    expect(point?.sourceTypeKind).to.equal("struct");
    expect(point?.heritageTypes).to.deep.equal([]);
    expect(
      point?.members.find((member) => member.name === "x")?.fieldSemantics
    ).to.equal("field");
    expect(
      point?.members.find((member) => member.name === "y")?.fieldSemantics
    ).to.equal(undefined);
    expect(service?.heritageTypes).to.deep.equal([]);
    expect(inc?.parameters[0]?.extensionReceiver).to.equal(true);
  });

  it("projects attribute source facts into declaration plans", () => {
    const result = lowerFiles(
      {
        "node_modules/@tsonic/core/lang.js": [
          "export const attributes = undefined;",
          "export const AttributeTargets = undefined;",
          "",
        ].join("\n"),
        "node_modules/@tsonic/core/lang.d.ts": [
          "export type AttributeTarget = 'field' | 'return';",
          "export interface AttributeTargets { readonly return: 'return'; }",
          "export declare const AttributeTargets: AttributeTargets;",
          "export interface AttributeTargetBuilder {",
          "  target(target: AttributeTarget): AttributeTargetBuilder;",
          "  add(attributeType: unknown, ...args: readonly unknown[]): void;",
          "}",
          "export interface TypeAttributeBuilder<T> extends AttributeTargetBuilder {",
          "  readonly ctor: AttributeTargetBuilder;",
          "  method<TMember>(selector: (value: T) => TMember): AttributeTargetBuilder;",
          "  prop<TMember>(selector: (value: T) => TMember): AttributeTargetBuilder;",
          "}",
          "export interface AttributesApi {",
          "  <T>(): TypeAttributeBuilder<T>; ",
          "  attr(attributeType: unknown, ...args: readonly unknown[]): unknown;",
          "}",
          "export declare const attributes: AttributesApi;",
          "",
        ].join("\n"),
        "index.ts": `
          import { attributes as A, AttributeTargets } from "@tsonic/core/lang.js";

          class ObsoleteAttribute { constructor(message?: string) { void message; } }
          class SerializableAttribute {}

          export class User {
            name: string = "";
            constructor() {}
            save(): string { return this.name; }
          }

          export class NoCtor {}

          const descriptor = A.attr(SerializableAttribute, "type");
          A<User>().add(descriptor);
          A<User>().ctor.add(ObsoleteAttribute, "ctor");
          A<User>().method((u) => u.save).target(AttributeTargets.return).add(ObsoleteAttribute, "method");
          A<User>().prop((u) => u.name).target("field").add(ObsoleteAttribute, "prop");
          A<NoCtor>().ctor.add(ObsoleteAttribute, "implicit");
        `,
      },
      "index.ts"
    );

    const [module] = result.modules;
    const user = module?.declarations.find(
      (declaration) => declaration.name === "User"
    );
    const noCtor = module?.declarations.find(
      (declaration) => declaration.name === "NoCtor"
    );
    const constructor = user?.members.find(
      (member) => member.declarationKind === "constructor"
    );
    const method = user?.members.find((member) => member.name === "save");
    const property = user?.members.find((member) => member.name === "name");

    expect(user?.attributes[0]?.attributeType.literalText).to.equal(
      "SerializableAttribute"
    );
    expect(user?.attributes[0]?.arguments[0]?.literalText).to.equal("type");
    expect(constructor?.attributes[0]?.arguments[0]?.literalText).to.equal(
      "ctor"
    );
    expect(method?.attributes[0]?.targetSpecifier).to.equal("return");
    expect(method?.attributes[0]?.arguments[0]?.literalText).to.equal("method");
    expect(property?.attributes[0]?.targetSpecifier).to.equal("field");
    expect(property?.attributes[0]?.arguments[0]?.literalText).to.equal("prop");
    expect(
      noCtor?.constructorAttributes[0]?.arguments[0]?.literalText
    ).to.equal("implicit");
  });
});
