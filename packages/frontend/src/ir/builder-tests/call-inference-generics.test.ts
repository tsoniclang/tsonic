/**
 * IR Builder tests: Call Inference Regressions - generic inference and context threading
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import {
  createTestProgram,
  createFilesystemTestProgram,
} from "./_test-helpers.js";

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
});
