import { expect } from "chai";
import { describe, it } from "mocha";
import * as fs from "node:fs";
import * as path from "node:path";
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
  readonly getDecl?: (declId: DeclId) => unknown;
  readonly getType?: (
    name: string
  ) => { readonly alias: string; readonly name: string } | undefined;
  readonly getExactBindingByKind?: (
    name: string,
    kind: "global" | "module"
  ) => SimpleBindingDescriptor | undefined;
  readonly sourceRoot?: string;
}): ProgramContext =>
  ({
    sourceRoot: options.sourceRoot ?? "/workspace/src",
    rootNamespace: "Test",
    binding: {
      resolveIdentifier: options.resolveIdentifier,
      getKindOfDecl: (declId: DeclId) =>
        (options.getDecl?.(declId) as { readonly kind?: unknown } | undefined)
          ?.kind,
      getValueDeclarationNode: (declId: DeclId) => {
        const decl = options.getDecl?.(declId) as
          | {
              readonly valueDeclNode?: ts.Node;
              readonly declNode?: ts.Node;
            }
          | undefined;
        return decl?.valueDeclNode ?? decl?.declNode;
      },
      getTypeNodeOfDecl: () => undefined,
      captureTypeSyntax: (node: ts.TypeNode) => node,
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
      typeFromSyntax: () => ({
        kind: "unknownType",
      }),
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
              providerQualifiedName: "Test.Readable",
            }
          : {
              kind: "unknownType",
            },
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Readable",
      providerQualifiedName: "Test.Readable",
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
              providerQualifiedName: "System.Security.Cryptography.ECDsa",
            }
          : {
              kind: "unknownType",
            };
      },
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "ECDsa",
      providerQualifiedName: "System.Security.Cryptography.ECDsa",
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
              ownerIdentity: "js",
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
      providerQualifiedName: "js.Uint8Array",
    });
  });

  it("prefers lexical constructor identity over same-name global binding metadata", () => {
    const bufferDecl = makeDeclId(6);
    const targetExpr = extractInstanceofRight("value instanceof Buffer");
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Buffer" ? bufferDecl : undefined,
      typeOfDecl: () => ({
        kind: "referenceType",
        name: "BufferConstructor",
      }),
      typeOfMember: (_receiver, member) =>
        member.name === "prototype"
          ? {
              kind: "referenceType",
              name: "Buffer",
              providerQualifiedName: "Test.Buffer",
            }
          : {
              kind: "unknownType",
            },
      getExactBindingByKind: (name, kind) =>
        name === "Buffer" && kind === "global"
          ? {
              kind: "global",
              ownerIdentity: "System",
              type: "System.Buffer",
              staticType: "System.Buffer",
              typeSemantics: {
                contributesTypeIdentity: true,
              },
            }
          : undefined,
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Buffer",
      providerQualifiedName: "Test.Buffer",
    });
  });

  it("derives local source class instanceof targets from declaration identity", () => {
    const bufferDecl = makeDeclId(7);
    const targetExpr = extractInstanceofRight("value instanceof Buffer");
    const sourceFile = ts.createSourceFile(
      "/workspace/src/index.ts",
      "class Buffer {}",
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );
    const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
    if (!classDecl) {
      throw new Error("Expected class declaration");
    }
    const ctx = createMockContext({
      resolveIdentifier: (node) =>
        node.text === "Buffer" ? bufferDecl : undefined,
      getDecl: () => ({
        kind: "class",
        fqName: "Buffer",
        declNode: classDecl,
        valueDeclNode: classDecl,
      }),
      typeOfDecl: () => ({
        kind: "referenceType",
        name: "Buffer",
        providerQualifiedName: "System.Buffer",
      }),
      getExactBindingByKind: (name, kind) =>
        name === "Buffer" && kind === "global"
          ? {
              kind: "global",
              ownerIdentity: "System",
              type: "System.Buffer",
              staticType: "System.Buffer",
              typeSemantics: {
                contributesTypeIdentity: true,
              },
            }
          : undefined,
    });

    expect(resolveInstanceofTargetType(targetExpr, ctx)).to.deep.equal({
      kind: "referenceType",
      name: "Buffer",
      providerQualifiedName: "Test.Buffer",
      typeId: {
        stableId: "Test:Test.Buffer",
        providerName: "Test.Buffer",
        symbolId: "type-stable:Test%3ATest.Buffer",
        sourceName: "Buffer",
        ownerIdentity: "Test",
        origin: "source",
      },
    });
  });

  it("derives installed source-package class instanceof targets from source-package identity", () => {
    const regexpDecl = makeDeclId(8);
    fs.mkdirSync(path.join(process.cwd(), ".temp"), { recursive: true });
    const fixtureRoot = fs.mkdtempSync(
      path.join(process.cwd(), ".temp/narrowing-source-package-")
    );
    const packageRoot = path.join(fixtureRoot, "app/node_modules/@fixture/js");
    const sourceRoot = path.join(packageRoot, "src");
    const sourcePath = path.join(sourceRoot, "regexp.ts");

    try {
      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify({ name: "@fixture/js" })
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify({
          kind: "tsonic-source-package",
          source: {
            namespace: "fixture.js",
            exports: { ".": "./src/regexp.ts" },
          },
        })
      );

      const sourceText = "export class RegExp {}";
      fs.writeFileSync(sourcePath, sourceText);
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
      if (!classDecl) {
        throw new Error("Expected class declaration");
      }

      const targetExpr = extractInstanceofRight("value instanceof RegExp");
      const ctx = createMockContext({
        resolveIdentifier: (node) =>
          node.text === "RegExp" ? regexpDecl : undefined,
        getDecl: () => ({
          kind: "class",
          fqName: "RegExp",
          declNode: classDecl,
          valueDeclNode: classDecl,
        }),
        typeOfDecl: () => ({
          kind: "referenceType",
          name: "RegExp",
          providerQualifiedName: "Test.RegExp",
        }),
      });

      const target = resolveInstanceofTargetType(targetExpr, {
        ...ctx,
        projectRoot: path.join(fixtureRoot, "app"),
        sourceRoot: path.join(fixtureRoot, "app/src"),
        rootNamespace: "Test",
      } as ProgramContext);

      expect(target).to.deep.include({
        kind: "referenceType",
        name: "RegExp",
        providerQualifiedName: "fixture.js.RegExp",
      });
      expect(
        target && target.kind === "referenceType" ? target.typeId : undefined
      ).to.deep.include({
        stableId: "@fixture/js:fixture.js.RegExp",
        sourceName: "RegExp",
        ownerIdentity: "@fixture/js",
        providerName: "fixture.js.RegExp",
        origin: "source",
      });
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
