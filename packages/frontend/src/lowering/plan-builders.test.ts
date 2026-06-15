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
      backendTargetId: "csharp",
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
      backendTargetId: "csharp",
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
    expect(type?.kind === "named" ? type.aliasTarget?.kind : undefined).to.equal(
      "object"
    );
    const nextMember =
      type?.kind === "named" && type.aliasTarget?.kind === "object"
        ? type.aliasTarget.members.find(
            (member) => member.kind !== "index-signature" && member.name === "next"
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
      point?.members.find((member) => member.name === "x")?.storageSemantics
    ).to.equal("field");
    expect(
      point?.members.find((member) => member.name === "y")?.storageSemantics
    ).to.equal(undefined);
    expect(service?.heritageTypes).to.deep.equal([]);
    expect(inc?.parameters[0]?.extensionReceiver).to.equal(true);
  });
});
