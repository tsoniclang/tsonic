import { describe, it } from "mocha";
import { expect } from "chai";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsNodeNameText,
  getTstsStatementNodes,
  parseTstsSourceFile,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  dtsTypeNodeToIrType,
  parseExternalTypeString,
} from "./external-type-parser.js";

const parseAliasTypeNode = (source: string, aliasName: string): TstsNode => {
  const sourceFile = parseTstsSourceFile(source, { fileName: "test.d.ts" });
  for (const statement of getTstsStatementNodes(sourceFile)) {
    if (
      statement &&
      TstsSyntax.IsTypeAliasDeclaration(statement) &&
      getTstsNodeNameText(statement) === aliasName
    ) {
      const typeNode = getTstsDeclaredTypeNode(statement);
      if (typeNode) return typeNode;
    }
  }
  throw new Error(`Type alias '${aliasName}' not found`);
};

describe("external-type-parser d.ts utility typing", () => {
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
      valueType: { kind: "unknownType", explicit: true },
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
      valueType: { kind: "unknownType", explicit: true },
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

  it("converts null literal type nodes inside unions", () => {
    const typeNode = parseAliasTypeNode(`type X = string | null;`, "X");
    const result = dtsTypeNodeToIrType(
      typeNode,
      inScopeTypeParams,
      tsNameToTypeId
    );

    expect(result).to.deep.equal({
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "null" },
      ],
    });
  });

  it("preserves raw target string when provider metadata makes generic arguments ambiguous", () => {
    const result = parseExternalTypeString(
      "ProviderBox_1[[Payload,ProviderIdentity,ProviderKey=opaque]]"
    );

    expect(result.kind).to.equal("referenceType");
    if (result.kind !== "referenceType") {
      throw new Error("Expected referenceType result");
    }
    expect(result.name).to.equal("ProviderBox_1");
    expect(result.typeArguments).to.equal(undefined);
    expect(result.providerQualifiedName).to.equal(
      "ProviderBox_1[[Payload,ProviderIdentity,ProviderKey=opaque]]"
    );
  });

  it("parses generic arguments only when the argument count matches declared arity", () => {
    const result = parseExternalTypeString("ProviderPair_2[[Left,Right]]");

    expect(result.kind).to.equal("referenceType");
    if (result.kind !== "referenceType") {
      throw new Error("Expected referenceType result");
    }
    expect(result.name).to.equal("ProviderPair_2");
    expect(result.typeArguments).to.deep.equal([
      { kind: "referenceType", name: "Left", providerQualifiedName: "Left" },
      { kind: "referenceType", name: "Right", providerQualifiedName: "Right" },
    ]);
  });

  it("parses assembly-qualified single generic arguments as one argument", () => {
    const result = parseExternalTypeString(
      "System.Threading.Tasks.Task_1[[System.String,System.Private.CoreLib,Version=10.0.0.0,Culture=neutral,PublicKeyToken=7cec85d7bea7798e]]"
    );

    expect(result.kind).to.equal("referenceType");
    if (result.kind !== "referenceType") {
      throw new Error("Expected referenceType result");
    }
    expect(result.name).to.equal("Task_1");
    expect(result.typeArguments).to.deep.equal([
      { kind: "primitiveType", name: "string" },
    ]);
    expect(result.providerQualifiedName).to.equal(
      "System.Threading.Tasks.Task_1[[System.String,System.Private.CoreLib,Version=10.0.0.0,Culture=neutral,PublicKeyToken=7cec85d7bea7798e]]"
    );
  });

  it("parses assembly-qualified multi generic arguments by bracket boundaries", () => {
    const result = parseExternalTypeString(
      "System.Collections.Generic.Dictionary_2[[System.String,System.Private.CoreLib,Version=10.0.0.0,Culture=neutral,PublicKeyToken=7cec85d7bea7798e],[System.Int32,System.Private.CoreLib,Version=10.0.0.0,Culture=neutral,PublicKeyToken=7cec85d7bea7798e]]"
    );

    expect(result.kind).to.equal("referenceType");
    if (result.kind !== "referenceType") {
      throw new Error("Expected referenceType result");
    }
    expect(result.name).to.equal("Dictionary_2");
    expect(result.typeArguments).to.deep.equal([
      { kind: "primitiveType", name: "string" },
      {
        kind: "referenceType",
        name: "System.Int32",
        providerQualifiedName:
          "System.Int32,System.Private.CoreLib,Version=10.0.0.0,Culture=neutral,PublicKeyToken=7cec85d7bea7798e",
      },
    ]);
  });
});
