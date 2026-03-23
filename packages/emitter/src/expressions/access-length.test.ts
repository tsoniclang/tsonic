import { describe, it } from "mocha";
import { expect } from "chai";
import { createContext } from "../emitter-types/context.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { printExpression } from "../core/format/backend-ast/printer.js";
import { tryEmitJsSurfaceArrayLikeLengthAccess } from "./access-length.js";

describe("access-length", () => {
  it("guards optional JS-surface array-wrapper length reads before object creation", () => {
    const context = createContext({
      rootNamespace: "Test",
      surface: "@tsonic/js",
    });

    const valuesType = {
      kind: "referenceType" as const,
      name: "Array",
      typeArguments: [
        { kind: "primitiveType" as const, name: "string" as const },
      ],
    };

    const expr = {
      kind: "memberAccess" as const,
      object: {
        kind: "identifier" as const,
        name: "values",
        inferredType: valuesType,
      },
      property: "length",
      isComputed: false,
      isOptional: true,
      inferredType: { kind: "primitiveType" as const, name: "number" as const },
    };

    const result = tryEmitJsSurfaceArrayLikeLengthAccess(
      expr,
      identifierExpression("values"),
      valuesType,
      context
    );

    expect(result).to.not.equal(undefined);
    expect(result![0].kind).to.equal("conditionalExpression");
    expect(printExpression(result![0])).to.equal(
      "values == null ? default(int?) : values.Length"
    );
  });
});
