import { expect } from "chai";
import { describe, it } from "mocha";
import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type { DeclId } from "../type-system/index.js";
import type { IrType } from "../types.js";
import { resolveInstanceofTargetType } from "./narrowing-resolvers-equality.js";
import type { SimpleBindingDescriptor } from "../../program/binding-types.js";

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
  readonly getExactBindingByKind?: (
    name: string,
    kind: "global" | "module"
  ) => SimpleBindingDescriptor | undefined;
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
      getExactBindingByKind: options.getExactBindingByKind ?? (() => undefined),
    },
  }) as unknown as ProgramContext;

describe("narrowing-resolvers-equality", () => {
  it("derives constructor-instance targets from explicit prototype typing", () => {
    const widgetDecl = makeDeclId(2);
    const targetExpr = extractInstanceofRight("value instanceof Widget");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Widget" ? widgetDecl : undefined,
      typeOfDecl: () => ({
        kind: "referenceType",
        name: "WidgetConstructor",
      }),
      typeOfMember: (_receiver, member) =>
        member.name === "prototype"
          ? {
              kind: "referenceType",
              name: "Widget",
            }
          : {
              kind: "unknownType",
            },
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Widget",
    });
  });

  it("derives imported constructor-instance targets from explicit prototype typing", () => {
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
        name: "ReadableConstructor",
      }),
      typeOfMember: (_receiver, member) =>
        member.name === "prototype"
          ? {
              kind: "referenceType",
              name: "Readable",
              resolvedClrType: "Test.Readable",
            }
          : {
              kind: "unknownType",
            },
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Readable",
      resolvedClrType: "Test.Readable",
    });
  });

  it("derives namespace member instanceof targets from explicit prototype typing", () => {
    const namespaceDecl = makeDeclId(3);
    const targetExpr = extractInstanceofRight("value instanceof crypto.ECDsa");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "crypto" ? namespaceDecl : undefined,
      typeOfValueRead: () => ({
        kind: "referenceType",
        name: "CryptoNamespace",
      }),
      typeOfMember: (receiver, member) => {
        if (
          receiver.kind === "referenceType" &&
          receiver.name === "CryptoNamespace"
        ) {
          return member.name === "ECDsa"
            ? {
                kind: "referenceType",
                name: "ECDsaConstructor",
              }
            : {
                kind: "unknownType",
              };
        }

        return member.name === "prototype"
          ? {
              kind: "referenceType",
              name: "ECDsa",
              resolvedClrType: "System.Security.Cryptography.ECDsa",
            }
          : {
              kind: "unknownType",
            };
      },
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "ECDsa",
      resolvedClrType: "System.Security.Cryptography.ECDsa",
    });
  });

  it("derives global constructor instanceof targets from explicit simple binding metadata", () => {
    const uint8ArrayDecl = makeDeclId(5);
    const targetExpr = extractInstanceofRight("value instanceof Uint8Array");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Uint8Array" ? uint8ArrayDecl : undefined,
      typeOfDecl: () => ({
        kind: "referenceType",
        name: "Uint8ArrayConstructor",
      }),
      getExactBindingByKind: (name, kind) =>
        name === "Uint8Array" && kind === "global"
          ? {
              kind: "global",
              assembly: "js",
              type: "js.Uint8Array",
              staticType: "js.Uint8Array",
              typeSemantics: {
                contributesTypeIdentity: true,
              },
            }
          : undefined,
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Uint8Array",
      resolvedClrType: "js.Uint8Array",
    });
  });
});
