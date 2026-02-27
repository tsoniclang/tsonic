/**
 * Tests for IR Builder
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
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
      expect(param?.type).to.deep.equal({ kind: "primitiveType", name: "number" });
      expect(useFn.returnType).to.deep.equal({ kind: "primitiveType", name: "number" });
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
  });
});
