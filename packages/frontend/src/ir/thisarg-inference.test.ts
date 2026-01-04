/**
 * Tests for `thisarg<T>` typing behavior.
 *
 * `thisarg<T>` is a TS-only marker for C# extension method receiver parameters.
 * It must erase to T for call resolution and generic inference.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";

describe("thisarg<T> typing", () => {
  const createTestProgram = (source: string, fileName = "/test/sample.ts") => {
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const program = ts.createProgram(
      [fileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
        writeFile: () => {},
        getCurrentDirectory: () => "/test",
        getDirectories: () => [],
        fileExists: () => true,
        readFile: () => source,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: (_options) => "lib.d.ts",
      }
    );

    const checker = program.getTypeChecker();

    const testProgram = {
      program,
      checker,
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings: new BindingRegistry(),
      clrResolver: createClrBindingsResolver("/test"),
      binding: createBinding(checker),
    };

    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    return { testProgram, ctx, options };
  };

  it("erases thisarg<T> so generic call inference succeeds", () => {
    const source = `
      type thisarg<T> = T;

      export function id<T>(x: thisarg<T>): T {
        return x;
      }

      export function test(): string {
        return id("hello");
      }
    `;

    const { testProgram, ctx, options } = createTestProgram(source);
    const sourceFile = testProgram.sourceFiles[0];
    if (!sourceFile) throw new Error("Failed to create source file");

    const result = buildIrModule(sourceFile, testProgram, options, ctx);
    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const module = result.value;
    const testFn = module.body.find(
      (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
    );
    if (!testFn || testFn.kind !== "functionDeclaration") {
      throw new Error("Expected function declaration 'test'");
    }

    const returnStmt = testFn.body.statements.find(
      (s) => s.kind === "returnStatement"
    );
    if (!returnStmt || returnStmt.kind !== "returnStatement") {
      throw new Error("Expected return statement in test()");
    }

    const callExpr = returnStmt.expression;
    if (!callExpr || callExpr.kind !== "call") {
      throw new Error("Expected call expression in return statement");
    }

    expect(callExpr.inferredType).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
  });
});
