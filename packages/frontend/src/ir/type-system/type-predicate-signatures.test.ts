import { expect } from "chai";
import { describe, it } from "mocha";
import {
  getTstsIdentifierText,
  TstsSyntax,
  visitTstsSubtree,
  type TstsNode,
} from "@tsonic/tsts";
import { createTestProgram } from "../builder-cases/_test-helpers.js";

describe("type predicate signatures", () => {
  it("extracts predicate parameter names from identifier predicate nodes", () => {
    const { testProgram, ctx } = createTestProgram(`
      function isString(value: unknown): value is string {
        return typeof value === "string";
      }

      const run = (input: unknown): boolean => isString(input);
    `);

    let predicateCall: TstsNode | undefined;
    visitTstsSubtree(testProgram.sourceFiles[0], (node) => {
      if (!TstsSyntax.IsCallExpression(node)) return;
      const callee = TstsSyntax.Node_Expression(node);
      if (getTstsIdentifierText(callee) === "isString") {
        predicateCall = node;
      }
    });

    expect(predicateCall).to.not.equal(undefined);
    if (!predicateCall) return;

    const sigId = ctx.binding.resolveCallSignature(predicateCall);
    expect(sigId).to.not.equal(undefined);
    if (!sigId) return;

    const resolved = ctx.typeSystem.resolveCall({
      sigId,
      argumentCount: TstsSyntax.Node_Arguments(predicateCall)?.length ?? 0,
      argTypes: [{ kind: "unknownType", explicit: true }],
      explicitTypeArgs: [],
    });

    expect(resolved.typePredicate).to.deep.equal({
      kind: "param",
      parameterIndex: 0,
      targetType: { kind: "primitiveType", name: "string" },
    });
  });
});
