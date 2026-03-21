import { describe, it } from "mocha";
import { expect } from "chai";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "../index.js";
import {
  createTestModule,
  hasArrayInferredObjectElementType,
  hasNonEmptyObjectTypeInExpressionMetadata,
} from "./test-helpers.js";

describe("Anonymous Type Lowering Regression Coverage (basic lowering)", () => {
  it("lowers array inferredType metadata for contextual empty arrays", () => {
    const module = createTestModule(`
      export function collect(
        map: Record<string, { clientName: string; status: string; timestamp: number }[]>,
        id: string
      ): Record<string, { clientName: string; status: string; timestamp: number }[]> {
        if (map[id] === undefined) {
          map[id] = [];
        }
        return map;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );

    expect(hasArrayInferredObjectElementType(lowered.modules)).to.equal(false);
  });

  it("lowers call/member inferred metadata object shapes to synthetic references", () => {
    const module = createTestModule(`
      const makePayload = () => ({ ok: true, code: 200 });

      export function readCode(): number {
        const result = makePayload();
        const code = makePayload().code;
        return result.code + code;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );
    expect(hasNonEmptyObjectTypeInExpressionMetadata(lowered.modules)).to.equal(
      false
    );
  });
});
