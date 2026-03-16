/**
 * Tests for IR Builder
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import { createProgram } from "../program/creation.js";
import {
  IrExpression,
  IrFunctionDeclaration,
  IrVariableDeclaration,
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrMethodDeclaration,
  IrExpressionStatement,
  IrPropertyDeclaration,
  IrType,
  IrTypeAliasDeclaration,
} from "./types.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";
import { stableIrTypeKey } from "./types/type-ops.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  const unwrapTransparentExpression = (
    expression: IrExpression | undefined
  ): IrExpression | undefined => {
    let current = expression;
    while (
      current &&
      (current.kind === "typeAssertion" || current.kind === "numericNarrowing")
    ) {
      current = current.expression;
    }
    return current;
  };

  const createTestProgram = (source: string, fileName = "/test/test.ts") => {
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

    // Create ProgramContext for the test
    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    return { testProgram, ctx, options };
  };

  const createFilesystemTestProgram = (
    files: Record<string, string>,
    entryRelativePath: string
  ) => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-builder-filesystem-")
    );

    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, contents);
    }

    const rootNames = Object.keys(files)
      .filter((relativePath) => /\.(?:ts|mts|cts|d\.ts)$/.test(relativePath))
      .map((relativePath) => path.join(tempDir, relativePath));

    const tsProgram = ts.createProgram(rootNames, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    });

    const checker = tsProgram.getTypeChecker();
    const entryPath = path.join(tempDir, entryRelativePath);
    const sourceFile = tsProgram.getSourceFile(entryPath);
    if (!sourceFile) {
      throw new Error(`Failed to create source file for ${entryRelativePath}`);
    }

    const testProgram = {
      program: tsProgram,
      checker,
      options: {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: rootNames
        .filter((filePath) => !filePath.endsWith(".d.ts"))
        .map((filePath) => tsProgram.getSourceFile(filePath))
        .filter(
          (candidate): candidate is ts.SourceFile => candidate !== undefined
        ),
      declarationSourceFiles: rootNames
        .filter((filePath) => filePath.endsWith(".d.ts"))
        .map((filePath) => tsProgram.getSourceFile(filePath))
        .filter(
          (candidate): candidate is ts.SourceFile => candidate !== undefined
        ),
      metadata: new DotnetMetadataRegistry(),
      bindings: new BindingRegistry(),
      clrResolver: createClrBindingsResolver(tempDir),
      binding: createBinding(checker),
    };

    const options = {
      sourceRoot: path.join(tempDir, "src"),
      rootNamespace: "TestApp",
    };
    const ctx = createProgramContext(testProgram, options);

    return {
      tempDir,
      sourceFile,
      testProgram,
      ctx,
      options,
      cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
    };
  };

  describe("Module Structure", () => {
    it("should create IR module with correct namespace and class name", () => {
      const source = `
        export function greet(name: string): string {
          return \`Hello \${name}\`;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const module = result.value;
        expect(module.kind).to.equal("module");
        expect(module.namespace).to.equal("TestApp");
        expect(module.className).to.equal("test");
        expect(module.isStaticContainer).to.equal(true);
      }
    });

    it("should detect top-level code", () => {
      const source = `
        console.log("Hello");
        export const x = 42;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.value.isStaticContainer).to.equal(false);
      }
    });
  });

  describe("Promise callback typing", () => {
    it("should not poison Promise.then callbacks to void before generic resolution settles", () => {
      const source = `
        declare class Promise<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): Promise<TResult1 | TResult2>;
        }

        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        export function chainScore(seed: Promise<number>): Promise<number> {
          return seed.then((value) => value + 1);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "chainScore"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const call = returnStmt.expression;
      expect(call?.kind).to.equal("call");
      if (!call || call.kind !== "call") return;

      const callback = call.arguments[0];
      expect(callback?.kind).to.equal("arrowFunction");
      if (!callback || callback.kind !== "arrowFunction") return;

      expect(callback.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
      expect(callback.inferredType).to.deep.equal({
        kind: "functionType",
        parameters: callback.parameters,
        returnType: {
          kind: "primitiveType",
          name: "number",
        },
      });
    });

    it("infers Promise constructor generic from contextual return type", () => {
      const source = `
        declare function setTimeout(fn: () => void, ms: number): void;

        declare class PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason: unknown) => void
            ) => void
          );
        }

        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
          });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "delay"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctor = returnStmt.expression;
      expect(ctor?.kind).to.equal("new");
      if (!ctor || ctor.kind !== "new") return;

      expect(ctor.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "voidType" }],
      });

      const executor = ctor.arguments[0];
      expect(executor?.kind).to.equal("arrowFunction");
      if (!executor || executor.kind !== "arrowFunction") return;

      expect(executor.parameters[0]?.type).to.not.equal(undefined);
      expect(executor.parameters[0]?.type?.kind).to.equal("functionType");
    });

    it("infers Promise.all element type from async wrapper array arguments", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          static all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
        }

        async function runWorker(name: string): Promise<number> {
          return 1;
        }

        export async function main(): Promise<void> {
          const results = await Promise.all([
            runWorker("a"),
            runWorker("b"),
            runWorker("c"),
          ]);
          void results;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const decl = fn.body.statements[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (!decl || decl.kind !== "variableDeclaration") return;

      const initializer = decl.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("await");
      if (!initializer || initializer.kind !== "await") return;

      const call = initializer.expression;
      expect(call?.kind).to.equal("call");
      if (!call || call.kind !== "call") return;

      expect(call.inferredType).to.deep.include({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [
          {
            kind: "arrayType",
            elementType: {
              kind: "primitiveType",
              name: "number",
            },
            origin: "explicit",
          },
        ],
      });
      expect(initializer.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: {
          kind: "primitiveType",
          name: "number",
        },
        origin: "explicit",
      });
    });

    it("preserves generic receiver substitutions for js-surface method calls", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-map-keys-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "const counts = new Map<string, number>();",
            'counts.set("alpha", 1);',
            "export const keys = Array.from(counts.keys());",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const keysDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "keys"
        );
        expect(keysDecl).to.not.equal(undefined);
        if (!keysDecl) return;

        const initializer = keysDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("call");
        if (!initializer || initializer.kind !== "call") return;

        expect(initializer.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });

        const keysCall = initializer.arguments[0];
        expect(keysCall?.kind).to.equal("call");
        if (!keysCall || keysCall.kind !== "call") return;

        expect(keysCall.inferredType?.kind).to.equal("referenceType");
        if (keysCall.inferredType?.kind !== "referenceType") return;
        expect(["Iterable", "IEnumerable_1"]).to.include(
          keysCall.inferredType.name
        );
        expect(keysCall.inferredType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "string" },
        ]);

        const callee = keysCall.callee;
        expect(callee.kind).to.equal("memberAccess");
        if (callee.kind !== "memberAccess") return;

        expect(callee.inferredType?.kind).to.equal("functionType");
        if (callee.inferredType?.kind !== "functionType") return;
        expect(callee.inferredType.parameters).to.deep.equal([]);
        expect(callee.inferredType.returnType.kind).to.equal("referenceType");
        if (callee.inferredType.returnType.kind !== "referenceType") return;
        expect(["Iterable", "IEnumerable_1"]).to.include(
          callee.inferredType.returnType.name
        );
        if (callee.inferredType.returnType.typeArguments) {
          expect(callee.inferredType.returnType.typeArguments).to.deep.equal([
            { kind: "primitiveType", name: "string" },
          ]);
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves imported root-namespace member types across package internals", function () {
      this.timeout(30_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-node-date-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const jsRoot = path.join(tempDir, "node_modules/@tsonic/js-temp");
        fs.mkdirSync(path.join(jsRoot, "index", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(jsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/js-temp", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(jsRoot, "index", "bindings.json"),
          JSON.stringify({ namespace: "Acme.JsRuntime", types: [] }, null, 2)
        );
        fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(jsRoot, "index", "internal", "index.d.ts"),
          [
            "export interface Date$instance {",
            "  toISOString(): string;",
            "}",
            "export type Date = Date$instance;",
          ].join("\n")
        );

        const nodeRoot = path.join(tempDir, "node_modules/@tsonic/node-temp");
        fs.mkdirSync(path.join(nodeRoot, "index", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(nodeRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/node-temp", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodeRoot, "index", "bindings.json"),
          JSON.stringify({ namespace: "acme.node", types: [] }, null, 2)
        );
        fs.writeFileSync(path.join(nodeRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(nodeRoot, "index", "internal", "index.d.ts"),
          [
            'import type { Date } from "@tsonic/js-temp/Acme.JsRuntime/internal/index.js";',
            "export interface Stats$instance {",
            "  mtime: Date;",
            "}",
            "export type Stats = Stats$instance;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(nodeRoot, "index.d.ts"),
          [
            'import type { Stats } from "./index/internal/index.js";',
            'declare module "node:fs" {',
            "  export const statSync: (path: string) => Stats;",
            "}",
            "export {};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { statSync } from "node:fs";',
            "const maybeDate: Date | undefined = undefined;",
            'export const resolved = maybeDate ?? statSync("package.json").mtime;',
            "export const iso = resolved.toISOString();",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
          typeRoots: [
            "node_modules/@tsonic/node-temp",
            "node_modules/@tsonic/js-temp",
          ],
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const resolvedDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "resolved"
        );
        expect(resolvedDecl).to.not.equal(undefined);
        if (!resolvedDecl) return;

        const resolvedType = resolvedDecl.declarations[0]?.type;
        expect(resolvedType).to.not.equal(undefined);
        expect(resolvedType?.kind).to.not.equal("unknownType");
        if (resolvedType?.kind === "referenceType") {
          expect(["Date", "Date$instance"]).to.include(resolvedType.name);
        }
        if (resolvedType?.kind === "unionType") {
          const memberNames = resolvedType.types
            .filter(
              (type): type is Extract<typeof type, { kind: "referenceType" }> =>
                !!type && type.kind === "referenceType"
            )
            .map((type) => type.name);
          expect(memberNames).to.include("Date");
          expect(memberNames).to.include("Date$instance");
        }

        const isoDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "iso"
        );
        expect(isoDecl).to.not.equal(undefined);
        if (!isoDecl) return;

        expect(isoDecl.declarations[0]?.type).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves canonical CLR identity for array elements from source-binding declarations", function () {
      this.timeout(30_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-array-identity-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const bindingsRoot = path.join(tempDir, "tsonic", "bindings");
        fs.mkdirSync(path.join(bindingsRoot, "Acme.Core", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core", "internal", "index.d.ts"),
          [
            "export interface Attachment$instance {",
            '  readonly "__tsonic_binding_alias_Acme.Core.Attachment"?: never;',
            "  readonly __tsonic_type_Acme_Core_Attachment?: never;",
            "  Id: string;",
            "}",
            "export type Attachment = Attachment$instance;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core.d.ts"),
          [
            'import type { Attachment } from "./Acme.Core/internal/index.js";',
            "export declare function getAttachments(): Attachment[];",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { getAttachments } from "../tsonic/bindings/Acme.Core.js";',
            "const attachments = getAttachments();",
            "export const attachmentCount = attachments.length;",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const attachmentsDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "attachments"
        );
        expect(attachmentsDecl).to.not.equal(undefined);
        if (!attachmentsDecl) return;

        const attachmentsType = attachmentsDecl.declarations[0]?.type;
        expect(attachmentsType?.kind).to.equal("arrayType");
        if (!attachmentsType || attachmentsType.kind !== "arrayType") return;

        expect(attachmentsType.elementType.kind).to.equal("referenceType");
        if (attachmentsType.elementType.kind !== "referenceType") return;

        expect(attachmentsType.elementType.name).to.equal(
          "Acme.Core.Attachment"
        );
        expect(attachmentsType.elementType.resolvedClrType).to.equal(
          "Acme.Core.Attachment"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves CLR identity for generic structural aliases from source-binding declarations", function () {
      this.timeout(30_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-generic-alias-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const bindingsRoot = path.join(tempDir, "tsonic", "bindings");
        fs.mkdirSync(path.join(bindingsRoot, "Acme.Core", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core", "bindings.json"),
          JSON.stringify(
            {
              namespace: "Acme.Core",
              types: [
                {
                  clrName: "Acme.Core.Ok__Alias`1",
                  assemblyName: "Acme.Core",
                  methods: [],
                  properties: [],
                  fields: [],
                },
              ],
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core", "internal", "index.d.ts"),
          [
            "export interface Ok__Alias_1$instance<T> {",
            '  readonly "__tsonic_binding_alias_Acme.Core.Ok__Alias_1"?: never;',
            "  readonly value: T;",
            "}",
            "export type Ok__Alias_1<T> = Ok__Alias_1$instance<T>;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core.d.ts"),
          [
            'import type { Ok__Alias_1 } from "./Acme.Core/internal/index.js";',
            "export type Ok<T> = Ok__Alias_1<T>;",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import type { Ok } from "../tsonic/bindings/Acme.Core.js";',
            "export const value: Ok<string> | undefined = undefined;",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const valueDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "value"
        );
        expect(valueDecl).to.not.equal(undefined);
        if (!valueDecl) return;

        const declaredType = valueDecl.declarations[0]?.type;
        expect(declaredType?.kind).to.equal("unionType");
        if (!declaredType || declaredType.kind !== "unionType") return;

        const okType = declaredType.types.find(
          (type) => type.kind === "referenceType"
        );
        expect(okType).to.not.equal(undefined);
        if (!okType || okType.kind !== "referenceType") return;

        expect(okType.name).to.equal("Acme.Core.Ok__Alias_1");
        expect(okType.resolvedClrType).to.equal("Acme.Core.Ok__Alias`1");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("narrows typeof checks in js-surface branches to the matching primitive type", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-typeof-narrowing-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(value: unknown): void {",
            '  if (typeof value === "number") {',
            "    console.log(value.toString());",
            '  } else if (typeof value === "string") {',
            "    console.log(value.toUpperCase());",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const mainFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(mainFn).to.not.equal(undefined);
        if (!mainFn) return;

        const numberIf = mainFn.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
            stmt.kind === "ifStatement"
        );
        expect(numberIf).to.not.equal(undefined);
        if (!numberIf) return;

        const numberExprStmt =
          numberIf.thenStatement.kind === "blockStatement"
            ? numberIf.thenStatement.statements[0]
            : undefined;
        expect(numberExprStmt?.kind).to.equal("expressionStatement");
        if (
          !numberExprStmt ||
          numberExprStmt.kind !== "expressionStatement" ||
          numberExprStmt.expression.kind !== "call"
        ) {
          return;
        }

        const numberToStringCall = numberExprStmt.expression.arguments[0];
        expect(numberToStringCall?.kind).to.equal("call");
        if (!numberToStringCall || numberToStringCall.kind !== "call") return;
        expect(numberToStringCall.callee.kind).to.equal("memberAccess");
        if (numberToStringCall.callee.kind !== "memberAccess") return;
        expect(numberToStringCall.callee.object.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });

        const stringIf =
          numberIf.elseStatement?.kind === "ifStatement"
            ? numberIf.elseStatement
            : undefined;
        expect(stringIf).to.not.equal(undefined);
        if (!stringIf) return;

        const stringExprStmt =
          stringIf.thenStatement.kind === "blockStatement"
            ? stringIf.thenStatement.statements[0]
            : undefined;
        expect(stringExprStmt?.kind).to.equal("expressionStatement");
        if (
          !stringExprStmt ||
          stringExprStmt.kind !== "expressionStatement" ||
          stringExprStmt.expression.kind !== "call"
        ) {
          return;
        }

        const stringCall = stringExprStmt.expression.arguments[0];
        expect(stringCall?.kind).to.equal("call");
        if (!stringCall || stringCall.kind !== "call") return;
        expect(stringCall.callee.kind).to.equal("memberAccess");
        if (stringCall.callee.kind !== "memberAccess") return;
        expect(stringCall.callee.object.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Core intrinsic provenance", () => {
    const expectVariableInitializerKind = (
      source: string,
      variableName: string,
      expectedKind: string
    ): void => {
      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const variableStmt = result.value.body.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (decl) =>
              decl.name.kind === "identifierPattern" &&
              decl.name.name === variableName
          )
      );
      expect(variableStmt).to.not.equal(undefined);
      if (!variableStmt) return;

      const declaration = variableStmt.declarations.find(
        (decl) =>
          decl.name.kind === "identifierPattern" &&
          decl.name.name === variableName
      );
      expect(declaration?.initializer?.kind).to.equal(expectedKind);
    };

    it("does not lower locally declared nameof as the compiler intrinsic", () => {
      expectVariableInitializerKind(
        `
          function nameof(value: string): string {
            return value + "!";
          }

          export const label = nameof("x");
        `,
        "label",
        "call"
      );
    });

    it("does not lower locally declared sizeof as the compiler intrinsic", () => {
      expectVariableInitializerKind(
        `
          function sizeof<T>(): number {
            return 4;
          }

          export const bytes = sizeof<number>();
        `,
        "bytes",
        "call"
      );
    });

    it("does not lower locally declared defaultof/trycast/stackalloc/asinterface intrinsics", () => {
      const source = `
        function defaultof<T>(): T | undefined {
          return undefined;
        }
        function trycast<T>(value: unknown): T | undefined {
          return value as T | undefined;
        }
        function stackalloc<T>(size: number): T {
          throw new Error(String(size));
        }
        function asinterface<T>(value: unknown): T {
          return value as T;
        }

        interface Box { value: number; }

        export const fallback = defaultof<number>();
        export const maybe = trycast<Box>({ value: 1 });
        export const mem = stackalloc<number>(16);
        export const view = asinterface<Box>({ value: 1 });
      `;

      for (const variableName of ["fallback", "maybe", "mem", "view"]) {
        expectVariableInitializerKind(source, variableName, "call");
      }
    });
  });

  describe("Import Extraction", () => {
    it("should extract local imports", () => {
      const source = `
        import { User } from "./models/User.ts";
        import * as utils from "./utils.ts";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const imports = result.value.imports;
        expect(imports).to.have.length(2);

        const firstImport = imports[0];
        const secondImport = imports[1];
        if (!firstImport || !secondImport) throw new Error("Missing imports");

        expect(firstImport.source).to.equal("./models/User.ts");
        expect(firstImport.isLocal).to.equal(true);
        expect(firstImport.isClr).to.equal(false);

        expect(secondImport.source).to.equal("./utils.ts");
        const firstSpec = secondImport.specifiers[0];
        if (!firstSpec) throw new Error("Missing specifier");
        expect(firstSpec.kind).to.equal("namespace");
      }
    });

    it("should attach resolvedClrValue for tsbindgen flattened named exports", () => {
      const source = `
        import { buildSite } from "@demo/pkg/Demo.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      // Stub CLR resolution for this unit test (no filesystem / node resolution).
      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@demo/pkg/Demo.js"
            ? {
                isClr: true,
                packageName: "@demo/pkg",
                resolvedNamespace: "Demo",
                bindingsPath: "/x/bindings.json",
                assembly: "Demo",
              }
            : { isClr: false },
      };

      // Provide a minimal tsbindgen bindings.json excerpt with exports.
      ctx.bindings.addBindings("/x/bindings.json", {
        namespace: "Demo",
        types: [],
        exports: {
          buildSite: {
            kind: "method",
            clrName: "buildSite",
            declaringClrType: "Demo.BuildSite",
            declaringAssemblyName: "Demo",
          },
        },
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing imports");
      expect(imp.isClr).to.equal(true);
      expect(imp.resolvedNamespace).to.equal("Demo");

      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named")
        throw new Error("Missing named specifier");
      expect(spec.name).to.equal("buildSite");
      expect(spec.isType).to.not.equal(true);
      expect(spec.resolvedClrValue).to.deep.equal({
        declaringClrType: "Demo.BuildSite",
        declaringAssemblyName: "Demo",
        memberName: "buildSite",
      });
    });

    it("should attach resolvedClrType for CLR type imports used as values", () => {
      const source = `
        import { Task as TaskValue } from "@tsonic/dotnet/System.Threading.Tasks.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@tsonic/dotnet/System.Threading.Tasks.js"
            ? {
                isClr: true,
                packageName: "@tsonic/dotnet",
                resolvedNamespace: "System.Threading.Tasks",
                bindingsPath: "/x/tasks.bindings.json",
                assembly: "System.Runtime",
              }
            : { isClr: false },
      };

      ctx.bindings.addBindings("/x/tasks.bindings.json", {
        namespace: "System.Threading.Tasks",
        types: [
          {
            alias: "Task",
            clrName: "System.Threading.Tasks.Task",
            assemblyName: "System.Runtime",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
        exports: {},
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing imports");
      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") {
        throw new Error("Missing named specifier");
      }
      expect(spec.name).to.equal("Task");
      expect(spec.localName).to.equal("TaskValue");
      expect(spec.isType).to.not.equal(true);
      expect(spec.resolvedClrType).to.equal("System.Threading.Tasks.Task");
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("should error if a CLR namespace value import lacks tsbindgen exports mapping", () => {
      const source = `
        import { buildSite } from "@demo/pkg/Demo.js";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);

      // Stub CLR resolution for this unit test (no filesystem / node resolution).
      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: (s: string) =>
          s === "@demo/pkg/Demo.js"
            ? {
                isClr: true,
                packageName: "@demo/pkg",
                resolvedNamespace: "Demo",
                bindingsPath: "/x/bindings.json",
                assembly: "Demo",
              }
            : { isClr: false },
      };

      // Provide a minimal tsbindgen bindings.json excerpt WITHOUT exports.
      ctx.bindings.addBindings("/x/bindings.json", {
        namespace: "Demo",
        types: [],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN4004")).to.equal(true);
    });

    it("treats node alias named imports as module-bound values without TSN4004", () => {
      const source = `
        import { join } from "node:path";
        void join;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = { ...baseOptions, surface: "@tsonic/js" as const };
      (ctx as { surface: "@tsonic/js" }).surface = "@tsonic/js";

      (
        ctx as unknown as { clrResolver: { resolve: (s: string) => unknown } }
      ).clrResolver = {
        resolve: () => ({ isClr: false }),
      };
      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "node:path": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.path",
          },
          path: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.path",
          },
        },
      });
      ctx.bindings.addBindings("/x/node-types.json", {
        namespace: "nodejs",
        types: [
          {
            clrName: "nodejs.path",
            assemblyName: "nodejs",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(ctx.diagnostics.some((d) => d.code === "TSN4004")).to.equal(false);
      const imp = result.value.imports[0];
      if (!imp) throw new Error("Missing import");
      expect(imp.source).to.equal("node:path");
      expect(imp.resolvedClrType).to.equal("nodejs.path");
      const spec = imp.specifiers[0];
      if (!spec || spec.kind !== "named") throw new Error("Missing named spec");
      expect(spec.name).to.equal("join");
      expect(spec.resolvedClrValue).to.equal(undefined);
    });

    it("resolves module-bound import type clauses to owning CLR types", () => {
      const source = `
        import type { IncomingMessage, ServerResponse } from "node:http";
        let req: IncomingMessage | undefined;
        let res: ServerResponse | undefined;
        void req;
        void res;
      `;

      const {
        testProgram,
        ctx,
        options: baseOptions,
      } = createTestProgram(source);
      const options = {
        ...baseOptions,
        surface: "@tsonic/js" as const,
      };

      ctx.bindings.addBindings("/x/node-modules.json", {
        bindings: {
          "node:http": {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.Http.http",
          },
        },
      });

      const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-node-http-")
      );
      const declPath = path.join(
        tempRoot,
        "nodejs.Http",
        "internal",
        "index.d.ts"
      );
      const bindingsPath = path.join(tempRoot, "nodejs.Http", "bindings.json");
      fs.mkdirSync(path.dirname(declPath), { recursive: true });
      fs.writeFileSync(declPath, "export type IncomingMessage = unknown;\n");
      fs.writeFileSync(
        bindingsPath,
        JSON.stringify({ namespace: "nodejs.Http" }),
        "utf-8"
      );

      const bindingApi = ctx.binding as unknown as {
        resolveImport: (node: ts.ImportSpecifier) => number | undefined;
        getSourceFilePathOfDecl: (decl: number) => string | undefined;
      };
      bindingApi.resolveImport = () => 1;
      bindingApi.getSourceFilePathOfDecl = () => declPath;

      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const imp = result.value.imports[0];
        if (!imp) throw new Error("Missing import");

        const incoming = imp.specifiers[0];
        const response = imp.specifiers[1];
        if (
          !incoming ||
          incoming.kind !== "named" ||
          !response ||
          response.kind !== "named"
        ) {
          throw new Error("Missing named import specifiers");
        }

        expect(incoming.isType).to.equal(true);
        expect(incoming.resolvedClrType).to.equal(
          "nodejs.Http.IncomingMessage"
        );
        expect(response.isType).to.equal(true);
        expect(response.resolvedClrType).to.equal("nodejs.Http.ServerResponse");
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it("should not detect bare imports as .NET without package bindings", () => {
      // Import-driven resolution: bare imports like "System.IO" are only detected as .NET
      // if they come from a package with bindings.json. Without an actual package,
      // the import is not recognized as .NET.
      const source = `
        import { File } from "System.IO";
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const imports = result.value.imports;
        const firstImport = imports[0];
        if (!firstImport) throw new Error("Missing import");
        // Without an actual package with bindings.json, this is NOT detected as .NET
        expect(firstImport.isClr).to.equal(false);
        expect(firstImport.resolvedNamespace).to.equal(undefined);
      }
    });
  });

  describe("Call Inference Regressions", () => {
    it("infers generic call return type for undefined identifier arguments", () => {
      const source = `
        function ok<T>(data: T): T {
          return data;
        }

        export function run(): undefined {
          return ok(undefined);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const retStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(retStmt?.expression?.kind).to.equal("call");
      if (!retStmt?.expression || retStmt.expression.kind !== "call") return;

      expect(retStmt.expression.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "undefined",
      });
    });

    it("keeps numeric assertions from unknown sources as runtime type assertions", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        export function run(data: Record<string, unknown>, key: string): int {
          const value = data[key];
          return value as int;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const retStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(retStmt?.expression?.kind).to.equal("typeAssertion");
    });

    it("accepts empty array literals when contextual type is available", () => {
      const source = `
        export function run(flag: boolean): string[] {
          const a = ["x"];
          const out = flag ? a : [];
          return out;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
    });

    it("accepts empty array literals in conditional branches when overall branch type is array", () => {
      const source = `
        import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

        export function run(flag: boolean): string[] {
          const values = new List<string>();
          values.Add("x");
          const out = flag ? values.ToArray() : [];
          return out;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
    });

    it("infers boolean declaration types for shorthand object synthesis in generic calls", () => {
      const source = `
        function ok<T>(data: T): T {
          return data;
        }

        export function run(anchor: string, numAfter: number, numBefore: number): {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        } {
          const foundAnchor = anchor !== "newest" && anchor !== "oldest";
          const foundNewest = numAfter < 1 || anchor === "newest";
          const foundOldest = numBefore < 1 || anchor === "oldest";
          return ok({ foundAnchor, foundNewest, foundOldest });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
    });

    it("lowers method shorthand to function-valued properties during object synthesis", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      expect(decl).to.not.equal(undefined);
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "ops"
      )?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
    });

    it("supports computed string-literal method shorthand during synthesis", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            ["add"](x: number, y: number): number {
              return x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const computedAddProp = arg0.properties.find((prop) => {
        if (prop.kind !== "property") return false;
        return prop.key === "add" && prop.value.kind === "functionExpression";
      });
      expect(computedAddProp).to.not.equal(undefined);
    });

    it("rewrites object-literal method arguments.length to a fixed arity literal", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return arguments.length + x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
      if (addProp.value.kind !== "functionExpression") return;

      const stmt = addProp.value.body?.statements[0];
      expect(stmt?.kind).to.equal("returnStatement");
      if (!stmt || stmt.kind !== "returnStatement" || !stmt.expression) return;

      expect(stmt.expression.kind).to.equal("binary");
      if (stmt.expression.kind !== "binary") return;
      expect(stmt.expression.left.kind).to.equal("binary");
      if (stmt.expression.left.kind !== "binary") return;
      expect(stmt.expression.left.left.kind).to.equal("literal");
      if (stmt.expression.left.left.kind !== "literal") return;
      expect(stmt.expression.left.left.value).to.equal(2);
    });

    it("rewrites object-literal method arguments[n] to captured parameter temps", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return (arguments[0] as number) + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
      if (addProp.value.kind !== "functionExpression" || !addProp.value.body)
        return;

      const [captureDecl, returnStmt] = addProp.value.body.statements;
      expect(captureDecl?.kind).to.equal("variableDeclaration");
      if (!captureDecl || captureDecl.kind !== "variableDeclaration") return;

      const captureInit = captureDecl.declarations[0]?.initializer;
      expect(captureInit?.kind).to.equal("identifier");
      if (!captureInit || captureInit.kind !== "identifier") return;
      expect(captureInit.name).to.equal("x");

      expect(returnStmt?.kind).to.equal("returnStatement");
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression ||
        returnStmt.expression.kind !== "binary"
      ) {
        return;
      }

      expect(returnStmt.expression.left.kind).to.equal("typeAssertion");
      if (returnStmt.expression.left.kind !== "typeAssertion") return;
      expect(returnStmt.expression.left.expression.kind).to.equal("identifier");
      if (returnStmt.expression.left.expression.kind !== "identifier") return;
      expect(returnStmt.expression.left.expression.name).to.include(
        "__tsonic_object_method_argument_0"
      );
    });

    it("normalizes computed const-literal property and accessor keys during synthesis", () => {
      const source = `
        export function run(): number {
          const valueKey = "value";
          const doubledKey = "doubled";
          const obj = {
            [valueKey]: 21,
            get [doubledKey](): number {
              return this.value * 2;
            },
          };
          return obj.doubled;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer !== undefined
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const valueProp = initializer.properties.find(
        (prop) => prop.kind === "property" && prop.key === "value"
      );
      expect(valueProp).to.not.equal(undefined);

      const doubledAccessor = initializer.behaviorMembers?.find(
        (member) =>
          member.kind === "propertyDeclaration" && member.name === "doubled"
      );
      expect(doubledAccessor).to.not.equal(undefined);
    });

    it("infers unannotated object literal getter types from deterministic bodies", () => {
      const source = `
        export function run(): number {
          const obj = {
            value: 21,
            get doubled() {
              return this.value * 2;
            },
          };
          return obj.doubled;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const doubledMember = objectType.members.find(
        (member) =>
          member.kind === "propertySignature" && member.name === "doubled"
      );
      expect(doubledMember?.kind).to.equal("propertySignature");
      if (!doubledMember || doubledMember.kind !== "propertySignature") return;
      expect(doubledMember.type.kind).to.equal("primitiveType");
      if (doubledMember.type.kind !== "primitiveType") return;
      expect(doubledMember.type.name).to.equal("number");
    });

    it("infers unannotated object literal method return types from deterministic bodies", () => {
      const source = `
        export function run(): number {
          const obj = {
            value: 21,
            inc() {
              this.value += 1;
              return this.value;
            },
          };
          return obj.inc();
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const incMember = objectType.members.find(
        (member) => member.kind === "propertySignature" && member.name === "inc"
      );
      expect(incMember?.kind).to.equal("propertySignature");
      if (!incMember || incMember.kind !== "propertySignature") return;
      expect(incMember.type.kind).to.equal("functionType");
      if (incMember.type.kind !== "functionType") return;
      expect(incMember.type.returnType.kind).to.not.equal("voidType");
      expect(incMember.type.returnType.kind).to.not.equal("unknownType");
      expect(incMember.type.returnType.kind).to.not.equal("anyType");

      const returnStmt = run.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("call");
      if (returnStmt.expression.kind !== "call") return;
      expect(returnStmt.expression.inferredType?.kind).to.not.equal("voidType");
      expect(returnStmt.expression.inferredType?.kind).to.not.equal(
        "unknownType"
      );
      expect(returnStmt.expression.inferredType?.kind).to.not.equal("anyType");
    });

    it("synthesizes exact numeric properties after nullish fallback narrowing", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseRole(raw: string): int | undefined;

        export function run(raw: string): int {
          const parsedInviteAsRole = parseRole(raw);
          const inviteAsRole = parsedInviteAsRole ?? (400 as int);
          const input = {
            inviteAsRole,
          };
          return input.inviteAsRole;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(
        ctx.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "TSN5203" &&
            diagnostic.message.includes("inviteAsRole")
        )
      ).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "input" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "input"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const inviteAsRoleMember = objectType.members.find(
        (member) =>
          member.kind === "propertySignature" && member.name === "inviteAsRole"
      );
      expect(inviteAsRoleMember?.kind).to.equal("propertySignature");
      if (
        !inviteAsRoleMember ||
        inviteAsRoleMember.kind !== "propertySignature"
      )
        return;
      expect(inviteAsRoleMember.type.kind).to.equal("primitiveType");
      if (inviteAsRoleMember.type.kind !== "primitiveType") return;
      expect(inviteAsRoleMember.type.name).to.equal("int");
    });

    it("normalizes computed const-literal numeric keys during synthesis", () => {
      const source = `
        export function run(): number {
          const slot = 1;
          const obj = {
            [slot]: 7,
          };
          return obj["1"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer !== undefined
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const slotProp = initializer.properties.find(
        (prop) => prop.kind === "property" && prop.key === "1"
      );
      expect(slotProp).to.not.equal(undefined);
    });

    it("threads expected return generic context into call argument typing", () => {
      const source = `
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        function ok<T>(data: T): Ok<T> {
          return { success: true, data };
        }

        interface Payload {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        }

        export function run(anchor: string): Result<Payload, string> {
          const foundAnchor = anchor !== "newest" && anchor !== "oldest";
          const foundNewest = anchor === "newest";
          const foundOldest = anchor === "oldest";
          return ok({ foundAnchor, foundNewest, foundOldest });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const retStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(retStmt?.expression?.kind).to.equal("call");
      if (!retStmt?.expression || retStmt.expression.kind !== "call") return;

      const arg0 = retStmt.expression.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;
      expect(arg0.inferredType?.kind).to.equal("referenceType");
      if (arg0.inferredType?.kind === "referenceType") {
        expect(arg0.inferredType.name).to.equal("Payload");
      }
    });

    it("threads expected return generic context through async Promise wrappers", () => {
      const source = `
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        function ok<T>(data: T): Ok<T> {
          return { success: true, data };
        }

        interface Payload {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        }

        export async function run(anchor: string): Promise<Result<Payload, string>> {
          const foundAnchor = anchor !== "newest" && anchor !== "oldest";
          const foundNewest = anchor === "newest";
          const foundOldest = anchor === "oldest";
          return ok({ foundAnchor, foundNewest, foundOldest });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const retStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(retStmt?.expression?.kind).to.equal("call");
      if (!retStmt?.expression || retStmt.expression.kind !== "call") return;

      const arg0 = retStmt.expression.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;
      expect(arg0.inferredType?.kind).to.equal("referenceType");
      if (arg0.inferredType?.kind === "referenceType") {
        expect(arg0.inferredType.name).to.equal("Payload");
      }
    });

    it("threads expected return generic context through imported declaration aliases", () => {
      const testFiles = {
        "package.json": JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "src/index.ts": `
          import type { Result } from "./core.js";
          import { ok } from "./core.js";

          interface Payload {
            foundAnchor: boolean;
            foundNewest: boolean;
            foundOldest: boolean;
          }

          export function run(anchor: string): Result<Payload, string> {
            const foundAnchor = anchor !== "newest" && anchor !== "oldest";
            const foundNewest = anchor === "newest";
            const foundOldest = anchor === "oldest";
            return ok({ foundAnchor, foundNewest, foundOldest });
          }
        `,
        "src/core.d.ts": `
          export interface Ok<T> {
            readonly success: true;
            readonly data: T;
          }

          export interface Err<E> {
            readonly success: false;
            readonly error: E;
          }

          export type Result<T, E> = Ok<T> | Err<E>;

          export declare function ok<T>(data: T): Ok<T>;
        `,
      };

      const { sourceFile, testProgram, ctx, options, cleanup } =
        createFilesystemTestProgram(testFiles, "src/index.ts");

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const run = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(run).to.not.equal(undefined);
        if (!run) return;

        const retStmt = run.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(retStmt?.expression?.kind).to.equal("call");
        if (!retStmt?.expression || retStmt.expression.kind !== "call") return;

        const arg0 = retStmt.expression.arguments[0];
        expect(arg0?.kind).to.equal("object");
        if (!arg0 || arg0.kind !== "object") return;
        expect(arg0.inferredType?.kind).to.equal("referenceType");
        if (arg0.inferredType?.kind === "referenceType") {
          expect(arg0.inferredType.name).to.equal("Payload");
        }
      } finally {
        cleanup();
      }
    });

    it("threads expected return generic context through imported declaration aliases inside Promise wrappers", () => {
      const testFiles = {
        "package.json": JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "src/index.ts": `
          import type { Result } from "./core.js";
          import { ok } from "./core.js";

          interface Payload {
            foundAnchor: boolean;
            foundNewest: boolean;
            foundOldest: boolean;
          }

          export async function run(anchor: string): Promise<Result<Payload, string>> {
            const foundAnchor = anchor !== "newest" && anchor !== "oldest";
            const foundNewest = anchor === "newest";
            const foundOldest = anchor === "oldest";
            return ok({ foundAnchor, foundNewest, foundOldest });
          }
        `,
        "src/core.d.ts": `
          export interface Ok<T> {
            readonly success: true;
            readonly data: T;
          }

          export interface Err<E> {
            readonly success: false;
            readonly error: E;
          }

          export type Result<T, E> = Ok<T> | Err<E>;

          export declare function ok<T>(data: T): Ok<T>;
        `,
      };

      const { sourceFile, testProgram, ctx, options, cleanup } =
        createFilesystemTestProgram(testFiles, "src/index.ts");

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const run = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(run).to.not.equal(undefined);
        if (!run) return;

        const retStmt = run.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(retStmt?.expression?.kind).to.equal("call");
        if (!retStmt?.expression || retStmt.expression.kind !== "call") return;

        const arg0 = retStmt.expression.arguments[0];
        expect(arg0?.kind).to.equal("object");
        if (!arg0 || arg0.kind !== "object") return;
        expect(arg0.inferredType?.kind).to.equal("referenceType");
        if (arg0.inferredType?.kind === "referenceType") {
          expect(arg0.inferredType.name).to.equal("Payload");
        }
      } finally {
        cleanup();
      }
    });

    it("does not leak type-alias cache entries across program contexts", () => {
      const sourceA = `
        export type UserId = string;
        export function use(id: UserId): UserId {
          return id;
        }
      `;

      const sourceB = `
        export type UserId = number;
        export function use(id: UserId): UserId {
          return id;
        }
      `;

      const first = createTestProgram(sourceA);
      const firstFile = first.testProgram.sourceFiles[0];
      if (!firstFile) throw new Error("Failed to create source file A");
      const firstResult = buildIrModule(
        firstFile,
        first.testProgram,
        first.options,
        first.ctx
      );
      expect(firstResult.ok).to.equal(true);
      if (!firstResult.ok) return;

      const second = createTestProgram(sourceB);
      const secondFile = second.testProgram.sourceFiles[0];
      if (!secondFile) throw new Error("Failed to create source file B");
      const secondResult = buildIrModule(
        secondFile,
        second.testProgram,
        second.options,
        second.ctx
      );
      expect(secondResult.ok).to.equal(true);
      if (!secondResult.ok) return;

      const useFn = secondResult.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "use"
      );
      expect(useFn).to.not.equal(undefined);
      if (!useFn) return;

      const param = useFn.parameters[0];
      expect(param?.type).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
      expect(useFn.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
    });

    it("keeps alias conversion deterministic across alternating compilations", () => {
      const sourceString = `
        export type UserId = string;
        export function use(id: UserId): UserId {
          return id;
        }
      `;

      const sourceNumber = `
        export type UserId = number;
        export function use(id: UserId): UserId {
          return id;
        }
      `;

      const sourceBoolean = `
        export type UserId = boolean;
        export function use(id: UserId): UserId {
          return id;
        }
      `;

      const buildUseFn = (source: string): IrFunctionDeclaration => {
        const test = createTestProgram(source);
        const file = test.testProgram.sourceFiles[0];
        if (!file) throw new Error("Failed to create source file");
        const result = buildIrModule(
          file,
          test.testProgram,
          test.options,
          test.ctx
        );
        expect(result.ok).to.equal(true);
        if (!result.ok) throw new Error(result.error.message);
        const useFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "use"
        );
        if (!useFn) throw new Error("Missing use function");
        return useFn;
      };

      const first = buildUseFn(sourceString);
      expect(first.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(first.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });

      const second = buildUseFn(sourceNumber);
      expect(second.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
      expect(second.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });

      const third = buildUseFn(sourceBoolean);
      expect(third.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "boolean",
      });
      expect(third.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "boolean",
      });

      const fourth = buildUseFn(sourceString);
      expect(fourth.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(fourth.returnType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });
  });

  describe("Statement Conversion", () => {
    it("should convert function declarations", () => {
      const source = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        expect(body).to.have.length(1);

        const firstItem = body[0];
        if (!firstItem) throw new Error("Missing body item");
        expect(firstItem.kind).to.equal("functionDeclaration");

        const func = firstItem as IrFunctionDeclaration;
        expect(func.name).to.equal("add");
        expect(func.parameters).to.have.length(2);
        expect(func.isExported).to.equal(true);
      }
    });

    it("should convert variable declarations", () => {
      // Use explicit type annotation for object literal to avoid synthetic type generation
      const source = `
        interface Named { name: string }
        const x = 10;
        let y: string = "hello";
        export const z: Named = { name: "test" };
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        // 4 statements: interface + 3 variable declarations
        expect(body).to.have.length(4);

        const firstDecl = body[0] as IrInterfaceDeclaration;
        expect(firstDecl.kind).to.equal("interfaceDeclaration");

        const firstVar = body[1] as IrVariableDeclaration;
        expect(firstVar.kind).to.equal("variableDeclaration");
        expect(firstVar.declarationKind).to.equal("const");

        const secondVar = body[2] as IrVariableDeclaration;
        expect(secondVar.declarationKind).to.equal("let");

        const thirdVar = body[3] as IrVariableDeclaration;
        expect(thirdVar.isExported).to.equal(true);
      }
    });

    it("should convert class declarations", () => {
      const source = `
        export class User {
          private name: string;
          constructor(name: string) {
            this.name = name;
          }
          getName(): string {
            return this.name;
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        expect(body).to.have.length(1);

        const cls = body[0] as IrClassDeclaration;
        expect(cls.kind).to.equal("classDeclaration");
        expect(cls.name).to.equal("User");
        expect(cls.isExported).to.equal(true);
        expect(cls.members).to.have.length.greaterThan(0);
      }
    });

    it("preserves readonly-only constructor parameter properties as class members", () => {
      const source = `
        export class BoolValue {
          constructor(readonly value: boolean) {}
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const cls = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "BoolValue"
      );
      expect(cls).to.not.equal(undefined);
      if (!cls) return;

      const valueProp = cls.members.find(
        (member) =>
          member.kind === "propertyDeclaration" && member.name === "value"
      );
      expect(valueProp).to.not.equal(undefined);
      expect(valueProp?.kind).to.equal("propertyDeclaration");
      if (!valueProp || valueProp.kind !== "propertyDeclaration") return;

      expect(valueProp.isReadonly).to.equal(true);
      expect(valueProp.accessibility).to.equal("public");
      expect(valueProp.type).to.deep.equal({
        kind: "primitiveType",
        name: "boolean",
      });
    });

    it("places parameter-property assignments after a leading super call", () => {
      const source = `
        class Base {
          constructor(readonly tag: string) {}
        }

        export class Derived extends Base {
          constructor(readonly value: boolean) {
            super("ok");
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const cls = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "Derived"
      );
      expect(cls).to.not.equal(undefined);
      if (!cls) return;

      const ctor = cls.members.find(
        (member) => member.kind === "constructorDeclaration"
      );
      expect(ctor).to.not.equal(undefined);
      expect(ctor?.kind).to.equal("constructorDeclaration");
      if (!ctor || ctor.kind !== "constructorDeclaration" || !ctor.body) return;

      expect(ctor.body.statements[0]?.kind).to.equal("expressionStatement");
      expect(ctor.body.statements[1]?.kind).to.equal("expressionStatement");
      const firstExpr = ctor.body.statements[0];
      const secondExpr = ctor.body.statements[1];
      if (
        !firstExpr ||
        firstExpr.kind !== "expressionStatement" ||
        !secondExpr ||
        secondExpr.kind !== "expressionStatement"
      ) {
        return;
      }

      expect(firstExpr.expression.kind).to.equal("call");
      if (firstExpr.expression.kind === "call") {
        expect(firstExpr.expression.callee.kind).to.equal("identifier");
        if (firstExpr.expression.callee.kind === "identifier") {
          expect(firstExpr.expression.callee.name).to.equal("super");
        }
      }

      expect(secondExpr.expression.kind).to.equal("assignment");
      if (secondExpr.expression.kind === "assignment") {
        expect(secondExpr.expression.left.kind).to.equal("memberAccess");
        if (secondExpr.expression.left.kind === "memberAccess") {
          expect(secondExpr.expression.left.object.kind).to.equal("this");
          expect(secondExpr.expression.left.property).to.equal("value");
        }
      }
    });
  });

  describe("Expression Conversion", () => {
    it("should convert template literals", () => {
      const source = `
        const greeting = \`Hello \${name}\`;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body[0] as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        if (init && init.kind === "templateLiteral") {
          expect(init.kind).to.equal("templateLiteral");
          expect(init.quasis).to.have.length(2);
          expect(init.expressions).to.have.length(1);
        }
      }
    });

    it("should convert arrow functions", () => {
      const source = `
        const double = (x: number) => x * 2;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body[0] as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        if (init && init.kind === "arrowFunction") {
          expect(init.kind).to.equal("arrowFunction");
          expect(init.parameters).to.have.length(1);
        }
      }
    });

    it("should lower import.meta.url to a string literal", () => {
      const source = `
        const url = import.meta.url;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body[0] as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        expect(init?.kind).to.equal("literal");
        if (init?.kind === "literal") {
          expect(typeof init.value).to.equal("string");
          expect((init.value as string).startsWith("file://")).to.equal(true);
        }
      }
    });

    it("should lower bare import.meta to an object literal with deterministic fields", () => {
      const source = `
        declare global {
          interface ImportMeta {
            readonly url: string;
            readonly filename: string;
            readonly dirname: string;
          }
        }
        const meta = import.meta;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body.at(-1) as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        expect(init?.kind).to.equal("object");
        if (init?.kind === "object") {
          expect(
            init.properties.filter((prop) => prop.kind === "property")
          ).to.have.length(3);
        }
      }
    });

    it("should attach deterministic namespace objects to closed-world dynamic import values", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-dynamic-import-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export async function load() {",
            '  const module = await import("./module.js");',
            "  return module.value;",
            "}",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(srcDir, "module.ts"),
          "export const value = 42;\n"
        );

        const tsProgram = ts.createProgram(
          [entryPath, path.join(srcDir, "module.ts")],
          {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          }
        );
        const checker = tsProgram.getTypeChecker();
        const sourceFile = tsProgram.getSourceFile(entryPath);
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;
        const moduleSourceFile = tsProgram.getSourceFile(
          path.join(srcDir, "module.ts")
        );
        expect(moduleSourceFile).to.not.equal(undefined);
        if (!moduleSourceFile) return;

        const program = {
          program: tsProgram,
          checker,
          options: {
            projectRoot: tempDir,
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
            strict: true,
          },
          sourceFiles: [sourceFile, moduleSourceFile],
          declarationSourceFiles: [],
          metadata: new DotnetMetadataRegistry(),
          bindings: new BindingRegistry(),
          clrResolver: createClrBindingsResolver(tempDir),
          binding: createBinding(checker),
        };

        const options = { sourceRoot: srcDir, rootNamespace: "TestApp" };
        const ctx = createProgramContext(program, options);

        const moduleResult = buildIrModule(sourceFile, program, options, ctx);

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const loadFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "load"
        );
        expect(loadFn).to.not.equal(undefined);
        if (!loadFn) return;

        const declStmt = loadFn.body.statements[0];
        expect(declStmt?.kind).to.equal("variableDeclaration");
        if (!declStmt || declStmt.kind !== "variableDeclaration") return;

        const initializer = declStmt.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("await");
        if (!initializer || initializer.kind !== "await") return;

        const call = initializer.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.dynamicImportNamespace?.kind).to.equal("object");
        if (!call.dynamicImportNamespace) return;

        expect(call.dynamicImportNamespace.properties).to.have.length(1);
        const property = call.dynamicImportNamespace.properties[0];
        expect(property?.kind).to.equal("property");
        if (!property || property.kind !== "property") return;

        expect(property.key).to.equal("value");
        expect(property.value.kind).to.equal("memberAccess");
        expect(property.value.inferredType?.kind).to.not.equal("voidType");
        expect(property.value.inferredType?.kind).to.not.equal("unknownType");
        expect(property.value.inferredType?.kind).to.not.equal("anyType");
        expect(call.inferredType?.kind).to.equal("referenceType");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should preserve callable exports as function-valued namespace members", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-dynamic-import-fn-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export async function load() {",
            '  const module = await import("./module.js");',
            "  return module.value;",
            "}",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(srcDir, "module.ts"),
          "export function value(): number { return 42; }\n"
        );

        const tsProgram = ts.createProgram(
          [entryPath, path.join(srcDir, "module.ts")],
          {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          }
        );
        const checker = tsProgram.getTypeChecker();
        const sourceFile = tsProgram.getSourceFile(entryPath);
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;
        const moduleSourceFile = tsProgram.getSourceFile(
          path.join(srcDir, "module.ts")
        );
        expect(moduleSourceFile).to.not.equal(undefined);
        if (!moduleSourceFile) return;

        const program = {
          program: tsProgram,
          checker,
          options: {
            projectRoot: tempDir,
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
            strict: true,
          },
          sourceFiles: [sourceFile, moduleSourceFile],
          declarationSourceFiles: [],
          metadata: new DotnetMetadataRegistry(),
          bindings: new BindingRegistry(),
          clrResolver: createClrBindingsResolver(tempDir),
          binding: createBinding(checker),
        };

        const options = { sourceRoot: srcDir, rootNamespace: "TestApp" };
        const ctx = createProgramContext(program, options);
        const moduleResult = buildIrModule(sourceFile, program, options, ctx);

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const loadFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "load"
        );
        expect(loadFn).to.not.equal(undefined);
        if (!loadFn) return;

        const declStmt = loadFn.body.statements[0];
        expect(declStmt?.kind).to.equal("variableDeclaration");
        if (!declStmt || declStmt.kind !== "variableDeclaration") return;

        const initializer = declStmt.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("await");
        if (!initializer || initializer.kind !== "await") return;

        const call = initializer.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call" || !call.dynamicImportNamespace) return;

        const property = call.dynamicImportNamespace.properties[0];
        expect(property?.kind).to.equal("property");
        if (!property || property.kind !== "property") return;
        expect(property.value.inferredType?.kind).to.equal("functionType");

        const namespaceType = call.dynamicImportNamespace.inferredType;
        expect(namespaceType?.kind).to.equal("objectType");
        if (!namespaceType || namespaceType.kind !== "objectType") return;

        const valueMember = namespaceType.members.find(
          (member) =>
            member.kind === "propertySignature" && member.name === "value"
        );
        expect(valueMember?.kind).to.equal("propertySignature");
        if (!valueMember || valueMember.kind !== "propertySignature") return;
        expect(valueMember.type.kind).to.equal("functionType");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should represent empty closed-world dynamic import namespaces as Promise<object>", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-dynamic-import-empty-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export async function load(): Promise<object> {",
            '  return import("./module.js");',
            "}",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(srcDir, "module.ts"),
          "export type Value = { readonly ok: true };\n"
        );

        const tsProgram = ts.createProgram(
          [entryPath, path.join(srcDir, "module.ts")],
          {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          }
        );
        const checker = tsProgram.getTypeChecker();
        const sourceFile = tsProgram.getSourceFile(entryPath);
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;
        const moduleSourceFile = tsProgram.getSourceFile(
          path.join(srcDir, "module.ts")
        );
        expect(moduleSourceFile).to.not.equal(undefined);
        if (!moduleSourceFile) return;

        const program = {
          program: tsProgram,
          checker,
          options: {
            projectRoot: tempDir,
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
            strict: true,
          },
          sourceFiles: [sourceFile, moduleSourceFile],
          declarationSourceFiles: [],
          metadata: new DotnetMetadataRegistry(),
          bindings: new BindingRegistry(),
          clrResolver: createClrBindingsResolver(tempDir),
          binding: createBinding(checker),
        };

        const options = { sourceRoot: srcDir, rootNamespace: "TestApp" };
        const ctx = createProgramContext(program, options);

        const moduleResult = buildIrModule(sourceFile, program, options, ctx);

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const loadFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "load"
        );
        expect(loadFn).to.not.equal(undefined);
        if (!loadFn) return;

        const returnStmt = loadFn.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const call = returnStmt.expression;
        expect(call?.kind).to.equal("call");
        if (!call || call.kind !== "call") return;

        expect(call.dynamicImportNamespace?.kind).to.equal("object");
        if (!call.dynamicImportNamespace) return;

        expect(call.dynamicImportNamespace.properties).to.have.length(0);
        expect(call.dynamicImportNamespace.inferredType).to.deep.equal({
          kind: "referenceType",
          name: "object",
        });
        expect(call.inferredType).to.deep.equal({
          kind: "referenceType",
          name: "Promise",
          typeArguments: [{ kind: "referenceType", name: "object" }],
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Export Handling", () => {
    it("should handle named exports", () => {
      const source = `
        const a = 1;
        const b = 2;
        export { a, b as c };
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const exports = result.value.exports;
        expect(exports).to.have.length(2);

        const firstExport = exports[0];
        if (!firstExport) throw new Error("Missing export");
        expect(firstExport.kind).to.equal("named");
        if (firstExport.kind === "named") {
          expect(firstExport.name).to.equal("a");
          expect(firstExport.localName).to.equal("a");
        }

        const second = exports[1];
        if (second && second.kind === "named") {
          expect(second.name).to.equal("c");
          expect(second.localName).to.equal("b");
        }
      }
    });

    it("should handle default export", () => {
      const source = `
        export default function main() {
          console.log("Hello");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const exports = result.value.exports;
        expect(exports.some((e) => e.kind === "default")).to.equal(true);
      }
    });
  });

  describe("Struct Detection", () => {
    it("should detect struct marker in interface", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export interface Point extends struct {
          x: number;
          y: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const pointInterface = body.find(
          (stmt) =>
            stmt.kind === "interfaceDeclaration" && stmt.name === "Point"
        );
        expect(pointInterface).not.to.equal(undefined);
        if (pointInterface && pointInterface.kind === "interfaceDeclaration") {
          expect(pointInterface.isStruct).to.equal(true);
          // Verify __brand property is filtered out
          expect(
            pointInterface.members.some(
              (m) => m.kind === "propertySignature" && m.name === "__brand"
            )
          ).to.equal(false);
        }
      }
    });

    it("should detect struct marker in class", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export class Vector3D implements struct {
          x: number;
          y: number;
          z: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const vectorClass = body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Vector3D"
        );
        expect(vectorClass).not.to.equal(undefined);
        if (vectorClass && vectorClass.kind === "classDeclaration") {
          expect(vectorClass.isStruct).to.equal(true);
          // Verify __brand property is filtered out
          expect(
            vectorClass.members.some(
              (m) => m.kind === "propertyDeclaration" && m.name === "__brand"
            )
          ).to.equal(false);
        }
      }
    });

    it("should not mark regular class as struct", () => {
      const source = `
        export class RegularClass {
          value: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        const regularClass = body[0];
        expect(regularClass).not.to.equal(undefined);
        if (regularClass && regularClass.kind === "classDeclaration") {
          expect(regularClass.isStruct).to.equal(false);
        }
      }
    });
  });

  describe("Implements Clause Handling", () => {
    it("should allow class implements interface (emitter decides CLR shape)", () => {
      const source = `
        interface Printable {
          print(): void;
        }

        export class Document implements Printable {
          print(): void {}
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });

    it("should allow struct marker in implements clause", () => {
      const source = `
        interface struct {
          readonly __brand: "struct";
        }

        export class Point implements struct {
          x: number;
          y: number;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });

    it("should allow class implements type alias (emitter decides CLR shape)", () => {
      const source = `
        type Serializable = {
          serialize(): string;
        };

        export class Config implements Serializable {
          serialize(): string { return "{}"; }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
    });

    it("types Record<string, unknown>.Keys as string[] without unknown poison", () => {
      const source = `
        export function firstKey(settings: Record<string, unknown>): string | undefined {
          const settingsKeys = settings.Keys;
          if (settingsKeys.Length === 0) {
            return undefined;
          }
          return settingsKeys[0];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "firstKey"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const keyDecl = fn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (d) =>
              d.name.kind === "identifierPattern" &&
              d.name.name === "settingsKeys"
          )
      );
      expect(keyDecl).to.not.equal(undefined);
      const keyInit = keyDecl?.declarations[0]?.initializer;
      expect(keyInit?.kind).to.equal("memberAccess");
      if (!keyInit || keyInit.kind !== "memberAccess") return;
      expect(keyInit.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      });
    });

    it("types Record<string, unknown>.Values as unknown[] deterministically", () => {
      const source = `
        export function firstValue(settings: Record<string, unknown>): unknown | undefined {
          const values = settings.Values;
          return values.Length > 0 ? values[0] : undefined;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "firstValue"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const valuesDecl = fn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (d) =>
              d.name.kind === "identifierPattern" && d.name.name === "values"
          )
      );
      expect(valuesDecl).to.not.equal(undefined);
      const valuesInit = valuesDecl?.declarations[0]?.initializer;
      expect(valuesInit?.kind).to.equal("memberAccess");
      if (!valuesInit || valuesInit.kind !== "memberAccess") return;
      expect(valuesInit.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "unknownType" },
      });
    });

    it("allows arbitrary property access on Record<string, unknown> without unknown poison", () => {
      const source = `
        export function fill(): Record<string, unknown> {
          const state: Record<string, unknown> = {};
          state.zulip_version = "1.0";
          state.realm_users = [];
          return state;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
    });

    it("allows declared unknown members on structural callback parameters", () => {
      const source = `
        export function project(
          rawUpdates: { stream_id: string; property: string; value: unknown }[]
        ): string[] {
          return rawUpdates.map((update) => String(update.value ?? ""));
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
    });

    it("supports indexed access on generic discriminated-union payloads after narrowing", () => {
      const source = `
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        declare function listTenants(): Result<{ Id: string }[], string>;

        export function run(): string {
          const result = listTenants();
          if (!result.success) {
            return result.error;
          }

          const data = result.data;
          return data[0]!.Id;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const dataDecl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "data"
          )
      );
      expect(dataDecl).to.not.equal(undefined);
      const dataInit = dataDecl?.declarations[0]?.initializer;
      expect(dataInit?.kind).to.equal("memberAccess");
      if (!dataInit || dataInit.kind !== "memberAccess") return;
      expect(dataInit.inferredType?.kind).to.equal("arrayType");
      if (
        !dataInit.inferredType ||
        dataInit.inferredType.kind !== "arrayType"
      ) {
        return;
      }
      expect(dataInit.inferredType.elementType.kind).to.equal("objectType");
      if (dataInit.inferredType.elementType.kind !== "objectType") return;
      expect(dataInit.inferredType.elementType.members).to.have.length(1);
      const idMember = dataInit.inferredType.elementType.members[0];
      expect(idMember?.kind).to.equal("propertySignature");
      if (!idMember || idMember.kind !== "propertySignature") return;
      expect(idMember.name).to.equal("Id");
      expect(idMember.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(idMember.isOptional).to.equal(false);
      expect(idMember.isReadonly).to.equal(false);
    });

    it("treats string-literal element access on narrowed unions like property access", () => {
      const source = `
        type Err = { error: string; code?: string };
        type Ok = { events: string[] };

        declare function getEvents(): Err | Ok;

        export function run(): string {
          const result = getEvents();
          if ("error" in result) {
            return result["code"] ?? result["error"];
          }
          return result["events"][0] ?? "";
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const ifStmt = run.body.statements.find(
        (stmt) => stmt.kind === "ifStatement"
      );
      expect(ifStmt).to.not.equal(undefined);
      if (!ifStmt || ifStmt.kind !== "ifStatement") return;

      const thenReturn =
        ifStmt.thenStatement.kind === "blockStatement"
          ? ifStmt.thenStatement.statements.find(
              (stmt) => stmt.kind === "returnStatement"
            )
          : undefined;
      expect(thenReturn).to.not.equal(undefined);
      if (
        !thenReturn ||
        thenReturn.kind !== "returnStatement" ||
        !thenReturn.expression ||
        thenReturn.expression.kind !== "logical"
      ) {
        return;
      }

      const codeAccess = thenReturn.expression.left;
      expect(codeAccess.kind).to.equal("memberAccess");
      if (codeAccess.kind !== "memberAccess") return;
      expect(codeAccess.accessKind).to.not.equal("unknown");
      expect(codeAccess.inferredType).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });

      const finalReturn = [...run.body.statements]
        .reverse()
        .find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
      expect(finalReturn).to.not.equal(undefined);
      if (
        !finalReturn ||
        !finalReturn.expression ||
        finalReturn.expression.kind !== "logical" ||
        finalReturn.expression.left.kind !== "memberAccess"
      ) {
        return;
      }

      const eventsIndex = finalReturn.expression.left;
      expect(eventsIndex.accessKind).to.equal("clrIndexer");
      expect(eventsIndex.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string-literal element access computed for alias-wrapped string dictionaries", () => {
      const source = `
        interface SettingsMap {
          [key: string]: string;
        }

        declare function load(): SettingsMap;

        export function run(): string | undefined {
          const settings = load();
          return settings["waiting_period_threshold"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const returnStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (!returnStmt?.expression) return;

      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.isComputed).to.equal(true);
      expect(returnStmt.expression.accessKind).to.equal("dictionary");
    });

    it("keeps string-literal element access computed after generic return narrowing", () => {
      const source = `
        type SettingsMap = { [key: string]: string };

        declare const JsonSerializer: {
          Deserialize<T>(json: string): T | undefined;
        };

        export function run(json: string): string | undefined {
          const settingsOrNull = JsonSerializer.Deserialize<SettingsMap>(json);
          if (settingsOrNull === undefined) {
            return undefined;
          }
          const settings = settingsOrNull;
          return settings["waiting_period_threshold"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const returnStmt = [...run.body.statements]
        .reverse()
        .find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
      expect(returnStmt).to.not.equal(undefined);
      if (!returnStmt?.expression) return;

      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.isComputed).to.equal(true);
      expect(returnStmt.expression.accessKind).to.equal("dictionary");
    });

    it("types inferred array Length access as int without unknown poison", () => {
      const source = `
        export function count(items: string[]): int {
          const copy = items;
          return copy.Length;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "count"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements.find(
        (s) => s.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("types tuple Length access as int without unknown poison", () => {
      const source = `
        export function tupleCount(pair: [string, int]): int {
          return pair.Length;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "tupleCount"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements.find(
        (s) => s.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });

  describe("For-Await Loop Conversion", () => {
    it("should set isAwait=true for 'for await' loop", () => {
      const source = `
        async function process(items: AsyncIterable<string>): Promise<void> {
          for await (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forAwaitStmt = func.body.statements[0];
        if (forAwaitStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forAwaitStmt.isAwait).to.equal(true);
      }
    });

    it("should set isAwait=false for regular 'for of' loop", () => {
      const source = `
        function process(items: string[]): void {
          for (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forOfStmt = func.body.statements[0];
        if (forOfStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forOfStmt.isAwait).to.equal(false);
      }
    });

    it("should keep isAwait=false for regular 'for of' inside async functions", () => {
      const source = `
        async function process(items: string[]): Promise<void> {
          for (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forOfStmt = func.body.statements[0];
        if (forOfStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forOfStmt.isAwait).to.equal(false);
      }
    });

    it("threads Map entry tuple element types into for-of bodies", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-for-of-map-entries-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function process(menuBuilders: Map<string, string[]>): void {",
            "  for (const [menuName, builders] of menuBuilders) {",
            "    const first = builders[0];",
            "    console.log(menuName, first);",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "process"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const loop = fn.body.statements[0];
        expect(loop?.kind).to.equal("forOfStatement");
        if (!loop || loop.kind !== "forOfStatement") return;

        expect(loop.variable.kind).to.equal("arrayPattern");
        if (loop.variable.kind !== "arrayPattern") return;

        const tupleElements = loop.variable.elements;
        expect(tupleElements[0]?.pattern).to.deep.equal({
          kind: "identifierPattern",
          name: "menuName",
        });
        expect(tupleElements[1]?.pattern).to.deep.equal({
          kind: "identifierPattern",
          name: "builders",
        });

        const loopBody = loop.body;
        expect(loopBody.kind).to.equal("blockStatement");
        if (loopBody.kind !== "blockStatement") return;

        const firstDecl = loopBody.statements[0];
        expect(firstDecl?.kind).to.equal("variableDeclaration");
        if (!firstDecl || firstDecl.kind !== "variableDeclaration") return;

        const initializer = firstDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("memberAccess");
        if (!initializer || initializer.kind !== "memberAccess") return;

        const narrowedObject = unwrapTransparentExpression(initializer.object);
        expect(narrowedObject?.kind).to.equal("identifier");
        if (!narrowedObject || narrowedObject.kind !== "identifier") return;

        expect(narrowedObject.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
        expect(initializer.accessKind).to.equal("clrIndexer");
        expect(initializer.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads Iterable<T> element types from values() into for-of bodies", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-for-of-iterable-values-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function process(menus: Map<string, string[]>): void {",
            "  for (const entries of menus.values()) {",
            "    const first = entries[0];",
            "    console.log(first);",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "process"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const loop = fn.body.statements[0];
        expect(loop?.kind).to.equal("forOfStatement");
        if (!loop || loop.kind !== "forOfStatement") return;

        expect(loop.variable).to.deep.equal({
          kind: "identifierPattern",
          name: "entries",
        });

        const loopBody = loop.body;
        expect(loopBody.kind).to.equal("blockStatement");
        if (loopBody.kind !== "blockStatement") return;

        const firstDecl = loopBody.statements[0];
        expect(firstDecl?.kind).to.equal("variableDeclaration");
        if (!firstDecl || firstDecl.kind !== "variableDeclaration") return;

        const initializer = firstDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("memberAccess");
        if (!initializer || initializer.kind !== "memberAccess") return;

        const narrowedObject = unwrapTransparentExpression(initializer.object);
        expect(narrowedObject?.kind).to.equal("identifier");
        if (!narrowedObject || narrowedObject.kind !== "identifier") return;

        expect(narrowedObject.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
        expect(initializer.accessKind).to.equal("clrIndexer");
        expect(initializer.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads generic surface root global bindings into identifier callees", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-generic-surface-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(surfaceRoot, "index.d.ts"),
          [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "declare global {",
            "  const console: {",
            "    log(...data: unknown[]): void;",
            "  };",
            "  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;",
            "  function clearInterval(id: int): void;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "bindings.json"),
          JSON.stringify(
            {
              bindings: {
                console: {
                  kind: "global",
                  assembly: "Tsonic.JSRuntime",
                  type: "Tsonic.JSRuntime.console",
                },
                setInterval: {
                  kind: "global",
                  assembly: "Tsonic.JSRuntime",
                  type: "Tsonic.JSRuntime.Timers",
                  csharpName: "Timers.setInterval",
                },
                clearInterval: {
                  kind: "global",
                  assembly: "Tsonic.JSRuntime",
                  type: "Tsonic.JSRuntime.Timers",
                  csharpName: "Timers.clearInterval",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  const id = setInterval(() => {}, 1000);",
            "  clearInterval(id);",
            '  console.log("tick");',
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const setIntervalCall = firstStmt.declarations[0]?.initializer;
        expect(setIntervalCall?.kind).to.equal("call");
        if (!setIntervalCall || setIntervalCall.kind !== "call") return;

        expect(setIntervalCall.callee.kind).to.equal("identifier");
        if (setIntervalCall.callee.kind !== "identifier") return;

        expect(setIntervalCall.callee.name).to.equal("setInterval");
        expect(setIntervalCall.callee.resolvedClrType).to.equal(
          "Tsonic.JSRuntime.Timers"
        );
        expect(setIntervalCall.callee.resolvedAssembly).to.equal(
          "Tsonic.JSRuntime"
        );
        expect(setIntervalCall.callee.csharpName).to.equal(
          "Timers.setInterval"
        );

        const clearIntervalStmt = fn.body.statements[1];
        expect(clearIntervalStmt?.kind).to.equal("expressionStatement");
        if (
          !clearIntervalStmt ||
          clearIntervalStmt.kind !== "expressionStatement"
        )
          return;

        const clearIntervalCall = clearIntervalStmt.expression;
        expect(clearIntervalCall.kind).to.equal("call");
        if (clearIntervalCall.kind !== "call") return;
        expect(clearIntervalCall.callee.kind).to.equal("identifier");
        if (clearIntervalCall.callee.kind !== "identifier") return;
        expect(clearIntervalCall.callee.csharpName).to.equal(
          "Timers.clearInterval"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("converts regex literals into RegExp constructor expressions on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-regex-literal-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function isUpper(text: string): boolean {",
            "  return /^[A-Z]+$/i.test(text);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "isUpper"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const testCall = returnStmt.expression;
        expect(testCall?.kind).to.equal("call");
        if (!testCall || testCall.kind !== "call") return;

        expect(testCall.callee.kind).to.equal("memberAccess");
        if (testCall.callee.kind !== "memberAccess") return;

        const regexCtor = testCall.callee.object;
        expect(regexCtor.kind).to.equal("new");
        if (regexCtor.kind !== "new") return;

        expect(regexCtor.callee.kind).to.equal("identifier");
        if (regexCtor.callee.kind !== "identifier") return;

        expect(regexCtor.callee.name).to.equal("RegExp");
        expect(regexCtor.callee.resolvedClrType).to.equal(
          "Tsonic.JSRuntime.RegExp"
        );
        expect(regexCtor.arguments).to.deep.equal([
          {
            kind: "literal",
            value: "^[A-Z]+$",
            raw: JSON.stringify("^[A-Z]+$"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[0]?.sourceSpan,
          },
          {
            kind: "literal",
            value: "i",
            raw: JSON.stringify("i"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[1]?.sourceSpan,
          },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves spread-only array element types on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-spread-array-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type MenuEntry = { weight: number };",
            "export const sortMenuEntries = (entries: MenuEntry[]): MenuEntry[] => {",
            "  return [...entries].sort((a: MenuEntry, b: MenuEntry) => a.weight - b.weight);",
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const sortDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "sortMenuEntries"
        );
        expect(sortDecl).to.not.equal(undefined);
        if (!sortDecl) return;

        const initializer = sortDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        if (!initializer || initializer.kind !== "arrowFunction") return;
        expect(initializer.body.kind).to.equal("blockStatement");
        if (initializer.body.kind !== "blockStatement") return;

        const returnStmt = initializer.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const sortCall = returnStmt.expression;
        expect(sortCall?.kind).to.equal("call");
        if (!sortCall || sortCall.kind !== "call") return;
        expect(sortCall.callee.kind).to.equal("memberAccess");
        if (sortCall.callee.kind !== "memberAccess") return;
        expect(sortCall.callee.object.kind).to.equal("array");
        if (sortCall.callee.object.kind !== "array") return;

        const inferredType = sortCall.callee.object.inferredType;
        expect(inferredType?.kind).to.equal("arrayType");
        if (!inferredType || inferredType.kind !== "arrayType") return;
        expect(inferredType.elementType.kind).to.equal("referenceType");
        if (inferredType.elementType.kind !== "referenceType") return;
        expect(inferredType.elementType.name).to.equal("MenuEntry");
        const weightMember = inferredType.elementType.structuralMembers?.find(
          (member: { kind: string; name: string }) =>
            member.kind === "propertySignature" && member.name === "weight"
        );
        expect(weightMember).to.not.equal(undefined);
        expect(weightMember?.kind).to.equal("propertySignature");
        if (!weightMember || weightMember.kind !== "propertySignature") return;
        expect(weightMember.type).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Native library port regressions", () => {
    it("narrows Array.isArray branches for scalar-or-array unions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function first(value: string | string[]): string {",
            "  if (Array.isArray(value)) {",
            '    return value[0] ?? "";',
            "  }",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "first"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const ifStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt).to.not.equal(undefined);
        if (!ifStmt) return;

        const thenReturn =
          ifStmt.thenStatement.kind === "blockStatement"
            ? ifStmt.thenStatement.statements[0]
            : undefined;
        expect(thenReturn?.kind).to.equal("returnStatement");
        if (
          !thenReturn ||
          thenReturn.kind !== "returnStatement" ||
          !thenReturn.expression
        ) {
          return;
        }
        expect(thenReturn.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (thenReturn.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(thenReturn.expression.inferredType.name).to.equal("string");

        const elseReturn = fn.body.statements.find(
          (stmt, index) =>
            index > fn.body.statements.indexOf(ifStmt) &&
            stmt.kind === "returnStatement"
        );
        expect(elseReturn?.kind).to.equal("returnStatement");
        if (
          !elseReturn ||
          elseReturn.kind !== "returnStatement" ||
          !elseReturn.expression
        ) {
          return;
        }
        expect(elseReturn.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (elseReturn.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(elseReturn.expression.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves Array.isArray fallthrough narrowing after early-return array branches in class methods", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Response {",
            "  append(field: string, value: string | string[]): this {",
            "    if (Array.isArray(value)) {",
            "      for (let index = 0; index < value.length; index += 1) {",
            "        const item = value[index]!;",
            "        this.append(field, item);",
            "      }",
            "      return this;",
            "    }",
            "    takesString(value);",
            "    return this;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const responseClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Response"
        );
        expect(responseClass).to.not.equal(undefined);
        if (!responseClass) return;

        const appendMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "append"
        );
        expect(appendMethod).to.not.equal(undefined);
        if (!appendMethod?.body) return;

        const callStmt = appendMethod.body.statements.find(
          (stmt, index) => index > 0 && stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType?.kind).to.equal("primitiveType");
        if (narrowedArg?.inferredType?.kind !== "primitiveType") return;
        expect(narrowedArg.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("narrows unknown values to unknown[] after Array.isArray fallthrough guards", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function isItems(value: unknown): boolean {",
            "  if (!Array.isArray(value)) {",
            "    return false;",
            "  }",
            "  const items = value;",
            "  return items.length > 0 && items[0] !== undefined;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const isItemsFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "isItems"
        );
        expect(isItemsFn).to.not.equal(undefined);
        if (!isItemsFn) return;

        const itemsDecl = isItemsFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "items"
            )
        );
        expect(itemsDecl).to.not.equal(undefined);
        if (!itemsDecl) return;

        const itemsInit = itemsDecl.declarations[0]?.initializer;
        expect(itemsInit?.kind).to.equal("typeAssertion");
        if (!itemsInit || itemsInit.kind !== "typeAssertion") return;

        expect(itemsInit.expression.inferredType?.kind).to.equal("unknownType");

        const itemsType = itemsInit.targetType;
        expect(itemsType?.kind).to.equal("arrayType");
        if (!itemsType || itemsType.kind !== "arrayType") return;
        expect(itemsType.elementType.kind).to.equal("unknownType");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves typeof fallthrough narrowing for class properties after early-return string branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Application {",
            '  mountpath: string | string[] = "/";',
            "  path(): string {",
            '    if (typeof this.mountpath === "string") {',
            "      return this.mountpath;",
            "    }",
            "    takesString(this.mountpath[0]!);",
            "    return this.mountpath[0]!;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const pathMethod = appClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "path"
        );
        expect(pathMethod).to.not.equal(undefined);
        if (!pathMethod?.body) return;
        const pathBody = pathMethod.body;

        const callStmt = pathBody.statements.find(
          (stmt) => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves compound typeof fallthrough narrowing after early-return disjunction branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "function combine(left: string | RegExp, right: string | RegExp): string | RegExp {",
            '  if (typeof left !== "string" || typeof right !== "string") {',
            "    return right;",
            "  }",
            "  takesString(left);",
            "  takesString(right);",
            "  return left + right;",
            "}",
            "",
            "export const main = (): string | RegExp => combine('a', 'b');",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const combineFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "combine"
        );
        expect(combineFn).to.not.equal(undefined);
        if (!combineFn) return;

        const callStatements = combineFn.body.statements.filter(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement"
        );
        expect(callStatements).to.have.length(2);

        for (const stmt of callStatements) {
          expect(stmt.expression.kind).to.equal("call");
          if (stmt.expression.kind !== "call") continue;
          const narrowedArg = stmt.expression.arguments[0];
          expect(narrowedArg?.inferredType).to.deep.equal({
            kind: "primitiveType",
            name: "string",
          });
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves Array.isArray fallthrough narrowing for class properties after early-return array branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Response {",
            '  value: string | readonly string[] = "";',
            "  render(): string {",
            "    if (Array.isArray(this.value)) {",
            '      return this.value.join("|");',
            "    }",
            "    takesString(this.value);",
            "    return this.value;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const responseClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Response"
        );
        expect(responseClass).to.not.equal(undefined);
        if (!responseClass) return;

        const renderMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "render"
        );
        expect(renderMethod).to.not.equal(undefined);
        if (!renderMethod?.body) return;
        const renderBody = renderMethod.body;

        const callStmt = renderBody.statements.find(
          (stmt) => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves ECMAScript private class members and private access paths", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Counter {",
            '  readonly #label: string = "ctr";',
            "  #count: number = 0;",
            "",
            "  get #prefix(): string {",
            "    return this.#label;",
            "  }",
            "",
            "  #increment(): string {",
            "    this.#count += 1;",
            "    return String(this.#count);",
            "  }",
            "",
            "  append(value: string): string;",
            "  append(value: string[]): string;",
            "  append(value: string | string[]): string {",
            "    if (Array.isArray(value)) {",
            "      for (let index = 0; index < value.length; index += 1) {",
            "        const item = value[index]!;",
            "        this.append(item);",
            "      }",
            "      return this.#prefix;",
            "    }",
            "    return `${this.#prefix}:${value}:${this.#increment()}`;",
            "  }",
            "",
            "  read(): string {",
            '    return this.append("value");',
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const counterClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Counter"
        );
        expect(counterClass).to.not.equal(undefined);
        if (!counterClass) return;

        const memberNames = counterClass.members
          .filter(
            (member): member is Extract<typeof member, { name: string }> =>
              "name" in member
          )
          .map((member) => member.name);
        expect(memberNames).to.include.members([
          "#label",
          "#count",
          "#prefix",
          "#increment",
          "append",
          "read",
        ]);

        const labelField = counterClass.members.find(
          (member) =>
            member.kind === "propertyDeclaration" && member.name === "#label"
        );
        expect(labelField?.kind).to.equal("propertyDeclaration");
        if (labelField?.kind !== "propertyDeclaration") return;
        expect(labelField.emitAsField).to.equal(true);
        expect(labelField.accessibility).to.equal("private");

        const incrementMethod = counterClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "#increment"
        );
        expect(incrementMethod).to.not.equal(undefined);
        expect(incrementMethod?.accessibility).to.equal("private");

        const readMethod = counterClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(readMethod).to.not.equal(undefined);
        if (!readMethod?.body) return;

        const readReturn = readMethod.body.statements.at(-1);
        expect(readReturn?.kind).to.equal("returnStatement");
        if (
          !readReturn ||
          readReturn.kind !== "returnStatement" ||
          !readReturn.expression
        ) {
          return;
        }

        expect(readReturn.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves deterministic well-known symbol class members and accesses", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Params {",
            "  get [Symbol.toStringTag](): string {",
            '    return "Params";',
            "  }",
            "}",
            "",
            "export function readTag(params: Params): string {",
            "  return params[Symbol.toStringTag];",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const paramsClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Params"
        );
        expect(paramsClass).to.not.equal(undefined);
        if (!paramsClass) return;

        const symbolMember = paramsClass.members.find(
          (member): member is IrPropertyDeclaration =>
            member.kind === "propertyDeclaration" &&
            member.name === "[symbol:toStringTag]"
        );
        expect(symbolMember).to.not.equal(undefined);

        const readTag = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "readTag"
        );
        expect(readTag).to.not.equal(undefined);
        if (!readTag?.body) return;

        const returnStmt = readTag.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "memberAccess"
        ) {
          return;
        }

        expect(returnStmt.expression.isComputed).to.equal(false);
        expect(returnStmt.expression.property).to.equal("[symbol:toStringTag]");
        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof fallthrough narrowing for class properties after early-return constructor branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Response {",
            '  body: string | Uint8Array = "";',
            "  send(): string {",
            "    if (this.body instanceof Uint8Array) {",
            "      return String(this.body.length);",
            "    }",
            "    takesString(this.body);",
            "    return this.body;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const responseClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Response"
        );
        expect(responseClass).to.not.equal(undefined);
        if (!responseClass) return;

        const sendMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "send"
        );
        expect(sendMethod).to.not.equal(undefined);
        if (!sendMethod?.body) return;

        const callStmt = sendMethod.body.statements.find(
          (stmt) => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("lowers direct .ts overload implementations with shorter overload signatures via wrapper methods", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type PathSpec = string | RegExp;",
            "type RouteHandler = () => void;",
            "",
            "class Router {",
            "  get(path: PathSpec, ...handlers: RouteHandler[]): Router {",
            "    void path;",
            "    void handlers;",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  get(name: string): unknown;",
            "  get(path: PathSpec, ...handlers: RouteHandler[]): Application;",
            "  override get(nameOrPath: string | PathSpec, ...handlers: RouteHandler[]): unknown {",
            '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
            "      return undefined;",
            "    }",
            "    return super.get(nameOrPath as PathSpec, ...handlers) as Application;",
            "  }",
            "}",
            "",
            "export function useApp(app: Application): Application {",
            '  app.get("setting");',
            '  return app.get("/items", () => {});',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const getMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "get"
        );
        expect(getMethods.length).to.equal(2);

        const settingsGetter = getMethods.find(
          (member) =>
            member.parameters.length === 1 &&
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );
        expect(settingsGetter).to.not.equal(undefined);
        expect(settingsGetter?.isOverride).to.equal(undefined);

        const routeGetter = getMethods.find(
          (member) =>
            member.parameters.length === 2 && member.parameters[1]?.isRest
        );
        expect(routeGetter).to.not.equal(undefined);
        expect(routeGetter?.isOverride).to.equal(true);

        const implMethod = appClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_get"
        );
        expect(implMethod).to.not.equal(undefined);
        if (!implMethod || implMethod.kind !== "methodDeclaration") return;
        expect(implMethod.accessibility).to.equal("private");
      } finally {
        fixture.cleanup();
      }
    });

    it("marks only signature-compatible overload wrappers as overrides against TS base classes", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type ParamHandler = (value: string) => void;",
            "",
            "class Router {",
            "  get(path: string, ...handlers: (() => void)[]): this {",
            "    void path;",
            "    void handlers;",
            "    return this;",
            "  }",
            "  param(name: string, callback: ParamHandler): this {",
            "    void name;",
            "    void callback;",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  get(name: string): unknown;",
            "  override get(path: string, ...handlers: (() => void)[]): this;",
            "  override get(nameOrPath: string, ...handlers: (() => void)[]): unknown {",
            "    if (handlers.length === 0) return undefined;",
            "    return super.get(nameOrPath, ...handlers);",
            "  }",
            "",
            "  override param(name: string, callback: ParamHandler): this;",
            "  param(name: string[], callback: ParamHandler): this;",
            "  override param(name: string | string[], callback: ParamHandler): this {",
            "    if (Array.isArray(name)) {",
            "      return this;",
            "    }",
            "    return super.param(name, callback);",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const getMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "get"
        );
        expect(getMethods.length).to.equal(2);
        expect(
          getMethods.filter((member) => member.isOverride === true).length
        ).to.equal(1);

        const paramMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "param"
        );
        expect(paramMethods.length).to.equal(2);
        expect(
          paramMethods.filter((member) => member.isOverride === true).length
        ).to.equal(1);

        const arrayParamOverload = paramMethods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "arrayType" &&
            member.parameters[0].type.elementType.kind === "primitiveType" &&
            member.parameters[0].type.elementType.name === "string"
        );
        expect(arrayParamOverload).to.not.equal(undefined);
        expect(arrayParamOverload?.isOverride).to.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves defaulted trailing parameters in direct .ts overload implementations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Parser {",
            "  parse(text: string): string;",
            "  parse(text: string, radix: number): string;",
            "  parse(text: string, radix = 10): string {",
            "    return `${text}:${radix}`;",
            "  }",
            "}",
            "",
            "export function run(parser: Parser): string {",
            '  return parser.parse("42");',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const parserClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Parser"
        );
        expect(parserClass).to.not.equal(undefined);
        if (!parserClass) return;

        const implMethod = parserClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_parse"
        );
        expect(implMethod).to.not.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("specializes Array.isArray overload bodies against the concrete overload parameter type", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class A {",
            "  append(field: string, value: string): A;",
            "  append(field: string, value: readonly string[]): A;",
            "  append(field: string, value: string | readonly string[]): A {",
            "    if (Array.isArray(value)) {",
            "      const values = value as readonly string[];",
            "      for (let index = 0; index < values.length; index += 1) {",
            "        const item = values[index]!;",
            "        this.append(field, item);",
            "      }",
            "      return this;",
            "    }",
            "    return this;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "A"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const appendMethods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "append"
        );
        expect(appendMethods.length).to.equal(2);

        const stringOverload = appendMethods.find((member) => {
          const valueParam = member.parameters[1];
          return (
            valueParam?.type?.kind === "primitiveType" &&
            valueParam.type.name === "string"
          );
        });
        expect(stringOverload).to.not.equal(undefined);
        if (!stringOverload || !stringOverload.body) return;
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "returnStatement"
          )
        ).to.equal(true);
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);

        const arrayOverload = appendMethods.find(
          (member) => member.parameters[1]?.type?.kind === "arrayType"
        );
        expect(arrayOverload).to.not.equal(undefined);
        if (!arrayOverload || !arrayOverload.body) return;
        expect(
          arrayOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers single-element JSArray push overloads for tuple element arrays", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Params {",
            "  entries(): [string, string][] {",
            "    const result: [string, string][] = [];",
            '    const key = "name";',
            '    const value = "value";',
            "    result.push([key, value]);",
            "    return result;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Params"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const entriesMethod = targetClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "entries"
        );
        expect(entriesMethod).to.not.equal(undefined);
        if (!entriesMethod?.body) return;

        const pushCall = entriesMethod.body.statements
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .find(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" &&
              expr.callee.kind === "memberAccess" &&
              expr.callee.property === "push"
          );

        expect(pushCall).to.not.equal(undefined);
        if (!pushCall) return;

        const firstParameterType = pushCall.parameterTypes?.[0];
        expect(firstParameterType?.kind).to.equal("tupleType");
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers single-element JSArray push overloads for object-literal element arrays", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RouteLayer = {",
            "  path: string;",
            "  method: string | undefined;",
            "  middleware: boolean;",
            "  handlers: string[];",
            "};",
            "",
            "export class Router {",
            "  layers: RouteLayer[] = [];",
            "  add(path: string, method: string | undefined, handlers: string[]): void {",
            "    this.layers.push({ path, method, middleware: false, handlers });",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Router"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const addMethod = targetClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "add"
        );
        expect(addMethod).to.not.equal(undefined);
        if (!addMethod?.body) return;

        const pushCall = addMethod.body.statements
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .find(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" &&
              expr.callee.kind === "memberAccess" &&
              expr.callee.property === "push"
          );

        expect(pushCall).to.not.equal(undefined);
        if (!pushCall) return;

        const firstParameterType = pushCall.parameterTypes?.[0];
        expect(firstParameterType?.kind).to.equal("referenceType");
        if (firstParameterType?.kind !== "referenceType") return;
        expect(firstParameterType.name).to.equal("RouteLayer");
        expect(
          firstParameterType.structuralMembers?.some(
            (member) => member.name === "path"
          )
        ).to.equal(true);
        expect(
          firstParameterType.structuralMembers?.some(
            (member) => member.name === "handlers"
          )
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("resolves `this` return types in fluent class methods without degrading to any", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Router {",
            "  use(_path: string): this {",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  mount(): this {",
            "    return this;",
            "  }",
            "}",
            "",
            "export function run(app: Application): Application {",
            '  return app.mount().use("/api");',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "referenceType"
        );
        if (returnStmt.expression.inferredType?.kind !== "referenceType") {
          return;
        }
        expect(returnStmt.expression.inferredType.name).to.equal("Application");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves nullable parameter surfaces when calls pass undefined or null", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import { int } from "@tsonic/core/types.js";',
            "",
            "function getDefault(value: string | null | undefined): string {",
            '  return value ?? "default";',
            "}",
            "",
            "function getFlag(value: boolean | undefined): boolean {",
            "  return value ?? false;",
            "}",
            "",
            "function getId(value: int | undefined): int {",
            "  return value ?? (0 as int);",
            "}",
            "",
            "getDefault(undefined);",
            "getDefault(null);",
            "getFlag(undefined);",
            "getId(undefined);",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const calls = result.value.body
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .filter(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" && expr.callee.kind === "identifier"
          );

        const getDefaultUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" &&
            call.callee.name === "getDefault" &&
            call.arguments[0]?.kind === "identifier"
        );
        const getDefaultNull = calls.find(
          (call) =>
            call.callee.kind === "identifier" &&
            call.callee.name === "getDefault" &&
            call.arguments[0]?.kind === "literal" &&
            call.arguments[0].value === null
        );
        const getFlagUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" && call.callee.name === "getFlag"
        );
        const getIdUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" && call.callee.name === "getId"
        );

        expect(getDefaultUndefined?.parameterTypes?.[0]?.kind).to.equal(
          "unionType"
        );
        expect(getDefaultNull?.parameterTypes?.[0]?.kind).to.equal("unionType");
        expect(getFlagUndefined?.parameterTypes?.[0]?.kind).to.equal(
          "unionType"
        );
        expect(getIdUndefined?.parameterTypes?.[0]?.kind).to.equal("unionType");

        if (
          getDefaultUndefined?.parameterTypes?.[0]?.kind !== "unionType" ||
          getDefaultNull?.parameterTypes?.[0]?.kind !== "unionType" ||
          getFlagUndefined?.parameterTypes?.[0]?.kind !== "unionType" ||
          getIdUndefined?.parameterTypes?.[0]?.kind !== "unionType"
        ) {
          return;
        }

        expect(
          getDefaultUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["string", "null", "undefined"]);
        expect(
          getDefaultNull.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["string", "null", "undefined"]);
        expect(
          getFlagUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["boolean", "undefined"]);
        expect(
          getIdUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["int", "undefined"]);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves optional exact-numeric parameter surfaces for function-valued calls", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import { int } from "@tsonic/core/types.js";',
            "",
            "type Query = {",
            "  limit?: int;",
            "};",
            "",
            "const topLevel = (value?: int): void => {};",
            "const typedTopLevel: (value?: int) => void = (value?: int): void => {};",
            "",
            "export function run(query: Query): void {",
            "  const local = (value?: int): void => {};",
            "  const typedLocal: (value?: int) => void = (value?: int): void => {};",
            "  topLevel(query.limit);",
            "  typedTopLevel(query.limit);",
            "  local(query.limit);",
            "  typedLocal(query.limit);",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const calls = runFn.body.statements.flatMap((stmt) => {
          if (
            stmt.kind !== "expressionStatement" ||
            stmt.expression.kind !== "call" ||
            stmt.expression.callee.kind !== "identifier"
          ) {
            return [];
          }
          return [stmt.expression];
        });

        expect(calls).to.have.length(4);

        for (const call of calls) {
          expect(call.parameterTypes?.[0]?.kind).to.equal("unionType");
          if (call.parameterTypes?.[0]?.kind !== "unionType") continue;
          expect(
            call.parameterTypes[0].types.map((type) =>
              type.kind === "primitiveType" ? type.name : type.kind
            )
          ).to.have.members(["int", "undefined"]);
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("recovers namespace-import member types from source-package const arrow exports", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-namespace-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const packageRoot = path.join(
          tempDir,
          "node_modules",
          "@tsonic",
          "nodejs"
        );
        fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
        fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
        fs.writeFileSync(
          path.join(packageRoot, "package.json"),
          JSON.stringify(
            {
              name: "@tsonic/nodejs",
              version: "10.0.99-test",
              type: "module",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
                "./path.js": "./src/path-module.ts",
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "tsonic", "package-manifest.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                exports: {
                  ".": "./src/index.ts",
                  "./path.js": "./src/path-module.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "src", "index.ts"),
          'export * as path from "./path-module.ts";\n'
        );
        fs.writeFileSync(
          path.join(packageRoot, "src", "path-module.ts"),
          [
            "export type ParsedPath = {",
            "  readonly base: string;",
            "};",
            "export const basename = (value: string): string => value;",
            "export const parse = (value: string): ParsedPath => ({ base: value });",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import * as nodePath from "@tsonic/nodejs/path.js";',
            "export function run(): string {",
            '  const parsed = nodePath.parse("file.txt");',
            "  return nodePath.basename(parsed.base);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [packageRoot],
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const runFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const parsedDecl = runFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "parsed"
            )
        );
        expect(parsedDecl).to.not.equal(undefined);
        if (!parsedDecl) return;

        const parseCall = parsedDecl.declarations[0]?.initializer;
        expect(parseCall?.kind).to.equal("call");
        if (!parseCall || parseCall.kind !== "call") return;
        expect(parseCall.callee.kind).to.equal("memberAccess");
        if (parseCall.callee.kind !== "memberAccess") return;
        expect(parseCall.callee.inferredType?.kind).to.equal("functionType");
        if (parseCall.callee.inferredType?.kind !== "functionType") return;
        expect(parseCall.callee.inferredType.returnType.kind).to.not.equal(
          "unknownType"
        );

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "call"
        ) {
          return;
        }
        expect(returnStmt.expression.callee.kind).to.equal("memberAccess");
        if (returnStmt.expression.callee.kind !== "memberAccess") return;
        expect(returnStmt.expression.callee.inferredType?.kind).to.equal(
          "functionType"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves Array.isArray fallthrough narrowing after early-return array branches in function declarations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export function appendHeader(value: string | string[]): string {",
            "  if (Array.isArray(value)) {",
            '    return value.join("|");',
            "  }",
            "  takesString(value);",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "appendHeader"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "expressionStatement" }
          > => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const callArg = callStmt.expression.arguments[0];
        expect(callArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const returnStmt = fn.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const ifStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt?.kind).to.equal("ifStatement");
        if (!ifStmt || ifStmt.condition.kind !== "call") {
          return;
        }

        expect(ifStmt.condition.narrowing?.kind).to.equal("typePredicate");
        expect(ifStmt.condition.narrowing?.argIndex).to.equal(0);
        expect(ifStmt.condition.narrowing?.targetType.kind).to.equal(
          "arrayType"
        );
        if (
          !ifStmt.condition.narrowing ||
          ifStmt.condition.narrowing.targetType.kind !== "arrayType"
        ) {
          return;
        }
        expect(ifStmt.condition.narrowing.targetType.elementType).to.deep.equal(
          { kind: "primitiveType", name: "string" }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof fallthrough narrowing after early-return constructor branches in function declarations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export function appendBody(value: string | Uint8Array): string {",
            "  if (value instanceof Uint8Array) {",
            "    return String(value.length);",
            "  }",
            "  takesString(value);",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "appendBody"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "expressionStatement" }
          > => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const callArg = callStmt.expression.arguments[0];
        expect(callArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const returnStmt = fn.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("treats optional exact-numeric parameters as nullable at read sites", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "let currentExitCode: int | undefined = undefined;",
            "",
            "export function exit(code?: int): int {",
            "  const resolved = code ?? currentExitCode ?? (0 as int);",
            "  return resolved;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "exit"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const varDecl = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "variableDeclaration" }
          > => stmt.kind === "variableDeclaration"
        );
        expect(varDecl).to.not.equal(undefined);
        const resolvedInit = varDecl?.declarations[0]?.initializer;
        expect(resolvedInit?.kind).to.equal("logical");
        if (!resolvedInit || resolvedInit.kind !== "logical") {
          return;
        }

        expect(resolvedInit.left.kind).to.equal("logical");
        if (resolvedInit.left.kind !== "logical") {
          return;
        }

        expect(resolvedInit.left.left.inferredType).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "int" },
            { kind: "primitiveType", name: "undefined" },
          ],
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("contextually types lambdas from callable interface aliases in native library ports", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'type NextControl = "route" | "router" | string | null | undefined;',
            "type NextFunction = (value?: NextControl) => void | Promise<void>;",
            "interface Request { path: string; }",
            "interface Response { send(text: string): void; }",
            "interface RequestHandler {",
            "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
            "}",
            "export const handler: RequestHandler = async (_req, _res, next) => {",
            '  await next("route");',
            "};",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const requestHandler = result.value.body.find(
          (stmt): stmt is IrTypeAliasDeclaration =>
            stmt.kind === "typeAliasDeclaration" &&
            stmt.name === "RequestHandler"
        );
        expect(requestHandler).to.not.equal(undefined);
        expect(requestHandler?.type.kind).to.equal("functionType");

        const handlerDecl = result.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration"
        );
        expect(handlerDecl).to.not.equal(undefined);
        const initializer = handlerDecl?.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        expect(initializer?.inferredType?.kind).to.equal("functionType");
      } finally {
        fixture.cleanup();
      }
    });

    it("contextually types recursive middleware array literals from callable source aliases", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'type NextControl = "route" | "router" | string | null | undefined;',
            "type NextFunction = (value?: NextControl) => void | Promise<void>;",
            "interface Request { path: string; }",
            "interface Response { send(text: string): void; }",
            "interface RequestHandler {",
            "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
            "}",
            "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
            "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
            "class Router {",
            "  use(...handlers: readonly MiddlewareLike[]): this {",
            "    return this;",
            "  }",
            "}",
            "class Application extends Router {",
            "  mount(path: string, ...handlers: readonly MiddlewareLike[]): this {",
            "    this.use(handlers);",
            "    return this;",
            "  }",
            "}",
            "export function main(): Application {",
            "  const app = new Application();",
            "  const handler: RequestHandler = async (_req, _res, next) => {",
            '    await next("route");',
            "  };",
            '  return app.mount("/", [handler]);',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const mainFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(mainFn).to.not.equal(undefined);
        if (!mainFn) return;

        const returnStmt = mainFn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "returnStatement" }
          > => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        const mountCall = returnStmt?.expression;
        expect(mountCall?.kind).to.equal("call");
        if (!mountCall || mountCall.kind !== "call") return;

        const secondArg = mountCall.arguments[1];
        expect(secondArg?.kind).to.equal("array");
        if (!secondArg || secondArg.kind !== "array") return;

        expect(secondArg.inferredType?.kind).to.equal("arrayType");
        if (
          !secondArg.inferredType ||
          secondArg.inferredType.kind !== "arrayType"
        ) {
          return;
        }

        expect(secondArg.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves recursive middleware element types after Array.isArray branch narrowing", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
            "class Router {}",
            "function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {",
            '  return typeof value === "function";',
            "}",
            "export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {",
            "  const result: (RequestHandler | Router)[] = [];",
            "  const append = (handler: MiddlewareLike): void => {",
            "    if (Array.isArray(handler)) {",
            "      for (let index = 0; index < handler.length; index += 1) {",
            "        append(handler[index]!);",
            "      }",
            "      return;",
            "    }",
            "    if (handler instanceof Router) {",
            "      result.push(handler);",
            "      return;",
            "    }",
            "    if (!isMiddlewareHandler(handler)) {",
            '      throw new Error("middleware handlers must be functions");',
            "    }",
            "    result.push(handler);",
            "  };",
            "  return result;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const flattenFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "flatten"
        );
        expect(flattenFn).to.not.equal(undefined);
        if (!flattenFn) return;

        const appendDecl = flattenFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "append"
            )
        );
        expect(appendDecl).to.not.equal(undefined);
        if (!appendDecl) return;

        const appendInit = appendDecl.declarations[0]?.initializer;
        expect(appendInit?.kind).to.equal("arrowFunction");
        if (!appendInit || appendInit.kind !== "arrowFunction") return;
        expect(appendInit.body.kind).to.equal("blockStatement");
        if (appendInit.body.kind !== "blockStatement") return;

        const arrayGuard = appendInit.body.statements[0];
        expect(arrayGuard?.kind).to.equal("ifStatement");
        if (!arrayGuard || arrayGuard.kind !== "ifStatement") return;
        expect(arrayGuard.thenStatement.kind).to.equal("blockStatement");
        if (arrayGuard.thenStatement.kind !== "blockStatement") return;

        const loopStmt = arrayGuard.thenStatement.statements[0];
        expect(loopStmt?.kind).to.equal("forStatement");
        if (!loopStmt || loopStmt.kind !== "forStatement") return;
        expect(loopStmt.body.kind).to.equal("blockStatement");
        if (loopStmt.body.kind !== "blockStatement") return;

        const appendCallStmt = loopStmt.body.statements[0];
        expect(appendCallStmt?.kind).to.equal("expressionStatement");
        if (
          !appendCallStmt ||
          appendCallStmt.kind !== "expressionStatement" ||
          appendCallStmt.expression.kind !== "call"
        ) {
          return;
        }

        const recursiveArg = appendCallStmt.expression.arguments[0];
        expect(recursiveArg?.inferredType?.kind).to.equal("referenceType");
        if (
          !recursiveArg?.inferredType ||
          recursiveArg.inferredType.kind !== "referenceType"
        ) {
          return;
        }

        expect(recursiveArg.inferredType.name).to.equal("MiddlewareLike");
      } finally {
        fixture.cleanup();
      }
    });

    it("applies predicate-based branch narrowing inside conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
            "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
            "class Router {}",
            "function isPathSpec(value: PathSpec | MiddlewareLike): value is PathSpec {",
            '  return value == null || typeof value === "string" || value instanceof RegExp || Array.isArray(value);',
            "}",
            "export function collect(first: PathSpec | MiddlewareLike, rest: readonly MiddlewareLike[]): readonly MiddlewareLike[] {",
            "  const values = isPathSpec(first) ? rest : [first, ...rest];",
            "  return values;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const collectFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "collect"
        );
        expect(collectFn).to.not.equal(undefined);
        if (!collectFn) return;

        const valuesDecl = collectFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "values"
            )
        );
        expect(valuesDecl).to.not.equal(undefined);
        if (!valuesDecl) return;

        const valuesInit = valuesDecl.declarations[0]?.initializer;
        expect(valuesInit?.kind).to.equal("conditional");
        if (!valuesInit || valuesInit.kind !== "conditional") return;

        expect(valuesInit.whenFalse.kind).to.equal("array");
        if (valuesInit.whenFalse.kind !== "array") return;

        const firstElement = valuesInit.whenFalse.elements[0];
        expect(firstElement?.kind).to.equal("typeAssertion");
        if (!firstElement || firstElement.kind !== "typeAssertion") return;

        expect(firstElement.expression.inferredType?.kind).to.equal(
          "unionType"
        );

        const narrowedType = firstElement.targetType;
        expect(narrowedType?.kind).to.equal("referenceType");
        if (!narrowedType) return;
        expect(stableIrTypeKey(narrowedType)).to.include("MiddlewareLike");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves direct recursive alias identity in source parameters and returns", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
            "export function combine(left: PathSpec, right: PathSpec): PathSpec {",
            "  return left ?? right;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const combineFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "combine"
        );
        expect(combineFn).to.not.equal(undefined);
        if (!combineFn) return;

        const assertAliasReference = (
          type: IrType | undefined,
          expectedName: string
        ): void => {
          expect(type?.kind).to.equal("referenceType");
          if (!type || type.kind !== "referenceType") return;
          expect(type.name).to.equal(expectedName);
          expect(type.typeId?.tsName).to.equal(expectedName);
        };

        assertAliasReference(combineFn.parameters[0]?.type, "PathSpec");
        assertAliasReference(combineFn.parameters[1]?.type, "PathSpec");
        assertAliasReference(combineFn.returnType, "PathSpec");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves mutually recursive alias identity in source parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "class Router {}",
            "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
            "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
            "export function mount(first: MiddlewareLike, rest: readonly MiddlewareLike[]): readonly MiddlewareLike[] {",
            "  return [first, ...rest];",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const mountFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "mount"
        );
        expect(mountFn).to.not.equal(undefined);
        if (!mountFn) return;

        expect(mountFn.parameters[0]?.type?.kind).to.equal("referenceType");
        if (mountFn.parameters[0]?.type?.kind === "referenceType") {
          expect(mountFn.parameters[0].type.name).to.equal("MiddlewareLike");
          expect(mountFn.parameters[0].type.typeId?.tsName).to.equal(
            "MiddlewareLike"
          );
        }

        expect(mountFn.parameters[1]?.type?.kind).to.equal("arrayType");
        if (mountFn.parameters[1]?.type?.kind === "arrayType") {
          expect(mountFn.parameters[1].type.origin).to.equal("explicit");
          expect(mountFn.parameters[1].type.elementType.kind).to.equal(
            "referenceType"
          );
          if (mountFn.parameters[1].type.elementType.kind === "referenceType") {
            expect(mountFn.parameters[1].type.elementType.name).to.equal(
              "MiddlewareLike"
            );
            expect(
              mountFn.parameters[1].type.elementType.typeId?.tsName
            ).to.equal("MiddlewareLike");
          }
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("recovers object-literal export members from source-package module objects", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-object-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const packageRoot = path.join(tempDir, "node_modules", "@demo", "pkg");
        fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
        fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
        fs.writeFileSync(
          path.join(packageRoot, "package.json"),
          JSON.stringify(
            {
              name: "@demo/pkg",
              version: "0.0.0-test",
              type: "module",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "tsonic", "package-manifest.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                exports: {
                  ".": "./src/index.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "src", "index.ts"),
          [
            "export type Parsed = { base: string };",
            "export const basename = (value: string): string => value;",
            "export const parse = (value: string): Parsed => ({ base: value });",
            "const pathObject = {",
            '  sep: "/",',
            "  basename,",
            "  parse,",
            "};",
            "export { pathObject as path };",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { path } from "@demo/pkg";',
            "export function run(): string {",
            '  const parsed = path.parse("file.txt");',
            "  return path.basename(parsed.base) + path.sep;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [packageRoot],
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const runFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "binary"
        ) {
          return;
        }

        const left = returnStmt.expression.left;
        expect(left.kind).to.equal("call");
        if (left.kind !== "call") return;
        expect(left.callee.kind).to.equal("memberAccess");
        if (left.callee.kind !== "memberAccess") return;
        expect(left.callee.inferredType?.kind).to.equal("functionType");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("infers deterministic class member types from initializer syntax", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class A {",
            "  headers = {};",
            "  body = undefined;",
            "  mapper = (value: string): string => value;",
            "}",
            "export function run(a: A): string {",
            "  if (a.headers == null) throw new Error('bad');",
            "  if (a.body !== undefined) throw new Error('bad');",
            '  return a.mapper("x");',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }
        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (returnStmt.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(returnStmt.expression.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("infers local const object members from deterministic initializer syntax", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Parsed = { base: string };",
            "const basename = (value: string): string => value;",
            "const parse = (value: string): Parsed => ({ base: value });",
            "const pathObject = {",
            '  sep: "/",',
            "  basename,",
            "  parse,",
            "};",
            "export function run(): string {",
            '  const parsed = pathObject.parse("file.txt");',
            "  return pathObject.basename(parsed.base) + pathObject.sep;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "binary"
        ) {
          return;
        }

        const left = returnStmt.expression.left;
        expect(left.kind).to.equal("call");
        if (left.kind !== "call") return;
        expect(left.callee.kind).to.equal("memberAccess");
        if (left.callee.kind !== "memberAccess") return;
        expect(left.callee.inferredType?.kind).to.equal("functionType");
      } finally {
        fixture.cleanup();
      }
    });

    it("marks generic base-class overrides after substituting superclass type arguments", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class ComparableShowable<T> {",
            "  compareTo(other: T): number {",
            "    void other;",
            "    return 0;",
            "  }",
            "  show(): string {",
            '    return "base";',
            "  }",
            "}",
            "",
            "export class NumberValue extends ComparableShowable<NumberValue> {",
            "  override compareTo(other: NumberValue): number {",
            "    void other;",
            "    return 1;",
            "  }",
            "  override show(): string {",
            '    return "derived";',
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const numberValueClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "NumberValue"
        );
        expect(numberValueClass).to.not.equal(undefined);
        if (!numberValueClass) return;

        const compareTo = numberValueClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "compareTo"
        );
        expect(compareTo).to.not.equal(undefined);
        expect(compareTo?.isOverride).to.equal(true);

        const show = numberValueClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "show"
        );
        expect(show).to.not.equal(undefined);
        expect(show?.isOverride).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });
  });
});
