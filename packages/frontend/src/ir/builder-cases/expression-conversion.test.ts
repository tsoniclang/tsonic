/**
 * IR Builder tests: Expression Conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import {
  createFilesystemTestProgram,
  createTestProgram,
  createProgramContext,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

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

    it("contextually types awaited async return object literals against awaited return shapes", () => {
      const source = `
        type HandlerControl = {
          ended: boolean;
          control?: string | null;
          error?: object;
        };

        async function invokeHandlers(): Promise<HandlerControl> {
          return { ended: false, control: "route", error: undefined };
        }

        async function run(): Promise<void> {
          const control = await invokeHandlers();
          if (control.error !== undefined) {
            return;
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        return;
      }

      const runFn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) {
        return;
      }

      const controlDecl = runFn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations[0]?.name.kind === "identifierPattern" &&
          stmt.declarations[0]?.name.name === "control"
      );
      expect(controlDecl).to.not.equal(undefined);
      if (!controlDecl) {
        return;
      }

      const initializer = controlDecl.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("await");
      expect(initializer?.inferredType?.kind).to.equal("objectType");
      expect(
        initializer?.inferredType?.kind === "objectType"
          ? initializer.inferredType.members.map((member) => member.name)
          : []
      ).to.deep.equal(["ended", "control", "error"]);
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

    it("should lower import.meta.filename and dirname to deterministic string literals", () => {
      const source = `
        const file = import.meta.filename;
        const dir = import.meta.dirname;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const fileDecl = result.value.body[0] as IrVariableDeclaration;
        const fileInit = fileDecl.declarations[0]?.initializer;
        expect(fileInit?.kind).to.equal("literal");
        if (fileInit?.kind === "literal") {
          expect(fileInit.value).to.equal("/test/test.ts");
        }

        const dirDecl = result.value.body[1] as IrVariableDeclaration;
        const dirInit = dirDecl.declarations[0]?.initializer;
        expect(dirInit?.kind).to.equal("literal");
        if (dirInit?.kind === "literal") {
          expect(dirInit.value).to.equal("/test");
        }
      }
    });

    it("preserves generic constructor parameter surfaces instead of degrading them to any", () => {
      const source = `
        export class IntervalIterationResult<T> {
          public constructor(
            public readonly done: boolean,
            public readonly value: T | undefined
          ) {}
        }

        export class IntervalAsyncIterator<T> {
          public close(): IntervalIterationResult<T> {
            return new IntervalIterationResult(true, undefined);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        return;
      }

      const iteratorClass = result.value.body.find(
        (stmt) =>
          stmt.kind === "classDeclaration" &&
          stmt.name === "IntervalAsyncIterator"
      );
      expect(iteratorClass?.kind).to.equal("classDeclaration");
      if (!iteratorClass || iteratorClass.kind !== "classDeclaration") {
        return;
      }

      const closeMethod = iteratorClass.members.find(
        (member) =>
          member.kind === "methodDeclaration" && member.name === "close"
      );
      expect(closeMethod?.kind).to.equal("methodDeclaration");
      if (
        !closeMethod ||
        closeMethod.kind !== "methodDeclaration" ||
        !closeMethod.body
      ) {
        return;
      }

      const returnStmt = closeMethod.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      ) {
        return;
      }

      const newExpr = returnStmt.expression;
      expect(newExpr.kind).to.equal("new");
      if (newExpr.kind !== "new") {
        return;
      }

      const assertGenericUndefinedUnion = (
        type:
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      ): void => {
        expect(type?.kind).to.equal("unionType");
        if (!type || type.kind !== "unionType") {
          return;
        }

        expect(type.types).to.deep.include({
          kind: "typeParameterType",
          name: "T",
        });
        expect(type.types).to.deep.include({
          kind: "primitiveType",
          name: "undefined",
        });
      };

      assertGenericUndefinedUnion(
        newExpr.parameterTypes?.[1] as
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      );
      assertGenericUndefinedUnion(
        newExpr.surfaceParameterTypes?.[1] as
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      );
    });

    it("infers generic constructor type arguments through outer generic callback and promise contexts", () => {
      const source = `
        export class IntervalIterationResult<T> {
          public constructor(
            public readonly done: boolean,
            public readonly value: T | undefined
          ) {}
        }

        export class IntervalAsyncIterator<T> {
          public enqueue(value?: T): void {
            const waiter: (result: IntervalIterationResult<T>) => void = () => {};
            waiter(new IntervalIterationResult(false, value));
          }

          public next(value?: T): Promise<IntervalIterationResult<T>> {
            return Promise.resolve(new IntervalIterationResult(false, value));
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        expect.fail(
          `Expected build success, got diagnostic: ${result.error.message}`
        );
        return;
      }

      const iteratorClass = result.value.body.find(
        (stmt) =>
          stmt.kind === "classDeclaration" &&
          stmt.name === "IntervalAsyncIterator"
      );
      expect(iteratorClass?.kind).to.equal("classDeclaration");
      if (!iteratorClass || iteratorClass.kind !== "classDeclaration") {
        return;
      }

      const nextMethod = iteratorClass.members.find(
        (member) =>
          member.kind === "methodDeclaration" && member.name === "next"
      );
      expect(nextMethod?.kind).to.equal("methodDeclaration");
      if (
        !nextMethod ||
        nextMethod.kind !== "methodDeclaration" ||
        !nextMethod.body
      ) {
        return;
      }

      const nextReturn = nextMethod.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(nextReturn?.kind).to.equal("returnStatement");
      if (
        !nextReturn ||
        nextReturn.kind !== "returnStatement" ||
        !nextReturn.expression ||
        nextReturn.expression.kind !== "call"
      ) {
        return;
      }

      const promiseResolveArg = nextReturn.expression.arguments[0];
      expect(promiseResolveArg?.kind).to.equal("new");
      if (!promiseResolveArg || promiseResolveArg.kind !== "new") {
        return;
      }

      const inferredType = promiseResolveArg.inferredType;
      expect(inferredType).to.deep.include({
        kind: "referenceType",
        name: "IntervalIterationResult",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
      if (!inferredType || inferredType.kind !== "referenceType") {
        return;
      }
      expect(inferredType.resolvedClrType).to.equal(
        "TestApp.IntervalIterationResult"
      );
      expect(inferredType.typeId).to.deep.equal({
        stableId: "TestApp:TestApp.IntervalIterationResult",
        clrName: "TestApp.IntervalIterationResult",
        assemblyName: "TestApp",
        tsName: "IntervalIterationResult",
      });
      expect(promiseResolveArg.typeArguments).to.deep.equal([
        { kind: "typeParameterType", name: "T" },
      ]);
    });

    it("infers generic constructor type arguments through imported generic queue members", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": `
            import { Queue } from "@tsonic/dotnet/System.Collections.Generic.js";

            export class IntervalIterationResult<T> {
              public constructor(
                public readonly done: boolean,
                public readonly value: T | undefined
              ) {}
            }

            export class IntervalAsyncIterator<T> {
              private readonly waiters: Queue<
                (result: IntervalIterationResult<T>) => void
              > = new Queue<(result: IntervalIterationResult<T>) => void>();

              public enqueue(value?: T): void {
                if (this.waiters.Count > 0) {
                  const waiter = this.waiters.Dequeue();
                  waiter(new IntervalIterationResult(false, value));
                }
              }
            }
          `,
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic.d.ts": `
            export declare class Queue<T> {
              Count: number;
              constructor();
              Dequeue(): T;
              Enqueue(value: T): void;
            }
          `,
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
        if (!result.ok) {
          expect.fail(
            `Expected build success, got diagnostic: ${result.error.message}`
          );
          return;
        }

        const iteratorClass = result.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" &&
            stmt.name === "IntervalAsyncIterator"
        );
        expect(iteratorClass?.kind).to.equal("classDeclaration");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves unknown array element types through conditional spread arrays", () => {
      const source = `
        function inspect(value: unknown): string {
          return "";
        }

        function format(message?: unknown, optionalParams: readonly unknown[] = []): string {
          const values =
            message === undefined ? [...optionalParams] : [message, ...optionalParams];
          return values.map((value) => inspect(value)).join(" ");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "format"
        );
        expect(fn).to.not.equal(undefined);
        const valuesDecl = fn?.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "values"
            )
        );
        const valuesInit = valuesDecl?.declarations[0]?.initializer;
        expect(valuesInit?.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "unknownType" },
        });
      }
    });

    it("infers generic array callback return types when callbacks omit trailing parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function inspect(value: unknown): string;",
            "",
            "export function format(",
            "  message?: unknown,",
            "  optionalParams: readonly unknown[] = []",
            "): string {",
            "  const values =",
            "    message === undefined ? [...optionalParams] : [message, ...optionalParams];",
            '  return values.map((value) => inspect(value)).join(" ");',
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
            stmt.kind === "functionDeclaration" && stmt.name === "format"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        const joinCall = returnStmt.expression;
        expect(joinCall.callee.kind).to.equal("memberAccess");
        if (joinCall.callee.kind !== "memberAccess") {
          return;
        }

        expect(joinCall.callee.object.kind).to.equal("call");
        if (joinCall.callee.object.kind !== "call") {
          return;
        }

        expect(joinCall.callee.object.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
      } finally {
        fixture.cleanup();
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
});
