import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../../builder.js";
import {
  IrCallExpression,
  IrFunctionDeclaration,
  IrType,
} from "../../types.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../../validation/index.js";
import {
  createFilesystemTestProgram,
  createTestProgram,
} from "../_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Call Inference Regressions – generic inference", () => {
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

    it("threads generic asserted array targets into empty array literals", () => {
      const source = `
        export class Box<T> {
          public items: Array<T | null> = [] as Array<T | null>;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const box = result.value.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
          stmt.kind === "classDeclaration" && stmt.name === "Box"
      );
      expect(box).to.not.equal(undefined);
      if (!box) return;

      const items = box.members.find(
        (
          member
        ): member is Extract<
          (typeof box.members)[number],
          { kind: "propertyDeclaration" }
        > => member.kind === "propertyDeclaration" && member.name === "items"
      );
      expect(items).to.not.equal(undefined);
      if (!items || !items.initializer) return;
      expect(items.initializer.kind).to.equal("typeAssertion");
      if (items.initializer.kind !== "typeAssertion") return;
      expect(items.initializer.expression.kind).to.equal("array");
      if (items.initializer.expression.kind !== "array") return;
      expect(items.initializer.expression.inferredType).to.deep.equal(
        items.type
      );
    });

    it("preserves constructor class type parameters from expected return context when names match", () => {
      const source = `
        export class Transformer<T> {
          value: T;

          constructor(value: T) {
            this.value = value;
          }

          combine(other: Transformer<T>, fn: (a: T, b: T) => T): Transformer<T> {
            return new Transformer(fn(this.value, other.value));
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const transformer = result.value.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
          stmt.kind === "classDeclaration" && stmt.name === "Transformer"
      );
      expect(transformer).to.not.equal(undefined);
      if (!transformer) return;

      const combine = transformer.members.find(
        (
          member
        ): member is Extract<
          (typeof transformer.members)[number],
          { kind: "methodDeclaration" }
        > => member.kind === "methodDeclaration" && member.name === "combine"
      );
      expect(combine).to.not.equal(undefined);
      if (!combine?.body) return;

      const returnStmt = combine.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(returnStmt?.expression?.kind).to.equal("new");
      if (!returnStmt?.expression || returnStmt.expression.kind !== "new") {
        return;
      }

      const inferredType = returnStmt.expression.inferredType;
      expect(inferredType).to.deep.include({
        kind: "referenceType",
        name: "Transformer",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
      if (!inferredType || inferredType.kind !== "referenceType") {
        return;
      }
      expect(inferredType.resolvedClrType).to.equal("TestApp.Transformer");
      expect(inferredType.typeId).to.deep.equal({
        stableId: "TestApp:TestApp.Transformer",
        clrName: "TestApp.Transformer",
        assemblyName: "TestApp",
        tsName: "Transformer",
      });
      expect(returnStmt.expression.typeArguments).to.deep.equal([
        { kind: "typeParameterType", name: "T" },
      ]);
    });

    it("preserves generic constructor inference for nested callback and promise sites through refresh passes", () => {
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
      if (!result.ok) return;

      const lowered = runAnonymousTypeLoweringPass([result.value]).modules;
      const proofResult = runNumericProofPass(lowered);
      expect(proofResult.ok).to.equal(true);
      if (!proofResult.ok) return;

      const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
      const finalModules = runAnonymousTypeLoweringPass(
        refreshed.modules
      ).modules;
      const finalModule = finalModules.find(
        (module) =>
          module.filePath === "/test/test.ts" || module.filePath === "test.ts"
      );
      expect(finalModule).to.not.equal(undefined);
      if (!finalModule) return;

      const iteratorClass = finalModule.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
          stmt.kind === "classDeclaration" &&
          stmt.name === "IntervalAsyncIterator"
      );
      expect(iteratorClass).to.not.equal(undefined);
      if (!iteratorClass) return;

      const nextMethod = iteratorClass.members.find(
        (
          member
        ): member is Extract<
          (typeof iteratorClass.members)[number],
          { kind: "methodDeclaration" }
        > => member.kind === "methodDeclaration" && member.name === "next"
      );
      expect(nextMethod).to.not.equal(undefined);
      if (!nextMethod?.body) return;

      const returnStmt = nextMethod.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(returnStmt?.expression?.kind).to.equal("call");
      if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
        return;
      }

      const promiseResolveArg = returnStmt.expression.arguments[0];
      expect(promiseResolveArg?.kind).to.equal("new");
      if (!promiseResolveArg || promiseResolveArg.kind !== "new") {
        return;
      }

      expect(promiseResolveArg.inferredType).to.deep.include({
        kind: "referenceType",
        name: "IntervalIterationResult",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
      expect(promiseResolveArg.typeArguments).to.deep.equal([
        { kind: "typeParameterType", name: "T" },
      ]);
    });

    it("preserves generic constructor inference for imported queue callback sites through refresh passes", () => {
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

              public next(value?: T): Promise<IntervalIterationResult<T>> {
                return Promise.resolve(new IntervalIterationResult(false, value));
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
        if (!result.ok) return;

        const lowered = runAnonymousTypeLoweringPass([result.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(
          proofResult.modules,
          fixture.ctx
        );
        const finalModules = runAnonymousTypeLoweringPass(
          refreshed.modules
        ).modules;
        const finalModule = finalModules.find(
          (module) =>
            module.filePath === "index.ts" ||
            module.filePath === "/src/index.ts"
        );
        expect(finalModule).to.not.equal(undefined);
        if (!finalModule) return;

        const iteratorClass = finalModule.body.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
            stmt.kind === "classDeclaration" &&
            stmt.name === "IntervalAsyncIterator"
        );
        expect(iteratorClass).to.not.equal(undefined);
        if (!iteratorClass) return;

        const nextMethod = iteratorClass.members.find(
          (
            member
          ): member is Extract<
            (typeof iteratorClass.members)[number],
            { kind: "methodDeclaration" }
          > => member.kind === "methodDeclaration" && member.name === "next"
        );
        expect(nextMethod).to.not.equal(undefined);
        if (!nextMethod?.body) return;

        const returnStmt = nextMethod.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        const promiseResolveArg = returnStmt.expression.arguments[0];
        expect(promiseResolveArg?.kind).to.equal("new");
        if (!promiseResolveArg || promiseResolveArg.kind !== "new") {
          return;
        }

        expect(promiseResolveArg.inferredType).to.deep.include({
          kind: "referenceType",
          name: "IntervalIterationResult",
          typeArguments: [{ kind: "typeParameterType", name: "T" }],
        });
        expect(promiseResolveArg.typeArguments).to.deep.equal([
          { kind: "typeParameterType", name: "T" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps named structural parameters for generic object literal arguments through proof and refresh passes", () => {
      const source = `
        type MapEntry<K, V> = {
          readonly key: K;
          value: V;
        };

        class Store<K, V> {
          Add(entry: MapEntry<K, V>): void;
          Add(entry: object): number;
          Add(entry: MapEntry<K, V> | object): void | number {
            return 0;
          }
        }

        export class Map<K, V> {
          private readonly entriesStore = new Store<K, V>();

          public set(key: K, value: V): this {
            this.entriesStore.Add({ key, value });
            return this;
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const lowered = runAnonymousTypeLoweringPass([result.value]).modules;
      const proofResult = runNumericProofPass(lowered);
      expect(proofResult.ok).to.equal(true);
      if (!proofResult.ok) return;

      const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
      const finalModules = runAnonymousTypeLoweringPass(
        refreshed.modules
      ).modules;
      const finalModule = finalModules.find(
        (module) =>
          module.filePath === "/test/test.ts" || module.filePath === "test.ts"
      );
      expect(finalModule).to.not.equal(undefined);
      if (!finalModule) return;

      let addCall: IrCallExpression | undefined;

      const visit = (value: unknown): void => {
        if (!value || typeof value !== "object" || addCall) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const node = value as {
          readonly kind?: string;
          readonly callee?: {
            readonly kind?: string;
            readonly property?: string;
          };
        };
        if (
          node.kind === "call" &&
          node.callee?.kind === "memberAccess" &&
          node.callee.property === "Add"
        ) {
          addCall = value as IrCallExpression;
          return;
        }
        Object.values(value).forEach(visit);
      };

      visit(finalModule);
      expect(addCall).to.not.equal(undefined);
      if (!addCall || addCall.kind !== "call") return;

      expect(addCall.parameterTypes).to.have.length(1);
      expect(addCall.surfaceParameterTypes).to.have.length(1);
      const addParameterType = addCall.parameterTypes?.[0];
      expect(addParameterType).to.not.equal(undefined);
      if (!addParameterType || addParameterType.kind !== "referenceType")
        return;

      expect(addParameterType).to.deep.include({
        kind: "referenceType",
        name: "MapEntry",
        typeArguments: [
          { kind: "typeParameterType", name: "K" },
          { kind: "typeParameterType", name: "V" },
        ],
        resolvedClrType: undefined,
      });
      expect(addParameterType.structuralMembers).to.deep.equal([
        {
          kind: "propertySignature",
          name: "key",
          type: { kind: "typeParameterType", name: "K" },
          isOptional: false,
          isReadonly: true,
        },
        {
          kind: "propertySignature",
          name: "value",
          type: { kind: "typeParameterType", name: "V" },
          isOptional: false,
          isReadonly: false,
        },
      ]);
      expect(addCall.surfaceParameterTypes?.[0]).to.deep.equal(
        addParameterType
      );
      expect(addCall.inferredType).to.deep.equal({ kind: "voidType" });
    });

    it("keeps named union parameter carriers for object literal arguments through proof and refresh passes", () => {
      const source = `
        type Shape =
          | { kind: "square"; side: number }
          | { kind: "circle"; radius: number };

        function tern(shape: Shape): number {
          return shape.kind === "circle" ? shape.radius : 0;
        }

        export function main(): number {
          return tern({ kind: "circle", radius: 7 });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const lowered = runAnonymousTypeLoweringPass([result.value]).modules;
      const proofResult = runNumericProofPass(lowered);
      expect(proofResult.ok).to.equal(true);
      if (!proofResult.ok) return;

      const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
      const finalModules = runAnonymousTypeLoweringPass(
        refreshed.modules
      ).modules;
      const finalModule = finalModules.find(
        (module) =>
          module.filePath === "/test/test.ts" || module.filePath === "test.ts"
      );
      expect(finalModule).to.not.equal(undefined);
      if (!finalModule) return;

      let ternCall: IrCallExpression | undefined;

      const visit = (value: unknown): void => {
        if (!value || typeof value !== "object" || ternCall) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        const node = value as {
          readonly kind?: string;
          readonly callee?: {
            readonly kind?: string;
            readonly name?: string;
          };
        };
        if (
          node.kind === "call" &&
          node.callee?.kind === "identifier" &&
          node.callee.name === "tern"
        ) {
          ternCall = value as IrCallExpression;
          return;
        }
        Object.values(value).forEach(visit);
      };

      visit(finalModule);
      expect(ternCall).to.not.equal(undefined);
      if (!ternCall) return;

      const parameterType = ternCall.parameterTypes?.[0];
      const surfaceParameterType = ternCall.surfaceParameterTypes?.[0];
      const collectReferenceNames = (type: IrType | undefined): string[] => {
        if (!type) {
          return [];
        }

        if (type.kind === "referenceType") {
          return [type.name];
        }

        if (type.kind === "unionType" || type.kind === "intersectionType") {
          return type.types.flatMap((member) => collectReferenceNames(member));
        }

        return [];
      };

      const parameterNames = collectReferenceNames(parameterType);
      const surfaceNames = collectReferenceNames(surfaceParameterType);

      expect(parameterNames).to.not.be.empty;
      expect(surfaceNames).to.not.be.empty;
      expect(
        parameterNames.every((name) => !name.startsWith("__Anon_"))
      ).to.equal(true);
      expect(
        surfaceNames.every((name) => !name.startsWith("__Anon_"))
      ).to.equal(true);
      expect(
        parameterNames.some(
          (name) => name === "Shape" || name.startsWith("Shape__")
        )
      ).to.equal(true);
      expect(
        surfaceNames.some(
          (name) => name === "Shape" || name.startsWith("Shape__")
        )
      ).to.equal(true);
    });

    it("does not invent a simple-name source type identity when multiple modules share that name", () => {
      const { sourceFile, testProgram, ctx, options, cleanup } =
        createFilesystemTestProgram(
          {
            "src/stream/readable.ts": `
            export class Readable {
              public on(eventName: string): void {}
            }
          `,
            "src/child_process/child-process.ts": `
            export type Readable = unknown;
          `,
            "src/readline/interface.ts": `
            import type { Readable } from "../stream/readable.ts";

            export class Interface {
              private _input: Readable | undefined;
            }
          `,
          },
          "src/readline/interface.ts"
        );

      try {
        const result = buildIrModule(sourceFile, testProgram, options, ctx);
        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const iface = result.value.body.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
            stmt.kind === "classDeclaration" && stmt.name === "Interface"
        );
        expect(iface).to.not.equal(undefined);
        if (!iface) return;

        const input = iface.members.find(
          (
            member
          ): member is Extract<
            (typeof iface.members)[number],
            { kind: "propertyDeclaration" }
          > => member.kind === "propertyDeclaration" && member.name === "_input"
        );
        expect(input).to.not.equal(undefined);
        if (!input || !input.type || input.type.kind !== "unionType") return;

        const readableMember = input.type.types.find(
          (member): member is Extract<IrType, { kind: "referenceType" }> =>
            member.kind === "referenceType" && member.name === "Readable"
        );
        expect(readableMember).to.not.equal(undefined);
        if (!readableMember) return;

        expect(readableMember.typeId?.clrName).to.equal(
          "TestApp.stream.Readable"
        );
      } finally {
        cleanup();
      }
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

    it("threads expected return generic context into local structural alias call inference", () => {
      const source = `
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        function ok<T>(data: T): Ok<T> {
          return { success: true, data };
        }

        type Payload = {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        };

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

      expect(retStmt.expression.inferredType?.kind).to.equal("referenceType");
      if (retStmt.expression.inferredType?.kind === "referenceType") {
        expect(retStmt.expression.inferredType.name).to.equal("Ok");
        expect(
          retStmt.expression.inferredType.typeArguments?.[0]
        ).to.deep.include({
          kind: "referenceType",
          name: "Payload",
        });
      }

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
  });
});
