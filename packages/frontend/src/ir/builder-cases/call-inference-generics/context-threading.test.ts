import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../../builder.js";
import { IrFunctionDeclaration, IrType } from "../../types.js";
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
        (
          stmt
        ): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
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

    it("does not invent a simple-name source type identity when multiple modules share that name", () => {
      const {
        sourceFile,
        testProgram,
        ctx,
        options,
        cleanup,
      } = createFilesystemTestProgram(
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
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
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
