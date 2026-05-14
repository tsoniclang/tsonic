import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readFrontendSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("IR Soundness Gate", () => {
  describe("unknown-type escape hatches", () => {
    it("does not expose permissive soundness-gate flags", () => {
      const sourceFiles = [
        "ir/types/expressions-core.ts",
        "ir/types/ir-types.ts",
        "ir/validation/soundness-gate-expression-validation.ts",
        "ir/validation/soundness-gate-type-validation.ts",
        "ir/converters/expressions/access/access-converter.ts",
      ];

      const forbiddenNames = [
        "allowUnknownInferredType",
        "allowRootUnknownType",
        "allowRootIntersectionType",
        "preserveRuntimeLayout",
      ];

      for (const sourceFile of sourceFiles) {
        const source = readFrontendSource(sourceFile);
        for (const forbiddenName of forbiddenNames) {
          expect(source).to.not.include(
            forbiddenName,
            `${sourceFile} must use structural facts, not permissive flag ${forbiddenName}`
          );
        }
      }
    });
  });

  describe("if-statement branch plans", () => {
    it("keeps branch plans required and legacy narrowing side channels out of the IR type", () => {
      const statementsSource = readFrontendSource("ir/types/statements.ts");

      expect(statementsSource).to.include("readonly thenPlan: IrIfBranchPlan");
      expect(statementsSource).to.include("readonly elsePlan: IrIfBranchPlan");
      expect(statementsSource).to.not.include("thenPlan?:");
      expect(statementsSource).to.not.include("elsePlan?:");
      expect(statementsSource).to.not.include("thenNarrowings");
      expect(statementsSource).to.not.include("elseNarrowings");
    });
  });
});
