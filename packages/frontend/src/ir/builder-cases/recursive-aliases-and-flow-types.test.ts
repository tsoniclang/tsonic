/**
 * IR Builder tests: Recursive alias identity, generic base-class overrides, and flow type refreshing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrExpression,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrReturnStatement,
  IrType,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – recursive aliases and flow types", () => {
    it("preserves direct recursive alias identity in source parameters and returns", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
            "export function combine(left: PathSpec, right: PathSpec): PathSpec {",
            "  return left ?? right;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const combineFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "combine"
        );
        expect(combineFn).to.not.equal(undefined);
        if (!combineFn) return;

        const assertAliasReference = (
          type: IrType | undefined,
          expectedName: string
        ): void => {
          expect(type?.kind).to.equal("referenceType");
          if (!type || type.kind !== "referenceType") return;
          expect(type.name).to.equal(expectedName);
          expect(type.typeId?.tsName).to.equal(expectedName);
        };

        assertAliasReference(combineFn.parameters[0]?.type, "PathSpec");
        assertAliasReference(combineFn.parameters[1]?.type, "PathSpec");
        assertAliasReference(combineFn.returnType, "PathSpec");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves mutually recursive alias identity in source parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "class Router {}",
            "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
            "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
            "export function mount(first: MiddlewareLike, rest: readonly MiddlewareLike[]): readonly MiddlewareLike[] {",
            "  return [first, ...rest];",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const mountFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "mount"
        );
        expect(mountFn).to.not.equal(undefined);
        if (!mountFn) return;

        expect(mountFn.parameters[0]?.type?.kind).to.equal("referenceType");
        if (mountFn.parameters[0]?.type?.kind === "referenceType") {
          expect(mountFn.parameters[0].type.name).to.equal("MiddlewareLike");
          expect(mountFn.parameters[0].type.typeId?.tsName).to.equal(
            "MiddlewareLike"
          );
        }

        expect(mountFn.parameters[1]?.type?.kind).to.equal("arrayType");
        if (mountFn.parameters[1]?.type?.kind === "arrayType") {
          expect(mountFn.parameters[1].type.origin).to.equal("explicit");
          expect(mountFn.parameters[1].type.elementType.kind).to.equal(
            "referenceType"
          );
          if (mountFn.parameters[1].type.elementType.kind === "referenceType") {
            expect(mountFn.parameters[1].type.elementType.name).to.equal(
              "MiddlewareLike"
            );
            expect(
              mountFn.parameters[1].type.elementType.typeId?.tsName
            ).to.equal("MiddlewareLike");
          }
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("marks generic base-class overrides after substituting superclass type arguments", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class ComparableShowable<T> {",
            "  compareTo(other: T): number {",
            "    void other;",
            "    return 0;",
            "  }",
            "  show(): string {",
            '    return "base";',
            "  }",
            "}",
            "",
            "export class NumberValue extends ComparableShowable<NumberValue> {",
            "  override compareTo(other: NumberValue): number {",
            "    void other;",
            "    return 1;",
            "  }",
            "  override show(): string {",
            '    return "derived";',
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const numberValueClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "NumberValue"
        );
        expect(numberValueClass).to.not.equal(undefined);
        if (!numberValueClass) return;

        const compareTo = numberValueClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "compareTo"
        );
        expect(compareTo).to.not.equal(undefined);
        expect(compareTo?.isOverride).to.equal(true);

        const show = numberValueClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "show"
        );
        expect(show).to.not.equal(undefined);
        expect(show?.isOverride).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("refreshes local flow types after reassignment following terminating nullish guards", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class ImageDimensions {",
            "  readonly width: number;",
            "  constructor(width: number) {",
            "    this.width = width;",
            "  }",
            "}",
            "",
            "declare const Resource: {",
            "  parsePngDimensions(bytes: string): ImageDimensions | undefined;",
            "  parseJpegDimensions(bytes: string): ImageDimensions | undefined;",
            "  parseGifDimensions(bytes: string): ImageDimensions | undefined;",
            "};",
            "",
            "export function parseImageDimensions(bytes: string): ImageDimensions | undefined {",
            "  let dims = Resource.parsePngDimensions(bytes);",
            "  if (dims !== undefined) return dims;",
            "  dims = Resource.parseJpegDimensions(bytes);",
            "  if (dims !== undefined) return dims;",
            "  dims = Resource.parseGifDimensions(bytes);",
            "  if (dims !== undefined) return dims;",
            "  return undefined;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" &&
            stmt.name === "parseImageDimensions"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const ifStatements = fn.body.statements.filter(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStatements).to.have.length(3);

        const secondIf = ifStatements[1];
        expect(secondIf?.condition.kind).to.equal("binary");
        if (!secondIf || secondIf.condition.kind !== "binary") {
          return;
        }
        expect(secondIf.condition.left.kind).to.equal("identifier");
        if (secondIf.condition.left.kind !== "identifier") {
          return;
        }
        expect(secondIf.condition.left.inferredType?.kind).to.equal(
          "unionType"
        );

        const secondReturn =
          secondIf.thenStatement.kind === "returnStatement"
            ? secondIf.thenStatement
            : undefined;
        expect(secondReturn?.expression).to.not.equal(undefined);
        if (!secondReturn?.expression) {
          return;
        }
        expect(secondReturn.expression.kind).to.equal("typeAssertion");
        if (secondReturn.expression.kind !== "typeAssertion") {
          return;
        }
        expect(secondReturn.expression.targetType?.kind).to.equal(
          "referenceType"
        );
        if (secondReturn.expression.targetType?.kind !== "referenceType") {
          return;
        }
        expect(secondReturn.expression.targetType.name).to.equal(
          "ImageDimensions"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("substitutes inherited generic member types across renamed superclass type parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class Box<T> {",
            "  value: T;",
            "  constructor(value: T) {",
            "    this.value = value;",
            "  }",
            "}",
            "",
            "export class WrappedBox<U> extends Box<U> {",
            "  wrap(): Box<U> {",
            "    return new Box(this.value);",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const wrappedBoxClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "WrappedBox"
        );
        expect(wrappedBoxClass).to.not.equal(undefined);
        if (!wrappedBoxClass) return;

        const wrap = wrappedBoxClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "wrap"
        );
        expect(wrap).to.not.equal(undefined);
        if (!wrap) return;
        expect(wrap.body).to.not.equal(undefined);
        if (!wrap.body) return;

        expect(wrap.returnType?.kind).to.equal("referenceType");
        if (!wrap.returnType || wrap.returnType.kind !== "referenceType") {
          return;
        }
        expect(wrap.returnType.name).to.equal("Box");
        expect(wrap.returnType.typeArguments).to.deep.equal([
          { kind: "typeParameterType", name: "U" },
        ]);
        expect(wrap.returnType.structuralMembers).to.deep.equal([
          {
            kind: "propertySignature",
            name: "value",
            type: { kind: "typeParameterType", name: "U" },
            isOptional: false,
            isReadonly: false,
          },
        ]);

        const returnStmt = wrap.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const returnExpr = (returnStmt as IrReturnStatement).expression;
        expect(returnExpr?.kind).to.equal("new");
        if (!returnExpr || returnExpr.kind !== "new") return;

        expect(returnExpr.inferredType?.kind).to.equal("referenceType");
        if (returnExpr.inferredType?.kind !== "referenceType") return;
        expect(returnExpr.inferredType.name).to.equal("Box");
        expect(returnExpr.inferredType.typeArguments).to.deep.equal([
          { kind: "typeParameterType", name: "U" },
        ]);
        expect(returnExpr.typeArguments).to.deep.equal([
          { kind: "typeParameterType", name: "U" },
        ]);

        const valueArg = returnExpr.arguments[0];
        expect(valueArg?.kind).to.equal("memberAccess");
        if (!valueArg || valueArg.kind !== "memberAccess") return;

        expect(valueArg.inferredType).to.deep.equal({
          kind: "typeParameterType",
          name: "U",
        });

        const thisExpr = valueArg.object as IrExpression | undefined;
        expect(thisExpr?.kind).to.equal("this");
        if (!thisExpr || thisExpr.kind !== "this") return;

        expect(thisExpr.inferredType).to.deep.equal({
          kind: "referenceType",
          name: "WrappedBox",
          typeArguments: [{ kind: "typeParameterType", name: "U" }],
        });
      } finally {
        fixture.cleanup();
      }
    });
  });
});
