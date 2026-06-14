/**
 * Test harness for support types tests.
 * Creates a TSTS-backed program with support type definitions and provides
 * helpers to extract TSTS type objects.
 */

import {
  getTstsIdentifierText,
  TstsSyntax,
  type GoPtr,
  type TstsType,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { TstsSourceSemanticView } from "../source-frontend/index.js";
import {
  createTstsTestProgramFromFiles,
  type TstsTestProgram,
} from "../testing/tsts-test-program.js";

const SUPPORT_TYPES_DEFS = `
export type TSByRef<T> = { value: T };
export type TSUnsafePointer<T> = { __brand: "unsafe-pointer"; __type: T };
export type TSDelegate<TArgs extends any[], TReturn> = { __brand: "delegate"; __args: TArgs; __return: TReturn };
export type TSNullable<T> = { __brand: "nullable"; __value: T };
export type TSFixed<T, N extends number> = { __brand: "fixed"; __type: T; __size: N };
export type TSStackAlloc<T> = { __brand: "stackalloc"; __type: T };
`;

const TEST_CODE = `
import type { TSByRef, TSUnsafePointer, TSDelegate, TSNullable, TSFixed, TSStackAlloc } from "./support-types";

const byRef: TSByRef<number> = { value: 42 };
const unsafePtr: TSUnsafePointer<string> = null!;
const delegate: TSDelegate<[string], void> = null!;
const nullable: TSNullable<number> = null!;
const fixed: TSFixed<number, 10> = null!;
const stackAlloc: TSStackAlloc<number> = null!;
`;

export type TestHarness = TstsTestProgram & {
  readonly sourceSemantics: TstsSourceSemanticView;
};

export const createTestHarness = (): TestHarness =>
  createTstsTestProgramFromFiles(
    {
      "support-types.d.ts": SUPPORT_TYPES_DEFS,
      "test.ts": TEST_CODE,
    },
    "test.ts"
  );

export const getVariableType = (
  harness: TestHarness,
  variableName: string
): GoPtr<TstsType> => {
  let foundType: GoPtr<TstsType>;

  visitTstsSubtree(harness.sourceFile, (node) => {
    if (!node) return;
    if (foundType || !TstsSyntax.IsVariableDeclaration(node)) return;
    const name = TstsSyntax.Node_Name(node);
    if (getTstsIdentifierText(name) !== variableName) return;
    const typeNode = TstsSyntax.Node_Type(node);
    foundType = typeNode
      ? harness.sourceSemantics.getTypeFromTypeNode(typeNode)
      : harness.sourceSemantics.getExpressionType(node);
  });

  return foundType;
};

export const getSupportTypes = (
  harness: TestHarness
): {
  byRef: TstsType;
  unsafePointer: TstsType;
  delegate: TstsType;
  nullable: TstsType;
  fixed: TstsType;
  stackAlloc: TstsType;
} => {
  const byRef = getVariableType(harness, "byRef");
  const unsafePointer = getVariableType(harness, "unsafePtr");
  const delegate = getVariableType(harness, "delegate");
  const nullable = getVariableType(harness, "nullable");
  const fixed = getVariableType(harness, "fixed");
  const stackAlloc = getVariableType(harness, "stackAlloc");

  if (
    !byRef ||
    !unsafePointer ||
    !delegate ||
    !nullable ||
    !fixed ||
    !stackAlloc
  ) {
    throw new Error("Failed to extract all support types from test harness");
  }

  return {
    byRef,
    unsafePointer,
    delegate,
    nullable,
    fixed,
    stackAlloc,
  };
};
