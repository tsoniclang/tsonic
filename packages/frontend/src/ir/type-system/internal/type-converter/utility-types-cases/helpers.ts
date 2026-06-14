/**
 * Shared test helpers for utility type expansion tests
 *
 * Covers the safety guarantees per Alice's review:
 * 1. Index signatures block expansion (never drop members)
 * 2. Symbol/computed keys block expansion (never drop members)
 * 3. Explicit undefined is preserved (not stripped)
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  TstsSyntax,
  getTstsIdentifierText,
  getTstsNodeText,
  getTstsTypeReferenceName,
  visitTstsSubtree,
  type TstsNode,
} from "@tsonic/tsts";
import {
  expandUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "../utility-types.js";
import { IrType } from "../../../../types.js";
import { Binding } from "../../../../binding/index.js";
import { createInlineTstsTestProgram } from "../../../../../testing/tsts-test-program.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 * Throws if value is null or undefined.
 */
function assertDefined<T>(value: T, msg?: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value as NonNullable<T>;
}

/**
 * Helper to create a TSTS-backed program from source code
 */
const createTestProgram = (
  source: string,
  fileName = "test.ts"
): {
  sourceFile: TstsNode;
  binding: Binding;
} => {
  const program = createInlineTstsTestProgram(source, { fileName });
  return {
    sourceFile: program.sourceFile,
    binding: program.binding,
  };
};

/**
 * Helper to find a type alias by name and get its type reference node
 */
const findTypeAliasReference = (
  sourceFile: TstsNode,
  aliasName: string
): TstsNode | null => {
  let result: TstsNode | null = null;

  visitTstsSubtree(sourceFile, (node) => {
    const alias = TstsSyntax.AsTypeAliasDeclaration(node);
    if (alias && getTstsIdentifierText(alias.name) === aliasName) {
      const typeNode = alias.Type;
      if (TstsSyntax.IsTypeReferenceNode(typeNode)) {
        result = typeNode ?? null;
      }
    }
  });
  return result;
};

const findFirstTypeReferenceNamed = (
  sourceFile: TstsNode,
  typeName: string
): TstsNode | null => {
  let result: TstsNode | null = null;
  visitTstsSubtree(sourceFile, (node) => {
    if (result) return;
    const typeReference = TstsSyntax.AsTypeReferenceNode(node);
    if (
      typeReference &&
      getTstsIdentifierText(typeReference.TypeName) === typeName
    ) {
      result = node ?? null;
    }
  });
  return result;
};

/**
 * Stub convertType for testing - just returns the type name
 */
const stubConvertType = (node: TstsNode, _binding: Binding): IrType => {
  if (TstsSyntax.IsTypeReferenceNode(node)) {
    const name = getTstsTypeReferenceName(node) ?? "unknown";
    return { kind: "referenceType", name, typeArguments: [] };
  }
  if (node.Kind === TstsSyntax.KindStringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (node.Kind === TstsSyntax.KindNumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  if (node.Kind === TstsSyntax.KindBooleanKeyword) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (node.Kind === TstsSyntax.KindBigIntKeyword) {
    return { kind: "primitiveType", name: "bigint" };
  }
  if (node.Kind === TstsSyntax.KindUndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (node.Kind === TstsSyntax.KindNullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }
  if (node.Kind === TstsSyntax.KindNeverKeyword) {
    return { kind: "neverType" };
  }
  // Handle literal type nodes (e.g., "a", 1, null, undefined)
  if (TstsSyntax.IsLiteralTypeNode(node)) {
    const literal = TstsSyntax.AsLiteralTypeNode(node)?.Literal;
    if (literal?.Kind === TstsSyntax.KindStringLiteral) {
      return {
        kind: "literalType",
        value: getTstsNodeText(literal) ?? "",
      } as IrType;
    }
    if (literal?.Kind === TstsSyntax.KindNumericLiteral) {
      return {
        kind: "literalType",
        value: Number(getTstsNodeText(literal) ?? "0"),
      } as IrType;
    }
    // null can appear as LiteralTypeNode in type positions
    if (literal?.Kind === TstsSyntax.KindNullKeyword) {
      return { kind: "primitiveType", name: "null" };
    }
  }
  if (TstsSyntax.IsUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: (TstsSyntax.AsUnionTypeNode(node)?.Types?.Nodes ?? []).map((t) =>
        t ? stubConvertType(t, _binding) : { kind: "anyType" }
      ),
    };
  }
  return { kind: "anyType" };
};

export {
  describe,
  it,
  expect,
  TstsSyntax,
  type TstsNode,
  expandUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
  assertDefined,
  createTestProgram,
  findTypeAliasReference,
  findFirstTypeReferenceNamed,
  stubConvertType,
};
