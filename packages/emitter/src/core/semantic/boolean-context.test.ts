import { describe, it } from "mocha";
import { expect } from "chai";
import { emitBooleanCondition, toBooleanCondition } from "./boolean-context.js";
import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../types.js";

const defaultOptions: EmitterOptions = {
  rootNamespace: "Test",
  indent: 2,
};

const createContext = (
  patch: Partial<EmitterContext> = {}
): EmitterContext => ({
  indentLevel: 0,
  options: defaultOptions,
  isStatic: false,
  isAsync: false,
  usedLocalNames: new Set<string>(),
  usings: new Set<string>(),
  ...patch,
});

const prim = (
  name: Extract<IrType, { kind: "primitiveType" }>["name"]
): IrType => ({ kind: "primitiveType", name }) as IrType;

const ref = (clrName: string): IrType =>
  ({
    kind: "referenceType",
    name: clrName.split(".").at(-1) ?? clrName,
    resolvedClrType: clrName,
  }) as IrType;

const union = (types: readonly IrType[]): IrType =>
  ({ kind: "unionType", types }) as IrType;

const id = (name: string, inferredType?: IrType): IrExpression =>
  ({ kind: "identifier", name, inferredType }) as IrExpression;

const emitExpr = (
  expr: IrExpression,
  context: EmitterContext
): [{ text: string }, EmitterContext] => {
  switch (expr.kind) {
    case "identifier":
      return [{ text: expr.name }, context];
    case "literal":
      return [
        {
          text:
            typeof expr.value === "string"
              ? JSON.stringify(expr.value)
              : String(expr.value),
        },
        context,
      ];
    case "binary": {
      const lhs = expr.left.kind === "identifier" ? expr.left.name : "lhs";
      const rhs = expr.right.kind === "identifier" ? expr.right.name : "rhs";
      const op =
        expr.operator === "==="
          ? "=="
          : expr.operator === "!=="
            ? "!="
            : expr.operator;
      return [{ text: `${lhs} ${op} ${rhs}` }, context];
    }
    default:
      return [{ text: "__expr" }, context];
  }
};

