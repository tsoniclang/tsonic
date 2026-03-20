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
import * as ts from "typescript";
import {
  expandUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "../utility-types.js";
import { IrType } from "../../../../types.js";
import { createBinding, Binding } from "../../../../binding/index.js";

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
 * Helper to create a TypeScript program from source code
 */
const createTestProgram = (
  source: string,
  fileName = "test.ts"
): {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  binding: Binding;
} => {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;

  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  host.fileExists = (name: string) =>
    name === fileName || originalFileExists.call(host, name);

  host.readFile = (name: string) =>
    name === fileName ? source : originalReadFile.call(host, name);

  const program = ts.createProgram([fileName], compilerOptions, host);
  const sourceFile = assertDefined(
    program.getSourceFile(fileName),
    `Source file ${fileName} not found`
  );
  const checker = program.getTypeChecker();
  const binding = createBinding(checker);

  return { program, checker, sourceFile, binding };
};

/**
 * Helper to find a type alias by name and get its type reference node
 */
const findTypeAliasReference = (
  sourceFile: ts.SourceFile,
  aliasName: string
): ts.TypeReferenceNode | null => {
  let result: ts.TypeReferenceNode | null = null;

  const visitor = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === aliasName) {
      if (ts.isTypeReferenceNode(node.type)) {
        result = node.type;
      }
    }
    ts.forEachChild(node, visitor);
  };

  ts.forEachChild(sourceFile, visitor);
  return result;
};

/**
 * Stub convertType for testing - just returns the type name
 */
const stubConvertType = (node: ts.TypeNode, _binding: Binding): IrType => {
  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName)
      ? node.typeName.text
      : node.typeName.getText();
    return { kind: "referenceType", name, typeArguments: [] };
  }
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (node.kind === ts.SyntaxKind.NumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  if (node.kind === ts.SyntaxKind.BooleanKeyword) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }
  if (node.kind === ts.SyntaxKind.NeverKeyword) {
    return { kind: "neverType" };
  }
  // Handle literal type nodes (e.g., "a", 1, null, undefined)
  if (ts.isLiteralTypeNode(node)) {
    const literal = node.literal;
    if (ts.isStringLiteral(literal)) {
      return { kind: "literalType", value: literal.text } as IrType;
    }
    if (ts.isNumericLiteral(literal)) {
      return { kind: "literalType", value: Number(literal.text) } as IrType;
    }
    // null can appear as LiteralTypeNode in type positions
    if (literal.kind === ts.SyntaxKind.NullKeyword) {
      return { kind: "primitiveType", name: "null" };
    }
  }
  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((t) => stubConvertType(t, _binding)),
    };
  }
  return { kind: "anyType" };
};

export {
  describe,
  it,
  expect,
  ts,
  expandUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
  assertDefined,
  createTestProgram,
  findTypeAliasReference,
  stubConvertType,
};
