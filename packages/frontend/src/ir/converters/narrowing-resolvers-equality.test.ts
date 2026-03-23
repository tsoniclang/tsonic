import { expect } from "chai";
import { describe, it } from "mocha";
import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { DeclId } from "../type-system/index.js";
import type { IrType } from "../types.js";
import { resolveInstanceofTargetType } from "./narrowing-resolvers-equality.js";

const makeDeclId = (id: number): DeclId => ({ id }) as DeclId;

const extractInstanceofRight = (sourceText: string): ts.Expression => {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  if (!statement || !ts.isExpressionStatement(statement)) {
    throw new Error("Expected expression statement");
  }
  const expression = statement.expression;
  if (!ts.isBinaryExpression(expression)) {
    throw new Error("Expected binary expression");
  }
  return expression.right;
};

const createMockContext = (options: {
  readonly resolveIdentifier: (node: ts.Identifier) => DeclId | undefined;
  readonly typeOfDecl?: (declId: DeclId) => IrType;
  readonly typeOfValueRead?: (declId: DeclId) => IrType;
  readonly typeOfMember?: (
    receiver: IrType,
    member: { readonly kind: "byName"; readonly name: string }
  ) => IrType;
  readonly getType?: (
    name: string
  ) => { readonly alias: string; readonly name: string } | undefined;
}): ProgramContext =>
  ({
    binding: {
      resolveIdentifier: options.resolveIdentifier,
    },
    typeSystem: {
      typeOfDecl:
        options.typeOfDecl ??
        (() => ({
          kind: "unknownType",
        })),
      typeOfValueRead:
        options.typeOfValueRead ??
        (() => ({
          kind: "unknownType",
        })),
      typeOfMember:
        options.typeOfMember ??
        (() => ({
          kind: "unknownType",
        })),
    },
    bindings: {
      getType: options.getType ?? (() => undefined),
    },
  }) as unknown as ProgramContext;

describe("narrowing-resolvers-equality", () => {
  it("falls back to binding-backed instance types for imported constructor statics", () => {
    const ecdsaDecl = makeDeclId(1);
    const targetExpr = extractInstanceofRight("value instanceof ECDsa");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "ECDsa" ? ecdsaDecl : undefined,
      typeOfDecl: () => ({
        kind: "intersectionType",
        types: [
          { kind: "anyType" },
          {
            kind: "referenceType",
            name: "__Anon_e08c_ctor",
            structuralMembers: [],
          },
        ],
      }),
      getType: (name) =>
        name === "ECDsa"
          ? {
              alias: "ECDsa",
              name: "System.Security.Cryptography.ECDsa",
            }
          : undefined,
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "ECDsa",
      resolvedClrType: "System.Security.Cryptography.ECDsa",
    });
  });

  it("normalizes constructor decl types to their instance type", () => {
    const widgetDecl = makeDeclId(2);
    const targetExpr = extractInstanceofRight("value instanceof Widget");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Widget" ? widgetDecl : undefined,
      typeOfDecl: () => ({
        kind: "referenceType",
        name: "WidgetConstructor",
      }),
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Widget",
    });
  });

  it("falls back to value-read types for imported runtime constructors", () => {
    const readableDecl = makeDeclId(4);
    const targetExpr = extractInstanceofRight("value instanceof Readable");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Readable" ? readableDecl : undefined,
      typeOfDecl: () => ({
        kind: "unknownType",
      }),
      typeOfValueRead: () => ({
        kind: "referenceType",
        name: "Readable",
        resolvedClrType: "Test.Readable",
      }),
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Readable",
      resolvedClrType: "Test.Readable",
    });
  });

  it("falls back to the final member binding when namespace access resolves to an unusable wrapper", () => {
    const namespaceDecl = makeDeclId(3);
    const targetExpr = extractInstanceofRight("value instanceof crypto.ECDsa");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "crypto" ? namespaceDecl : undefined,
      typeOfValueRead: () => ({
        kind: "referenceType",
        name: "CryptoNamespace",
      }),
      typeOfMember: () => ({
        kind: "intersectionType",
        types: [
          { kind: "anyType" },
          {
            kind: "referenceType",
            name: "__Anon_ecdsa_wrapper",
            structuralMembers: [
              {
                kind: "methodSignature",
                name: "Create",
                parameters: [],
                returnType: {
                  kind: "referenceType",
                  name: "ECDsa",
                },
              },
            ],
          },
        ],
      }),
      getType: (name) =>
        name === "ECDsa"
          ? {
              alias: "ECDsa",
              name: "System.Security.Cryptography.ECDsa",
            }
          : undefined,
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "ECDsa",
      resolvedClrType: "System.Security.Cryptography.ECDsa",
    });
  });
});
