/**
 * Tests for TypeScript `this:` parameter inference + Rewrap<TReceiver, TNewShape> erasure.
 *
 * Generated extension method surfaces use:
 *   - explicit `this:` receiver parameters, and
 *   - `Rewrap<this, ReturnShape>` return types.
 *
 * Airplane-grade requirement:
 * - Generic inference MUST be able to infer method type parameters from the receiver (`this:`),
 *   even when there are zero call arguments.
 * - `Rewrap<_, TNewShape>` MUST not leak into IR/runtime typing; it erases to `TNewShape`.
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

describe("this: parameter inference + Rewrap erasure", () => {
  const createTestProgram = (source: string, fileName = "sample.ts") => {
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      strict: true,
      noEmit: true,
    };

    const host = ts.createCompilerHost(compilerOptions);
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (
      name: string,
      languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
      onError?: (message: string) => void,
      shouldCreateNewSourceFile?: boolean
    ) => {
      if (name === fileName) {
        return sourceFile;
      }
      return originalGetSourceFile.call(
        host,
        name,
        languageVersionOrOptions,
        onError,
        shouldCreateNewSourceFile
      );
    };

    const program = ts.createProgram([fileName], compilerOptions, host);
    const checker = program.getTypeChecker();

    const testProgram = {
      program,
      checker,
      options: {
        projectRoot: process.cwd(),
        sourceRoot: process.cwd(),
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

  it("infers generic type args from `this:` and erases Rewrap<_, T> to T", () => {
    const source = `
      // Keep this test self-contained: it should not depend on external module resolution.
      // We only need a TS-level marker name for the TypeSystem converter to see.
      export type Rewrap<TReceiver, TNewShape> = TNewShape;

      export class Seq<T> {
        value!: T;
      }

      export interface Methods {
        ToArrayAsync<T>(this: Seq<T>): Rewrap<this, T[]>;
      }

      export function test(xs: Seq<string>): string[] {
        const y = xs as unknown as Seq<string> & Methods;
        return y.ToArrayAsync();
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

    expect(callExpr.inferredType?.kind).to.equal("arrayType");
    if (callExpr.inferredType?.kind !== "arrayType") return;
    expect(callExpr.inferredType.elementType).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
  });
});