describe("Boolean-context lowering (emitBooleanCondition/toBooleanCondition)", () => {
  describe("toBooleanCondition", () => {
    it("treats primitive boolean as a condition (no rewriting)", () => {
      const ctx = createContext();
      const expr = id("b", prim("boolean"));
      const [text] = toBooleanCondition(expr, "b", ctx);
      expect(text).to.equal("b");
    });

    it("coerces CLR bool (System.Boolean) surfaced as referenceType into a boolean condition", () => {
      const ctx = createContext();
      const expr = id("bclBool", ref("System.Boolean"));
      const [text] = toBooleanCondition(expr, "bclBool", ctx);
      expect(text).to.equal("bclBool");
    });

    it("coerces CLR int (System.Int32) surfaced as referenceType into `!= 0` truthiness", () => {
      const ctx = createContext();
      const expr = id("bclInt", ref("System.Int32"));
      const [text] = toBooleanCondition(expr, "bclInt", ctx);
      expect(text).to.equal("bclInt != 0");
    });

    it("coerces other CLR primitives surfaced as referenceType via runtime truthiness (no `!= null` boxing bugs)", () => {
      const ctx = createContext({ tempVarId: 0 });

      const longExpr = id("l", ref("System.Int64"));
      const [longText] = toBooleanCondition(longExpr, "l", ctx);
      expect(longText).to.include("long =>");
      expect(longText).to.include("!= 0L");
      expect(longText).to.not.include("!= null");

      const floatExpr = id("f", ref("System.Single"));
      const [floatText] = toBooleanCondition(floatExpr, "f", ctx);
      expect(floatText).to.include("float =>");
      expect(floatText).to.include("!= 0f");
      expect(floatText).to.include("!float.IsNaN");
      expect(floatText).to.not.include("!= null");

      const charExpr = id("c", ref("System.Char"));
      const [charText] = toBooleanCondition(charExpr, "c", ctx);
      expect(charText).to.equal("c != '\\0'");
    });

    it("emits !string.IsNullOrEmpty for primitive strings", () => {
      const ctx = createContext();
      const expr = id("s", prim("string"));
      const [text] = toBooleanCondition(expr, "s", ctx);
      expect(text).to.equal("!string.IsNullOrEmpty(s)");
    });

    it("emits JS truthiness for primitive numbers (false iff 0 or NaN) with a single-eval pattern var", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = id("n", prim("number"));
      const [text, next] = toBooleanCondition(expr, "n", ctx);
      expect(text).to.match(/n is double __tsonic_truthy_num_1/);
      expect(text).to.include("!= 0");
      expect(text).to.include("!double.IsNaN");
      expect(next.tempVarId).to.equal(1);
    });

    it("parenthesizes non-simple numeric expressions (e.g. `a ?? b`) under pattern matching", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = {
        kind: "logical",
        operator: "??",
        left: id("a", prim("number")),
        right: id("b", prim("number")),
        inferredType: prim("number"),
      } as IrExpression;

      const [text, next] = toBooleanCondition(expr, "a ?? b", ctx);
      expect(text).to.match(/\(\(a \?\? b\) is double __tsonic_truthy_num_1/);
      expect(next.tempVarId).to.equal(1);
    });

    it("emits runtime truthiness for unknown/any (never `!= null` fallbacks)", () => {
      const ctx = createContext({ tempVarId: 0 });

      const unknownExpr = id("x", { kind: "unknownType" } as IrType);
      const [unknownText, unknownNext] = toBooleanCondition(
        unknownExpr,
        "x",
        ctx
      );
      expect(unknownText).to.include("switch {");
      expect(unknownText).to.include("bool =>");
      expect(unknownText).to.not.include("!= null");
      expect(unknownNext.tempVarId).to.equal(1);

      const anyExpr = id("y", { kind: "anyType" } as IrType);
      const [anyText, anyNext] = toBooleanCondition(anyExpr, "y", ctx);
      expect(anyText).to.include("switch {");
      expect(anyText).to.include("string =>");
      expect(anyText).to.not.include("!= null");
      expect(anyNext.tempVarId).to.equal(1);
    });

    it("treats comparisons as inherently boolean (no truthiness rewriting)", () => {
      const ctx = createContext();
      const expr = {
        kind: "binary",
        operator: "==",
        left: id("a", prim("int")),
        right: id("b", prim("int")),
        inferredType: prim("boolean"),
      } as IrExpression;

      const [text] = toBooleanCondition(expr, "a == b", ctx);
      expect(text).to.equal("a == b");
    });

    it("handles nullable unions (T | null | undefined) via pattern match to the non-null type", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = id(
        "x",
        union([prim("int"), prim("null"), prim("undefined")])
      );
      const [text, next] = toBooleanCondition(expr, "x", ctx);
      expect(text).to.match(/x is int __tsonic_truthy_nullable_1/);
      expect(text).to.include("__tsonic_truthy_nullable_1 != 0");
      expect(next.tempVarId).to.equal(1);
    });

    it("flattens nullable non-primitive unions to direct runtime truthiness (no nested nullable temp)", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = id(
        "x",
        union([
          { kind: "arrayType", elementType: prim("string") } as IrType,
          prim("null"),
          prim("undefined"),
        ])
      );
      const [text, next] = toBooleanCondition(expr, "x", ctx);
      expect(text).to.match(/x is object __tsonic_truthy_1/);
      expect(text).to.include("switch {");
      expect(text).to.not.include("__tsonic_truthy_nullable_");
      expect(next.tempVarId).to.equal(1);
    });

    it("handles 2-8 unions via IsN/AsN active-variant checks", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = id("u", union([prim("int"), prim("string")]));
      const [text, next] = toBooleanCondition(expr, "u", ctx);
      expect(text).to.match(/u is var __tsonic_truthy_union_1/);
      expect(text).to.include("__tsonic_truthy_union_1.Is1()");
      expect(text).to.include("__tsonic_truthy_union_1.As1()");
      expect(text).to.include("__tsonic_truthy_union_1.As2()");
      expect(next.tempVarId).to.equal(1);
    });

    it("handles literal unions by lowering to the literal base primitive with nullable support", () => {
      const ctx = createContext({ tempVarId: 0 });
      const expr = id(
        "x",
        union([
          { kind: "literalType", value: "a" } as IrType,
          { kind: "literalType", value: "b" } as IrType,
          prim("null"),
        ])
      );

      const [text, next] = toBooleanCondition(expr, "x", ctx);
      expect(text).to.match(/x is string __tsonic_truthy_nullable_1/);
      expect(text).to.include(
        "!string.IsNullOrEmpty(__tsonic_truthy_nullable_1)"
      );
      expect(next.tempVarId).to.equal(1);
    });
  });

  describe("emitBooleanCondition", () => {
    it("applies truthiness to each operand for logical && / || (preserving short-circuit form)", () => {
      const ctx = createContext();

      const expr = {
        kind: "logical",
        operator: "&&",
        left: id("a", prim("int")),
        right: id("b", prim("int")),
        inferredType: prim("int"),
      } as IrExpression;

      const [text] = emitBooleanCondition(expr, emitExpr, ctx);
      expect(text).to.equal("a != 0 && b != 0");
    });

    it("parenthesizes `||` operands when they appear under `&&` so grouping is preserved", () => {
      const ctx = createContext();

      const expr = {
        kind: "logical",
        operator: "&&",
        left: {
          kind: "logical",
          operator: "||",
          left: id("a", prim("int")),
          right: id("b", prim("int")),
          inferredType: prim("int"),
        },
        right: id("c", prim("int")),
        inferredType: prim("int"),
      } as IrExpression;

      const [text] = emitBooleanCondition(expr, emitExpr, ctx);
      expect(text).to.equal("(a != 0 || b != 0) && c != 0");
    });

    it("does not rewrite inherently-boolean expressions", () => {
      const ctx = createContext();

      const expr = {
        kind: "binary",
        operator: "==",
        left: id("a", prim("int")),
        right: id("b", prim("int")),
        inferredType: prim("boolean"),
      } as IrExpression;

      const [text] = emitBooleanCondition(expr, emitExpr, ctx);
      expect(text).to.equal("a == b");
    });

    it("uses runtime truthiness for unknown operands (never `!= null`) while preserving logical operators", () => {
      const ctx = createContext({ tempVarId: 0 });

      const expr = {
        kind: "logical",
        operator: "||",
        left: id("x", { kind: "unknownType" } as IrType),
        right: id("y", prim("boolean")),
        inferredType: { kind: "unknownType" } as IrType,
      } as IrExpression;

      const [text, next] = emitBooleanCondition(expr, emitExpr, ctx);
      expect(text).to.include("switch {");
      expect(text).to.include("|| y");
      expect(text).to.not.include("!= null");
      expect(next.tempVarId).to.equal(1);
    });
  });
});
