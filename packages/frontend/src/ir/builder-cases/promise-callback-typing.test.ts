/**
 * IR Builder tests: Promise callback typing
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
  runOverloadCollectionPass,
} from "../validation/index.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Promise callback typing", () => {
    it("should not poison Promise.then callbacks to void before generic resolution settles", () => {
      const source = `
        declare class Promise<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): Promise<TResult1 | TResult2>;
        }

        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
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

      expect(ctor.inferredType?.kind).to.equal("referenceType");
      if (!ctor.inferredType || ctor.inferredType.kind !== "referenceType") {
        return;
      }

      expect(ctor.inferredType).to.deep.include({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "voidType" }],
        resolvedClrType: "TestApp.Promise",
      });
      expect(ctor.inferredType.typeId).to.deep.equal({
        stableId: "TestApp:TestApp.Promise",
        clrName: "TestApp.Promise",
        assemblyName: "TestApp",
        tsName: "Promise",
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

    it("preserves Promise constructor and Promise.all normalization through refresh passes", () => {
      const source = `
        declare function setTimeout(fn: () => void, ms: number): void;

        interface PromiseLike<T> {
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

          static all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
        }

        function yieldToEventLoop(): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), 0);
          });
        }

        async function runWorker(name: string): Promise<number> {
          await yieldToEventLoop();
          return name.length;
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

      const lowered = runAnonymousTypeLoweringPass([result.value]);
      expect(lowered.ok).to.equal(true);
      if (!lowered.ok) return;

      const proofed = runNumericProofPass(lowered.modules);
      expect(proofed.ok).to.equal(true);
      if (!proofed.ok) return;

      const refreshed = runCallResolutionRefreshPass(proofed.modules, ctx);
      expect(refreshed.ok).to.equal(true);
      if (!refreshed.ok) return;

      const module = refreshed.modules[0];
      expect(module).to.not.equal(undefined);
      if (!module) return;

      const yieldFn = module.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" &&
          stmt.name === "yieldToEventLoop"
      );
      expect(yieldFn).to.not.equal(undefined);
      if (!yieldFn) return;

      const yieldReturn = yieldFn.body.statements[0];
      expect(yieldReturn?.kind).to.equal("returnStatement");
      if (!yieldReturn || yieldReturn.kind !== "returnStatement") return;

      const ctor = yieldReturn.expression;
      expect(ctor?.kind).to.equal("new");
      if (!ctor || ctor.kind !== "new") return;

      expect(ctor.inferredType?.kind).to.equal("referenceType");
      if (!ctor.inferredType || ctor.inferredType.kind !== "referenceType") {
        return;
      }

      expect(ctor.inferredType).to.deep.include({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "voidType" }],
        resolvedClrType: "TestApp.Promise",
      });
      expect(ctor.inferredType.typeId).to.deep.equal({
        stableId: "TestApp:TestApp.Promise",
        clrName: "TestApp.Promise",
        assemblyName: "TestApp",
        tsName: "Promise",
      });

      const mainFn = module.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(mainFn).to.not.equal(undefined);
      if (!mainFn) return;

      const decl = mainFn.body.statements[0];
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
      const fixture = materializeFrontendFixture(
        "ir/promise-callback-typing/js-surface-generic-receiver"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

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
        expect(["Iterable", "IterableIterator", "IEnumerable_1"]).to.include(
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
        expect(["Iterable", "IterableIterator", "IEnumerable_1"]).to.include(
          callee.inferredType.returnType.name
        );
        if (callee.inferredType.returnType.typeArguments) {
          expect(callee.inferredType.returnType.typeArguments).to.deep.equal([
            { kind: "primitiveType", name: "string" },
          ]);
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("infers Array.from element types from js-source generators that are structurally iterable", () => {
      const fixtureRoot = path.resolve(
        "..",
        "..",
        "test/fixtures/js-surface-array-from-map-keys/packages/js-surface-array-from-map-keys"
      );
      const entryPath = path.join(fixtureRoot, "src/index.ts");
      const sourceRoot = path.join(fixtureRoot, "src");

      const programResult = createProgram([entryPath], {
        projectRoot: fixtureRoot,
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
        surface: "@tsonic/js",
      });

      expect(programResult.ok).to.equal(true);
      if (!programResult.ok) return;

      const program = programResult.value;
      const sourceFile =
        program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        ) ??
        program.sourceFiles.find((file) =>
          file.fileName.endsWith("/src/index.ts")
        );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(program, {
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
      });

      const moduleResult = buildIrModule(
        sourceFile,
        program,
        {
          sourceRoot,
          rootNamespace: "JsSurfaceArrayFromMapKeys",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;

      const mainDecl = moduleResult.value.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(mainDecl).to.not.equal(undefined);
      if (!mainDecl) return;

      const keysDecl = mainDecl.body.statements.find(
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
      expect(keysCall.inferredType.name).to.equal("Generator");
      expect(keysCall.inferredType.typeArguments).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "undefined" },
        { kind: "primitiveType", name: "undefined" },
      ]);
    });

    it("keeps family-marked Array.from entrypoints split into real overload bodies", () => {
      const fixtureRoot = path.resolve(
        "..",
        "..",
        "test/fixtures/js-surface-array-from-map-keys/packages/js-surface-array-from-map-keys"
      );
      const entryPath = path.join(fixtureRoot, "src/index.ts");
      const sourceRoot = path.join(fixtureRoot, "src");

      const programResult = createProgram([entryPath], {
        projectRoot: fixtureRoot,
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
        surface: "@tsonic/js",
      });

      expect(programResult.ok).to.equal(true);
      if (!programResult.ok) return;

      const program = programResult.value;
      const arraySourceFile = program.sourceFiles.find(
        (file) =>
          file.fileName.endsWith("/src/array-object.ts") &&
          (file.fileName.includes("/node_modules/@tsonic/js/") ||
            file.fileName.includes("/js/versions/10/"))
      );
      expect(arraySourceFile).to.not.equal(undefined);
      if (!arraySourceFile) return;

      const ctx = createProgramContext(program, {
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
      });

      const moduleResult = buildIrModule(
        arraySourceFile,
        program,
        {
          sourceRoot,
          rootNamespace: "JsSurfaceArrayFromMapKeys",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;

      const overloadResult = runOverloadCollectionPass([moduleResult.value]);
      expect(overloadResult.ok).to.equal(true);
      if (!overloadResult.ok) return;

      const collectedModule = overloadResult.modules[0];
      expect(collectedModule).to.not.equal(undefined);
      if (!collectedModule) return;

      const arrayClass = collectedModule.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
          stmt.kind === "classDeclaration" && stmt.name === "Array"
      );
      expect(arrayClass).to.not.equal(undefined);
      if (!arrayClass) return;

      const fromMethods = arrayClass.members.filter(
        (
          member
        ): member is Extract<typeof member, { kind: "methodDeclaration" }> =>
          member.kind === "methodDeclaration" &&
          member.isStatic &&
          member.overloadFamily?.publicName === "from" &&
          !!member.body
      );
      expect(fromMethods).to.have.length(4);

      expect(fromMethods.map((method) => method.name)).to.deep.equal([
        "from_string",
        "from_stringMapped",
        "from_iterable",
        "from_iterableMapped",
      ]);
      expect(
        fromMethods.map((method) => method.overloadFamily?.publicSignatureIndex)
      ).to.deep.equal([0, 1, 2, 3]);

      const helperCalls = fromMethods.map((method) => {
        const returnStmt = method.body!.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") {
          return undefined;
        }

        const expr = returnStmt.expression;
        expect(expr?.kind).to.equal("call");
        if (!expr || expr.kind !== "call") {
          return undefined;
        }
        expect(expr.callee.kind).to.equal("identifier");
        if (expr.callee.kind !== "identifier") {
          return undefined;
        }

        return expr.callee.name;
      });

      expect(helperCalls).to.deep.equal([
        "mapString",
        "mapStringMapped",
        "mapIterable",
        "mapIterableMapped",
      ]);
    });

    it("keeps family-marked Array.from bodies specialized to their real helpers", () => {
      const fixtureRoot = path.resolve(
        "..",
        "..",
        "test/fixtures/js-surface-array-from-map-keys/packages/js-surface-array-from-map-keys"
      );
      const entryPath = path.join(fixtureRoot, "src/index.ts");
      const sourceRoot = path.join(fixtureRoot, "src");

      const programResult = createProgram([entryPath], {
        projectRoot: fixtureRoot,
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
        surface: "@tsonic/js",
      });

      expect(programResult.ok).to.equal(true);
      if (!programResult.ok) return;

      const program = programResult.value;
      const arraySourceFile = program.sourceFiles.find(
        (file) =>
          file.fileName.endsWith("/src/array-object.ts") &&
          (file.fileName.includes("/node_modules/@tsonic/js/") ||
            file.fileName.includes("/js/versions/10/"))
      );
      expect(arraySourceFile).to.not.equal(undefined);
      if (!arraySourceFile) return;

      const ctx = createProgramContext(program, {
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
      });

      const moduleResult = buildIrModule(
        arraySourceFile,
        program,
        {
          sourceRoot,
          rootNamespace: "JsSurfaceArrayFromMapKeys",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;

      const overloadResult = runOverloadCollectionPass([moduleResult.value]);
      expect(overloadResult.ok).to.equal(true);
      if (!overloadResult.ok) return;

      const collectedModule = overloadResult.modules[0];
      expect(collectedModule).to.not.equal(undefined);
      if (!collectedModule) return;

      const arrayClass = collectedModule.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
          stmt.kind === "classDeclaration" && stmt.name === "Array"
      );
      expect(arrayClass).to.not.equal(undefined);
      if (!arrayClass) return;

      const fromMethods = arrayClass.members.filter(
        (
          member
        ): member is Extract<typeof member, { kind: "methodDeclaration" }> =>
          member.kind === "methodDeclaration" &&
          member.isStatic &&
          member.overloadFamily?.publicName === "from" &&
          !!member.body
      );
      expect(fromMethods).to.have.length(4);

      const helperCalls = fromMethods.map((method) => {
        const returnStmt = method.body!.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") {
          return undefined;
        }

        const expr = returnStmt.expression;
        expect(expr?.kind).to.equal("call");
        if (!expr || expr.kind !== "call") {
          return undefined;
        }

        expect(expr.callee.kind).to.equal("identifier");
        if (expr.callee.kind !== "identifier") {
          return undefined;
        }

        return {
          bodyName: method.name,
          calleeName: expr.callee.name,
          parameterTypes: expr.parameterTypes?.map((type) =>
            type?.kind === "referenceType"
              ? type.name
              : type?.kind === "primitiveType"
                ? type.name
                : (type?.kind ?? "missing")
          ),
        };
      });

      expect(helperCalls).to.deep.equal([
        {
          bodyName: "from_string",
          calleeName: "mapString",
          parameterTypes: ["string"],
        },
        {
          bodyName: "from_stringMapped",
          calleeName: "mapStringMapped",
          parameterTypes: ["string", "functionType"],
        },
        {
          bodyName: "from_iterable",
          calleeName: "mapIterable",
          parameterTypes: ["Iterable"],
        },
        {
          bodyName: "from_iterableMapped",
          calleeName: "mapIterableMapped",
          parameterTypes: ["Iterable", "functionType"],
        },
      ]);
    });

    it("preserves receiver substitutions for locals derived from this-owned generic members", () => {
      const fixture = materializeFrontendFixture(
        "ir/promise-callback-typing/this-member-generics"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const sourceFile = programResult.value.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(programResult.value, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          programResult.value,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const emitterClass = moduleResult.value.body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Emitter"
        );
        expect(emitterClass).to.not.equal(undefined);
        if (!emitterClass || emitterClass.kind !== "classDeclaration") return;

        const emitMethod = emitterClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" && member.name === "emit"
        );
        expect(emitMethod).to.not.equal(undefined);
        if (
          !emitMethod ||
          emitMethod.kind !== "methodDeclaration" ||
          !emitMethod.body
        ) {
          return;
        }

        const snapshotDecl = emitMethod.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "snapshot"
        );
        expect(snapshotDecl).to.not.equal(undefined);
        if (!snapshotDecl) return;

        const snapshotInitializer = snapshotDecl.declarations[0]?.initializer;
        expect(snapshotInitializer?.inferredType?.kind).to.equal("arrayType");
        if (snapshotInitializer?.inferredType?.kind !== "arrayType") return;
        expect(snapshotInitializer.inferredType.origin).to.equal("explicit");
        expect(snapshotInitializer.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
        if (
          snapshotInitializer.inferredType.elementType.kind !== "referenceType"
        ) {
          return;
        }
        expect(snapshotInitializer.inferredType.elementType.name).to.equal(
          "ListenerRegistration"
        );

        const forOf = emitMethod.body.statements.find(
          (stmt) => stmt.kind === "forOfStatement"
        );
        expect(forOf).to.not.equal(undefined);
        if (
          !forOf ||
          forOf.kind !== "forOfStatement" ||
          forOf.body.kind !== "blockStatement"
        ) {
          return;
        }

        expect(forOf.expression.inferredType?.kind).to.equal("arrayType");
        if (forOf.expression.inferredType?.kind !== "arrayType") return;
        expect(forOf.expression.inferredType.origin).to.equal("explicit");
        expect(forOf.expression.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
        if (
          forOf.expression.inferredType.elementType.kind !== "referenceType"
        ) {
          return;
        }
        expect(forOf.expression.inferredType.elementType.name).to.equal(
          "ListenerRegistration"
        );

        const invokeExpr = forOf.body.statements[0];
        expect(invokeExpr?.kind).to.equal("expressionStatement");
        if (!invokeExpr || invokeExpr.kind !== "expressionStatement") return;
        expect(invokeExpr.expression.kind).to.equal("call");
        if (invokeExpr.expression.kind !== "call") return;
        expect(invokeExpr.expression.callee.kind).to.equal("memberAccess");
        if (invokeExpr.expression.callee.kind !== "memberAccess") return;
        expect(invokeExpr.expression.callee.inferredType).to.deep.equal({
          kind: "functionType",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "args" },
              type: emitMethod.parameters[1]?.type,
              initializer: undefined,
              isOptional: false,
              isRest: true,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("threads constructor surface parameter types for closed union arguments", () => {
      const source = `
        type RuntimeValue = string | number | boolean | object | null;

        class AssertionError extends Error {
          actual: RuntimeValue | undefined = undefined;
          expected: RuntimeValue | undefined = undefined;
          operator: string = "";

          constructor(
            message?: string,
            actual?: RuntimeValue,
            expected?: RuntimeValue,
            operator: string = ""
          ) {
            super(message);
            this.actual = actual;
            this.expected = expected;
            this.operator = operator;
          }
        }

        export function create(): AssertionError {
          return new AssertionError("Test message", 5, 10, "===");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const assertionErrorClass = result.value.body.find(
        (stmt) =>
          stmt.kind === "classDeclaration" && stmt.name === "AssertionError"
      );
      expect(assertionErrorClass).to.not.equal(undefined);
      if (
        !assertionErrorClass ||
        assertionErrorClass.kind !== "classDeclaration"
      ) {
        return;
      }

      const ctorDecl = assertionErrorClass.members.find(
        (member) => member.kind === "constructorDeclaration"
      );
      expect(ctorDecl).to.not.equal(undefined);
      if (!ctorDecl || ctorDecl.kind !== "constructorDeclaration") return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "create"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctor = returnStmt.expression;
      expect(ctor?.kind).to.equal("new");
      if (!ctor || ctor.kind !== "new") return;

      const actualType = ctorDecl.parameters[1]?.type;
      const expectedType = ctorDecl.parameters[2]?.type;
      expect(actualType).to.not.equal(undefined);
      expect(expectedType).to.not.equal(undefined);
      const runtimeActualType = ctor.parameterTypes?.[1];
      const runtimeExpectedType = ctor.parameterTypes?.[2];
      expect(runtimeActualType?.kind).to.equal("unionType");
      expect(runtimeExpectedType?.kind).to.equal("unionType");
      if (
        runtimeActualType?.kind !== "unionType" ||
        runtimeExpectedType?.kind !== "unionType"
      ) {
        return;
      }
      expect(runtimeActualType.runtimeCarrierName).to.equal("RuntimeValue");
      expect(runtimeActualType.runtimeCarrierNamespace).to.equal("TestApp");
      expect(runtimeExpectedType.runtimeCarrierName).to.equal("RuntimeValue");
      expect(runtimeExpectedType.runtimeCarrierNamespace).to.equal("TestApp");
      const optionalActualType = {
        kind: "unionType" as const,
        types: [
          actualType!,
          { kind: "primitiveType" as const, name: "undefined" },
        ],
      };
      const optionalExpectedType = {
        kind: "unionType" as const,
        types: [
          expectedType!,
          { kind: "primitiveType" as const, name: "undefined" },
        ],
      };
      expect(ctor.parameterTypes?.[1]).to.deep.equal(runtimeActualType);
      expect(ctor.parameterTypes?.[2]).to.deep.equal(runtimeExpectedType);
      expect(actualType).to.not.deep.equal(runtimeActualType);
      expect(expectedType).to.not.deep.equal(runtimeExpectedType);
      expect(ctor.surfaceParameterTypes?.[1]).to.deep.equal(optionalActualType);
      expect(ctor.surfaceParameterTypes?.[2]).to.deep.equal(
        optionalExpectedType
      );
    });

    it("contextually types explicit lambda parameters from rest callbacks as element values", () => {
      const source = `
        type RuntimeValue = string | number | boolean | object | null;
        type EventListener = (...args: RuntimeValue[]) => void;

        declare function consume(listener: EventListener): void;

        export function main(): void {
          let first: RuntimeValue = null;
          let second: RuntimeValue = null;
          let third: RuntimeValue = null;

          consume((arg1, arg2, arg3) => {
            first = arg1;
            second = arg2;
            third = arg3;
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
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const callStmt = fn.body.statements[3];
      expect(callStmt?.kind).to.equal("expressionStatement");
      if (!callStmt || callStmt.kind !== "expressionStatement") return;
      expect(callStmt.expression.kind).to.equal("call");
      if (callStmt.expression.kind !== "call") return;

      const callback = callStmt.expression.arguments[0];
      expect(callback?.kind).to.equal("arrowFunction");
      if (!callback || callback.kind !== "arrowFunction") return;

      const listenerSurface = callStmt.expression.surfaceParameterTypes?.[0];
      expect(listenerSurface?.kind).to.equal("functionType");
      if (!listenerSurface || listenerSurface.kind !== "functionType") return;
      const listenerParameterType = listenerSurface.parameters[0]?.type;
      expect(listenerParameterType?.kind).to.equal("arrayType");
      if (
        !listenerParameterType ||
        listenerParameterType.kind !== "arrayType"
      ) {
        return;
      }

      for (const parameter of callback.parameters) {
        expect(parameter.type).to.deep.equal(listenerParameterType.elementType);
      }
    });

    it("does not treat contextual Queryable selector parameters as concrete method inference", () => {
      const source = `
        interface IQueryable_1<T> {}
        interface IOrderedQueryable_1<T> extends IQueryable_1<T> {}
        interface Expression_1<TDelegate> {}
        interface DateTime {}

        interface PostEntity {
          CreatedAt: DateTime;
        }

        declare class Queryable {
          static OrderByDescending<TSource, TKey>(
            source: IQueryable_1<TSource>,
            keySelector: Expression_1<(value: TSource) => TKey>
          ): IOrderedQueryable_1<TSource>;
        }

        declare const posts: IQueryable_1<PostEntity>;

        export function run() {
          const query = Queryable.OrderByDescending(posts, (p) => p.CreatedAt);
          return query;
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
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const decl = fn.body.statements[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (!decl || decl.kind !== "variableDeclaration") return;

      const queryDecl = decl.declarations[0];
      expect(queryDecl?.initializer?.kind).to.equal("call");
      if (!queryDecl?.initializer || queryDecl.initializer.kind !== "call")
        return;

      const call = queryDecl.initializer;
      expect(call.inferredType).to.not.equal(undefined);
      if (!call.inferredType) return;
      expect(call.inferredType.kind).to.equal("referenceType");
      if (call.inferredType.kind !== "referenceType") return;
      expect(call.inferredType.name).to.equal("IOrderedQueryable_1");
      expect(call.inferredType.typeArguments?.[0]).to.deep.include({
        kind: "referenceType",
        name: "PostEntity",
      });

      const selector = call.arguments[1];
      expect(selector?.kind).to.equal("arrowFunction");
      if (!selector || selector.kind !== "arrowFunction") return;

      const selectorSurface = call.surfaceParameterTypes?.[1];
      expect(selectorSurface?.kind).to.equal("referenceType");
      if (!selectorSurface || selectorSurface.kind !== "referenceType") return;
      expect(selectorSurface.name).to.equal("Expression_1");
      const selectorFn = selectorSurface.typeArguments?.[0];
      expect(selectorFn?.kind).to.equal("functionType");
      if (!selectorFn || selectorFn.kind !== "functionType") return;
      expect(selectorFn.parameters[0]?.type).to.deep.include({
        kind: "referenceType",
        name: "PostEntity",
      });
    });
  });
});
