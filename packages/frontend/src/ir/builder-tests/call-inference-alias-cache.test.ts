/**
 * IR Builder tests: Type-alias cache isolation and determinism
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Call Inference Regressions – alias cache", () => {
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
