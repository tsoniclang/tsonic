/**
 * Test harness for support types tests.
 * Creates a real TypeScript program with support type definitions
 * and provides helpers to extract ts.Type objects.
 */

import * as ts from "typescript";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/**
 * Support type definitions (from _support/types.d.ts)
 */
const SUPPORT_TYPES_DEFS = `
// Support types for CLR interop
export type TSByRef<T> = { value: T };
export type TSUnsafePointer<T> = { __brand: "unsafe-pointer"; __type: T };
export type TSDelegate<TArgs extends any[], TReturn> = { __brand: "delegate"; __args: TArgs; __return: TReturn };
export type TSNullable<T> = { __brand: "nullable"; __value: T };
export type TSFixed<T, N extends number> = { __brand: "fixed"; __type: T; __size: N };
export type TSStackAlloc<T> = { __brand: "stackalloc"; __type: T };
`;

/**
 * Test code that uses the support types
 */
const TEST_CODE = `
import type { TSByRef, TSUnsafePointer, TSDelegate, TSNullable, TSFixed, TSStackAlloc } from "./support-types";

// Test variables with support types
const byRef: TSByRef<number> = { value: 42 };
const unsafePtr: TSUnsafePointer<string> = null!;
const delegate: TSDelegate<[string], void> = null!;
const nullable: TSNullable<number> = null!;
const fixed: TSFixed<number, 10> = null!;
const stackAlloc: TSStackAlloc<number> = null!;
`;

export type TestHarness = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
  readonly cleanup: () => void;
};

/**
 * Create a test harness with a real TypeScript program.
 * Returns program, checker, and source file for testing.
 */
export const createTestHarness = (): TestHarness => {
  // Create temporary directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsonic-test-"));

  // Write support types definition file
  const supportTypesPath = path.join(tmpDir, "support-types.d.ts");
  fs.writeFileSync(supportTypesPath, SUPPORT_TYPES_DEFS);

  // Write test code file
  const testCodePath = path.join(tmpDir, "test.ts");
  fs.writeFileSync(testCodePath, TEST_CODE);

  // Create TypeScript program
  const program = ts.createProgram({
    rootNames: [testCodePath],
    options: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(testCodePath);

  if (!sourceFile) {
    throw new Error("Failed to get source file from test program");
  }

  const cleanup = () => {
    // Clean up temporary files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };

  return {
    program,
    checker,
    sourceFile,
    cleanup,
  };
};

/**
 * Extract the type of a variable declaration by name.
 * Gets the type from the type annotation node, not the inferred type.
 */
export const getVariableType = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  variableName: string
): ts.Type | undefined => {
  let foundType: ts.Type | undefined = undefined;

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && node.name.text === variableName) {
        // Get type from type annotation if present
        if (node.type) {
          foundType = checker.getTypeFromTypeNode(node.type);
        } else {
          foundType = checker.getTypeAtLocation(node);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return foundType;
};

/**
 * Get all support type instances from the test harness.
 */
export const getSupportTypes = (
  harness: TestHarness
): {
  byRef: ts.Type;
  unsafePointer: ts.Type;
  delegate: ts.Type;
  nullable: ts.Type;
  fixed: ts.Type;
  stackAlloc: ts.Type;
} => {
  const byRef = getVariableType(harness.sourceFile, harness.checker, "byRef");
  const unsafePointer = getVariableType(
    harness.sourceFile,
    harness.checker,
    "unsafePtr"
  );
  const delegate = getVariableType(
    harness.sourceFile,
    harness.checker,
    "delegate"
  );
  const nullable = getVariableType(
    harness.sourceFile,
    harness.checker,
    "nullable"
  );
  const fixed = getVariableType(harness.sourceFile, harness.checker, "fixed");
  const stackAlloc = getVariableType(
    harness.sourceFile,
    harness.checker,
    "stackAlloc"
  );

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
