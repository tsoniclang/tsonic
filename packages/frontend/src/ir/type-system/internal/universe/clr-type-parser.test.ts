import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { dtsTypeNodeToIrType } from "./clr-type-parser.js";

const parseAliasTypeNode = (source: string, aliasName: string): ts.TypeNode => {
  const sf = ts.createSourceFile(
    "test.d.ts",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === aliasName) {
      return stmt.type;
    }
  }
  throw new Error(`Type alias '${aliasName}' not found`);
};

describe("clr-type-parser d.ts utility typing", () => {
  const inScopeTypeParams = new Set<string>();
  const tsNameToTypeId = new Map();

  it("converts Record<string, unknown> to dictionaryType", () => {
    const typeNode = parseAliasTypeNode(
      `type X = Record<string, unknown>;`,
      "X"
    );
    const result = dtsTypeNodeToIrType(
      typeNode,
      inScopeTypeParams,
      tsNameToTypeId
    );

    expect(result).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "string" },
      valueType: { kind: "unknownType" },
    });
  });

  it("converts Record<number, string> to dictionaryType", () => {
    const typeNode = parseAliasTypeNode(
      `type X = Record<number, string>;`,
      "X"
    );
    const result = dtsTypeNodeToIrType(
      typeNode,
      inScopeTypeParams,
      tsNameToTypeId
    );

    expect(result).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "primitiveType", name: "number" },
      valueType: { kind: "primitiveType", name: "string" },
    });
  });

  it("converts Record<string | symbol, unknown> to object-key dictionaryType", () => {
    const typeNode = parseAliasTypeNode(
      `type X = Record<string | symbol, unknown>;`,
      "X"
    );
    const result = dtsTypeNodeToIrType(
      typeNode,
      inScopeTypeParams,
      tsNameToTypeId
    );

    expect(result).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "unknownType" },
    });
  });

  it("falls back to referenceType for unsupported Record key types", () => {
    const typeNode = parseAliasTypeNode(
      `type X<K extends string> = Record<K, number>;`,
      "X"
    );
    const result = dtsTypeNodeToIrType(
      typeNode,
      inScopeTypeParams,
      tsNameToTypeId
    );

    expect(result.kind).to.equal("referenceType");
    if (result.kind !== "referenceType") {
      throw new Error("Expected referenceType fallback");
    }
    expect(result.name).to.equal("Record");
    expect(result.typeArguments?.length).to.equal(2);
  });
});
