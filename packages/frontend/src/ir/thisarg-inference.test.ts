/**
 * Tests for `thisarg<T>` typing behavior.
 *
 * `thisarg<T>` is a source marker for extension method receiver parameters.
 * It must erase to T for call resolution and generic inference.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as path from "node:path";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import { ExternalMetadataRegistry } from "../external-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createExternalBindingsResolver } from "../resolver/external-bindings-resolver.js";
import { createBinding } from "./binding/index.js";
import {
  createSourceSemanticFactStore,
  projectTstsFactsToTypeScriptSource,
} from "../source-frontend/index.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";
import { createTypeScriptSemanticView } from "../source-frontend/typescript-semantic-view.js";
import { createExtensionHost, parseTstsSourceFile } from "@tsonic/tsts";
import {
  createTsonicNumericPrimitiveExtension,
  createTsonicSourceSemanticsExtension,
} from "../tsonic-extension/index.js";

describe("thisarg<T> typing", () => {
  const createTestProgram = (source: string, fileName = "sample.ts") => {
    const resolvedFileName = fileName.startsWith("/")
      ? fileName
      : path.resolve(".temp/thisarg-inference", fileName);
    const sourceFile = ts.createSourceFile(
      resolvedFileName,
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
      if (name === resolvedFileName) {
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

    const program = ts.createProgram([resolvedFileName], compilerOptions, host);
    const checker = program.getTypeChecker();
    const sourceFacts = createSourceSemanticFactStore<ts.Node>();
    const sourceSemantics = createTypeScriptSemanticView(checker, sourceFacts);
    const extensionHost = createExtensionHost([
      createTsonicNumericPrimitiveExtension(),
      createTsonicSourceSemanticsExtension(),
    ]);
    const tstsSourceFile = parseTstsSourceFile(source, {
      fileName: resolvedFileName,
    });
    if (!tstsSourceFile) {
      throw new Error(`TSTS parser did not create ${resolvedFileName}`);
    }
    extensionHost.configure();
    extensionHost.afterParseSourceFile(tstsSourceFile);
    const sourceProgram: TstsSourceProgram = {
      engine: "tsts",
      sourceFiles: [tstsSourceFile],
      extensionHost,
      diagnostics: extensionHost.diagnostics.all(),
      compilerDiagnostics: [],
      withSourceSemantics: () => {
        throw new Error("In-memory thisarg test program has no TSTS checker.");
      },
    };
    projectTstsFactsToTypeScriptSource(
      sourceProgram,
      [sourceFile],
      sourceFacts
    );

    const testProgram = {
      program,
      checker,
      tsCompilerOptions: program.getCompilerOptions(),
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      sourceProgram,
      sourceSemantics,
      metadata: new ExternalMetadataRegistry(),
      bindings: new BindingRegistry(),
      externalResolver: createExternalBindingsResolver("/test"),
      binding: createBinding(sourceSemantics),
    };

    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    return { testProgram, ctx, options };
  };

  it("erases thisarg<T> so generic call inference succeeds", () => {
    const source = `
      import type { thisarg } from "@tsonic/core/lang.js";

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
