import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";
import type { TypeMemberKind } from "../emitter-types/core.js";

const makeModule = (body: IrModule["body"]): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "MyApp",
  className: "test",
  isStaticContainer: true,
  imports: [],
  body,
  exports: [],
});

describe("Emitter precedence + parentheses", () => {
  it("wraps `??` when used as an operand of `||` (C# precedence differs)", () => {
    const module = makeModule([
      {
        kind: "expressionStatement",
        expression: {
          kind: "logical",
          operator: "||",
          left: {
            kind: "logical",
            operator: "??",
            inferredType: { kind: "primitiveType", name: "boolean" },
            left: {
              kind: "identifier",
              name: "a",
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "primitiveType", name: "null" },
                ],
              },
            },
            right: {
              kind: "identifier",
              name: "b",
              inferredType: { kind: "primitiveType", name: "boolean" },
            },
          },
          right: {
            kind: "identifier",
            name: "c",
            inferredType: { kind: "primitiveType", name: "boolean" },
          },
        },
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("(a ?? b) || c");
  });

  it("emits `??` as right-associative (`a ?? (b ?? c)`)", () => {
    const module = makeModule([
      {
        kind: "expressionStatement",
        expression: {
          kind: "logical",
          operator: "??",
          left: {
            kind: "identifier",
            name: "a",
            inferredType: {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "string" },
                { kind: "primitiveType", name: "null" },
              ],
            },
          },
          right: {
            kind: "logical",
            operator: "??",
            left: {
              kind: "identifier",
              name: "b",
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "string" },
                  { kind: "primitiveType", name: "null" },
                ],
              },
            },
            right: {
              kind: "identifier",
              name: "c",
              inferredType: { kind: "primitiveType", name: "string" },
            },
          },
        },
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("a ?? (b ?? c)");
  });

  it("preserves boolean-context grouping with parentheses in conditions", () => {
    const module = makeModule([
      {
        kind: "ifStatement",
        condition: {
          kind: "logical",
          operator: "&&",
          left: {
            kind: "logical",
            operator: "||",
            left: {
              kind: "identifier",
              name: "a",
              inferredType: { kind: "primitiveType", name: "boolean" },
            },
            right: {
              kind: "identifier",
              name: "b",
              inferredType: { kind: "primitiveType", name: "boolean" },
            },
          },
          right: {
            kind: "identifier",
            name: "c",
            inferredType: { kind: "primitiveType", name: "boolean" },
          },
        },
        thenStatement: { kind: "blockStatement", statements: [] },
        elseStatement: undefined,
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("if ((a || b) && c)");
  });

  it("wraps low-precedence boolean-context expressions before appending comparisons", () => {
    const module = makeModule([
      {
        kind: "ifStatement",
        condition: {
          kind: "logical",
          operator: "??",
          inferredType: { kind: "primitiveType", name: "int" },
          left: {
            kind: "identifier",
            name: "a",
            inferredType: {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "int" },
                { kind: "primitiveType", name: "null" },
              ],
            },
          },
          right: {
            kind: "identifier",
            name: "b",
            inferredType: { kind: "primitiveType", name: "int" },
          },
        },
        thenStatement: { kind: "blockStatement", statements: [] },
        elseStatement: undefined,
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("if (((a ?? b) != 0))");
  });

  it("parenthesizes `as` results before postfix member access", () => {
    const module = makeModule([
      {
        kind: "expressionStatement",
        expression: {
          kind: "memberAccess",
          object: {
            kind: "trycast",
            expression: { kind: "identifier", name: "x" },
            targetType: { kind: "primitiveType", name: "string" },
            inferredType: {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "string" },
                { kind: "primitiveType", name: "null" },
              ],
            },
          },
          property: "Length",
          isComputed: false,
          isOptional: false,
        },
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("(x as string).Length");
  });

  it("parenthesizes cast expressions before postfix member access", () => {
    const module = makeModule([
      {
        kind: "expressionStatement",
        expression: {
          kind: "call",
          callee: {
            kind: "memberAccess",
            object: {
              kind: "typeAssertion",
              expression: { kind: "identifier", name: "x" },
              targetType: { kind: "primitiveType", name: "int" },
              inferredType: { kind: "primitiveType", name: "int" },
            },
            property: "ToString",
            isComputed: false,
            isOptional: false,
          },
          arguments: [],
          isOptional: false,
        },
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("((int)x).ToString()");
  });

  it("does not wrap conditional access chains when continuing postfix access", () => {
    const module = makeModule([
      {
        kind: "expressionStatement",
        expression: {
          kind: "memberAccess",
          object: {
            kind: "memberAccess",
            object: { kind: "identifier", name: "x" },
            property: "Y",
            isComputed: false,
            isOptional: true,
          },
          property: "Z",
          isComputed: false,
          isOptional: false,
        },
      },
    ]);

    const result = emitModule(module);
    expect(result).to.include("x?.Y.Z");
    expect(result).not.to.include("(x?.Y).Z");
  });

  it("wraps lowered `in`-guard OR chains so surrounding boolean operators keep meaning", () => {
    const typeMemberIndex = new Map<string, Map<string, TypeMemberKind>>([
      ["MyApp.A", new Map<string, TypeMemberKind>([["prop", "property"]])],
      ["MyApp.B", new Map<string, TypeMemberKind>([["prop", "property"]])],
    ]);

    const module = makeModule([
      {
        kind: "ifStatement",
        condition: {
          kind: "logical",
          operator: "&&",
          left: {
            kind: "binary",
            operator: "in",
            inferredType: { kind: "primitiveType", name: "boolean" },
            left: { kind: "literal", value: "prop" },
            right: {
              kind: "identifier",
              name: "x",
              inferredType: {
                kind: "unionType",
                types: [
                  { kind: "referenceType", name: "MyApp.A" },
                  { kind: "referenceType", name: "MyApp.B" },
                ],
              },
            },
          },
          right: {
            kind: "identifier",
            name: "ok",
            inferredType: { kind: "primitiveType", name: "boolean" },
          },
        },
        thenStatement: { kind: "blockStatement", statements: [] },
        elseStatement: undefined,
      },
    ]);

    const result = emitModule(module, { typeMemberIndex });
    expect(result).to.include("if ((x.Is1() || x.Is2()) && ok)");
  });
});
