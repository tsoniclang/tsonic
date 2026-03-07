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
  IrFunctionDeclaration,
  IrVariableDeclaration,
  IrClassDeclaration,
  IrInterfaceDeclaration,
} from "./types.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";

describe("IR Builder", () => {
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

    it("preserves ambient generic receiver substitutions for js-surface method calls", () => {
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
        expect(keysCall.inferredType.name).to.equal("Iterable");
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
        expect(callee.inferredType.returnType.name).to.equal("Iterable");
        expect(callee.inferredType.returnType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "string" },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves imported root-namespace member types across package internals", () => {
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
          'export const value = 42;\n'
        );

        const tsProgram = ts.createProgram([entryPath, path.join(srcDir, "module.ts")], {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        });
        const checker = tsProgram.getTypeChecker();
        const sourceFile = tsProgram.getSourceFile(entryPath);
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const program = {
          program: tsProgram,
          checker,
          options: {
            projectRoot: tempDir,
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
            strict: true,
          },
          sourceFiles: [
            sourceFile,
            tsProgram.getSourceFile(path.join(srcDir, "module.ts"))!,
          ],
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
        expect(call.inferredType?.kind).to.equal("referenceType");
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

        const tsProgram = ts.createProgram([entryPath, path.join(srcDir, "module.ts")], {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        });
        const checker = tsProgram.getTypeChecker();
        const sourceFile = tsProgram.getSourceFile(entryPath);
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const program = {
          program: tsProgram,
          checker,
          options: {
            projectRoot: tempDir,
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
            strict: true,
          },
          sourceFiles: [
            sourceFile,
            tsProgram.getSourceFile(path.join(srcDir, "module.ts"))!,
          ],
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

        expect(initializer.object.kind).to.equal("identifier");
        if (initializer.object.kind !== "identifier") return;

        expect(initializer.object.inferredType).to.deep.equal({
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

        expect(initializer.object.kind).to.equal("identifier");
        if (initializer.object.kind !== "identifier") return;

        expect(initializer.object.inferredType).to.deep.equal({
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
  });
});
